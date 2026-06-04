import {
  createAnonSupabaseClient,
  createServiceRoleSupabaseClient,
} from "@soulbound/adapters";
import { POST as postApplication } from "./admission/applications/route";
import { GET as getMyApplication } from "./admission/applications/me/route";
import { GET as getApplicationById } from "./admission/applications/[id]/route";
import { GET as getMyMembership } from "./membership/me/route";

declare const process: {
  readonly env: Record<string, string | undefined>;
};

interface IntegrationConfig {
  readonly url: string;
  readonly anonKey: string;
  readonly serviceRoleKey: string;
}

interface TestApplicant {
  readonly id: string;
  readonly email: string;
  readonly password: string;
  readonly accessToken: string;
}

interface AuthRetryOptions {
  readonly label: string;
  readonly attempts?: number;
  readonly delayMs?: number;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Export NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY before running web integration tests.`,
    );
  }

  return value;
}

function readConfig(): IntegrationConfig {
  return {
    url: requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return JSON.stringify(error);
}

function isRetryableAuthError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.name === "AuthRetryableFetchError"
    || error.message === "fetch failed"
    || error.message.includes("fetch failed")
  );
}

async function retryAuthFixtureOperation<T>(
  options: AuthRetryOptions,
  operation: () => Promise<T>,
): Promise<T> {
  const attempts = options.attempts ?? 4;
  const delayMs = options.delayMs ?? 250;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableAuthError(error) || attempt === attempts) {
        break;
      }

      await sleep(delayMs * attempt);
    }
  }

  throw new Error(
    `Auth fixture operation '${options.label}' failed after ${attempts} attempts: ${describeError(lastError)}`,
  );
}

function authedRequest(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Request {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${accessToken}`);

  return new Request(`http://localhost${path}`, {
    ...init,
    headers,
  });
}

async function createApplicant(
  config: IntegrationConfig,
): Promise<TestApplicant> {
  const serviceRoleClient = createServiceRoleSupabaseClient({
    url: config.url,
    serviceRoleKey: config.serviceRoleKey,
  });
  const suffix = uniqueSuffix();
  const email = `task6a-applicant-${suffix}@soulbound.local`;
  const password = `Task6a-${suffix}!`;

  const created = await retryAuthFixtureOperation({
    label: `admin.createUser(${email})`,
  }, async () => {
    const { data, error } = await serviceRoleClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {},
      app_metadata: {},
    });
    if (error) {
      throw error;
    }

    return data;
  });

  const id = created.user?.id;
  if (!id) {
    throw new Error("Supabase admin createUser returned no user id.");
  }

  const { error: profileError } = await serviceRoleClient
    .from("profiles")
    .insert({
      id,
      handle: `task6a-${suffix}`,
      role: "applicant",
      membership_status: "none",
    });
  if (profileError) {
    throw profileError;
  }

  const anonClient = createAnonSupabaseClient({
    url: config.url,
    anonKey: config.anonKey,
  });
  const signIn = await retryAuthFixtureOperation({
    label: `signInWithPassword(${email})`,
  }, async () => {
    const { data, error } = await anonClient.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      throw error;
    }

    return data;
  });

  const accessToken = signIn.session?.access_token;
  if (!accessToken) {
    throw new Error("Supabase signIn returned no access token.");
  }

  return {
    id,
    email,
    password,
    accessToken,
  };
}

async function submitApplication(
  accessToken: string,
  body: Record<string, unknown>,
): Promise<Response> {
  return postApplication(authedRequest(accessToken, "/api/admission/applications", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
    },
  }));
}

describe("applicant route handlers", () => {
  it("handles applicant submit/read/membership routes with real bearer auth", async () => {
    const config = readConfig();
    const applicant = await createApplicant(config);
    const otherApplicant = await createApplicant(config);

    const maliciousSubmitResponse = await submitApplication(
      applicant.accessToken,
      {
        applicantId: otherApplicant.id,
        applicantStatement: "Task 6a applicant statement.",
        motivation: "Prove route handlers with real auth.",
        idempotencyKey: `task6a-submit-${uniqueSuffix()}`,
      },
    );
    expect(maliciousSubmitResponse.status).toBe(201);
    const application = await maliciousSubmitResponse.json();
    expect(application.status).toBe("submitted");
    expect(application.applicantId).toBe(applicant.id);
    expect(application.applicantId).not.toBe(otherApplicant.id);

    const meResponse = await getMyApplication(
      authedRequest(applicant.accessToken, "/api/admission/applications/me"),
    );
    expect(meResponse.status).toBe(200);
    const activeApplication = await meResponse.json();
    expect(activeApplication.id).toBe(application.id);

    const ownResponse = await getApplicationById(
      authedRequest(
        applicant.accessToken,
        `/api/admission/applications/${application.id}`,
      ),
      { params: Promise.resolve({ id: application.id }) },
    );
    expect(ownResponse.status).toBe(200);
    await expect(ownResponse.json()).resolves.toMatchObject({
      id: application.id,
      applicantId: applicant.id,
    });

    const otherSubmitResponse = await submitApplication(
      otherApplicant.accessToken,
      {
        motivation: "Other applicant application.",
        idempotencyKey: `task6a-other-submit-${uniqueSuffix()}`,
      },
    );
    expect(otherSubmitResponse.status).toBe(201);
    const otherApplication = await otherSubmitResponse.json();

    const otherReadResponse = await getApplicationById(
      authedRequest(
        applicant.accessToken,
        `/api/admission/applications/${otherApplication.id}`,
      ),
      { params: Promise.resolve({ id: otherApplication.id }) },
    );
    expect(otherReadResponse.status).toBe(404);

    const membershipResponse = await getMyMembership(
      authedRequest(applicant.accessToken, "/api/membership/me"),
    );
    expect(membershipResponse.status).toBe(200);
    await expect(membershipResponse.json()).resolves.toBeNull();
  });

  it("returns 401 for missing or invalid sessions", async () => {
    const noSessionResponse = await postApplication(
      new Request("http://localhost/api/admission/applications", {
        method: "POST",
        body: JSON.stringify({
          motivation: "No auth.",
          idempotencyKey: "no-auth",
        }),
      }),
    );
    expect(noSessionResponse.status).toBe(401);

    const invalidSessionResponse = await getMyApplication(
      authedRequest("not-a-real-token", "/api/admission/applications/me"),
    );
    expect(invalidSessionResponse.status).toBe(401);
  });
});
