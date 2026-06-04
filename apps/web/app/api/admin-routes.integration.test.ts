import {
  createAnonSupabaseClient,
  createServiceRoleSupabaseClient,
} from "@soulbound/adapters";
import { POST as postApplication } from "./admission/applications/route";
import { GET as getApplicantApplicationById } from "./admission/applications/[id]/route";
import { GET as getAdminApplications } from "./admin/applications/route";
import { GET as getAdminApplicationById } from "./admin/applications/[id]/route";
import { POST as postReview } from "./admin/applications/[id]/review/route";
import { POST as postApprove } from "./admin/applications/[id]/approve/route";
import { POST as postReject } from "./admin/applications/[id]/reject/route";
import { POST as postRequestMoreInfo } from "./admin/applications/[id]/request-more-info/route";

declare const process: {
  readonly env: Record<string, string | undefined>;
};

interface IntegrationConfig {
  readonly url: string;
  readonly anonKey: string;
  readonly serviceRoleKey: string;
}

interface TestSession {
  readonly id: string;
  readonly email: string;
  readonly accessToken: string;
}

interface TestApplicant extends TestSession {
  readonly password: string;
}

interface AuthRetryOptions {
  readonly label: string;
  readonly attempts?: number;
  readonly delayMs?: number;
}

interface RouteContext {
  readonly params: Promise<{
    readonly id: string;
  }>;
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

function jsonRequest(
  accessToken: string,
  path: string,
  body: Record<string, unknown>,
): Request {
  return authedRequest(accessToken, path, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
    },
  });
}

function routeContext(id: string): RouteContext {
  return {
    params: Promise.resolve({ id }),
  };
}

async function signIn(
  config: IntegrationConfig,
  email: string,
  password: string,
): Promise<TestSession> {
  const anonClient = createAnonSupabaseClient({
    url: config.url,
    anonKey: config.anonKey,
  });

  const signInResult = await retryAuthFixtureOperation({
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

  const id = signInResult.user?.id;
  const accessToken = signInResult.session?.access_token;
  if (!id || !accessToken) {
    throw new Error(`Supabase signIn returned no user/session for ${email}.`);
  }

  return {
    id,
    email,
    accessToken,
  };
}

async function createApplicant(
  config: IntegrationConfig,
  purpose: string,
): Promise<TestApplicant> {
  const serviceRoleClient = createServiceRoleSupabaseClient({
    url: config.url,
    serviceRoleKey: config.serviceRoleKey,
  });
  const suffix = uniqueSuffix();
  const email = `task6b-${purpose}-${suffix}@soulbound.local`;
  const password = `Task6b-${suffix}!`;

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
      handle: `task6b-${purpose}-${suffix}`,
      role: "applicant",
      membership_status: "none",
    });
  if (profileError) {
    throw profileError;
  }

  const session = await signIn(config, email, password);

  return {
    ...session,
    password,
  };
}

async function submitApplication(
  applicant: TestApplicant,
  motivation: string,
): Promise<Record<string, unknown>> {
  const response = await postApplication(jsonRequest(
    applicant.accessToken,
    "/api/admission/applications",
    {
      motivation,
      idempotencyKey: `task6b-submit-${uniqueSuffix()}`,
    },
  ));
  expect(response.status).toBe(201);
  const application = await response.json() as Record<string, unknown>;
  expect(application.status).toBe("submitted");
  expect(application.applicantId).toBe(applicant.id);

  return application;
}

async function startReview(
  reviewer: TestSession,
  applicationId: string,
): Promise<Record<string, unknown>> {
  const response = await postReview(
    jsonRequest(
      reviewer.accessToken,
      `/api/admin/applications/${applicationId}/review`,
      { idempotencyKey: `task6b-review-${uniqueSuffix()}` },
    ),
    routeContext(applicationId),
  );
  expect(response.status).toBe(200);
  const application = await response.json() as Record<string, unknown>;
  expect(application.status).toBe("under_review");

  return application;
}

describe("admin route handlers", () => {
  it("handles reviewer reads and state transitions with real bearer auth", async () => {
    const config = readConfig();
    const reviewer = await signIn(
      config,
      "reviewer@soulbound.local",
      "password123",
    );
    const approveApplicant = await createApplicant(config, "approve");
    const rejectApplicant = await createApplicant(config, "reject");
    const moreInfoApplicant = await createApplicant(config, "more-info");

    const queueCursor = new Date(Date.now() - 60_000).toISOString();
    const approveApplication = await submitApplication(
      approveApplicant,
      "Task 6b approve branch.",
    );
    const approveApplicationId = String(approveApplication.id);

    const queueResponse = await getAdminApplications(authedRequest(
      reviewer.accessToken,
      `/api/admin/applications?status=submitted&limit=100&cursor=${encodeURIComponent(queueCursor)}`,
    ));
    expect(queueResponse.status).toBe(200);
    const queue = await queueResponse.json() as Array<Record<string, unknown>>;
    expect(queue.some((item) => item.id === approveApplicationId)).toBe(true);

    const applicantAdminQueueResponse = await getAdminApplications(
      authedRequest(
        approveApplicant.accessToken,
        "/api/admin/applications?status=submitted",
      ),
    );
    expect(applicantAdminQueueResponse.status).toBe(403);

    const applicantAdminDetailResponse = await getAdminApplicationById(
      authedRequest(
        approveApplicant.accessToken,
        `/api/admin/applications/${approveApplicationId}`,
      ),
      routeContext(approveApplicationId),
    );
    expect(applicantAdminDetailResponse.status).toBe(403);

    await startReview(reviewer, approveApplicationId);

    const applicantAdminApproveResponse = await postApprove(
      jsonRequest(
        approveApplicant.accessToken,
        `/api/admin/applications/${approveApplicationId}/approve`,
        {
          reasonCode: "meets_phase1_policy",
          idempotencyKey: `task6b-applicant-forbidden-${uniqueSuffix()}`,
        },
      ),
      routeContext(approveApplicationId),
    );
    expect(applicantAdminApproveResponse.status).toBe(403);

    const invalidReasonResponse = await postApprove(
      jsonRequest(
        reviewer.accessToken,
        `/api/admin/applications/${approveApplicationId}/approve`,
        {
          reasonCode: "free_text_reason",
          idempotencyKey: `task6b-invalid-reason-${uniqueSuffix()}`,
        },
      ),
      routeContext(approveApplicationId),
    );
    expect(invalidReasonResponse.status).toBe(422);

    const reviewSummary = `internal note ${uniqueSuffix()}`;
    const approveResponse = await postApprove(
      jsonRequest(
        reviewer.accessToken,
        `/api/admin/applications/${approveApplicationId}/approve`,
        {
          reasonCode: "meets_phase1_policy",
          applicantNotice: "Welcome.",
          reviewSummary,
          idempotencyKey: `task6b-approve-${uniqueSuffix()}`,
        },
      ),
      routeContext(approveApplicationId),
    );
    expect(approveResponse.status).toBe(200);
    const approveOutcome = await approveResponse.json() as {
      readonly application: Record<string, unknown>;
      readonly membership: Record<string, unknown>;
    };
    expect(approveOutcome.application.status).toBe("approved");
    expect(approveOutcome.membership.status).toBe("active");

    const reviewerDetailResponse = await getAdminApplicationById(
      authedRequest(
        reviewer.accessToken,
        `/api/admin/applications/${approveApplicationId}`,
      ),
      routeContext(approveApplicationId),
    );
    expect(reviewerDetailResponse.status).toBe(200);
    const reviewerDetail =
      await reviewerDetailResponse.json() as Record<string, unknown>;
    expect(reviewerDetail.reviewSummary).toBe(reviewSummary);

    const applicantOwnDetailResponse = await getApplicantApplicationById(
      authedRequest(
        approveApplicant.accessToken,
        `/api/admission/applications/${approveApplicationId}`,
      ),
      routeContext(approveApplicationId),
    );
    expect(applicantOwnDetailResponse.status).toBe(200);
    const applicantOwnDetail =
      await applicantOwnDetailResponse.json() as Record<string, unknown>;
    expect(applicantOwnDetail.id).toBe(approveApplicationId);
    expect(applicantOwnDetail).not.toHaveProperty("reviewSummary");

    const rejectApplication = await submitApplication(
      rejectApplicant,
      "Task 6b reject branch.",
    );
    const rejectApplicationId = String(rejectApplication.id);
    await startReview(reviewer, rejectApplicationId);
    const rejectReviewSummary = `reject internal ${uniqueSuffix()}`;
    const rejectResponse = await postReject(
      jsonRequest(
        reviewer.accessToken,
        `/api/admin/applications/${rejectApplicationId}/reject`,
        {
          reasonCode: "mismatch_with_policy",
          applicantNotice: "Not eligible for Phase 1.",
          reviewSummary: rejectReviewSummary,
          idempotencyKey: `task6b-reject-${uniqueSuffix()}`,
        },
      ),
      routeContext(rejectApplicationId),
    );
    expect(rejectResponse.status).toBe(200);
    await expect(rejectResponse.json()).resolves.toMatchObject({
      status: "rejected",
    });
    const rejectedDetailResponse = await getAdminApplicationById(
      authedRequest(
        reviewer.accessToken,
        `/api/admin/applications/${rejectApplicationId}`,
      ),
      routeContext(rejectApplicationId),
    );
    expect(rejectedDetailResponse.status).toBe(200);
    await expect(rejectedDetailResponse.json()).resolves.toMatchObject({
      reviewSummary: rejectReviewSummary,
    });

    const moreInfoApplication = await submitApplication(
      moreInfoApplicant,
      "Task 6b request more info branch.",
    );
    const moreInfoApplicationId = String(moreInfoApplication.id);
    await startReview(reviewer, moreInfoApplicationId);
    const moreInfoResponse = await postRequestMoreInfo(
      jsonRequest(
        reviewer.accessToken,
        `/api/admin/applications/${moreInfoApplicationId}/request-more-info`,
        {
          reasonCode: "needs_identity_clarification",
          applicantNotice: "Please clarify your identity.",
          reviewSummary: `more info internal ${uniqueSuffix()}`,
          idempotencyKey: `task6b-more-info-${uniqueSuffix()}`,
        },
      ),
      routeContext(moreInfoApplicationId),
    );
    expect(moreInfoResponse.status).toBe(200);
    await expect(moreInfoResponse.json()).resolves.toMatchObject({
      status: "needs_more_info",
    });
  }, 60_000);

  it("returns 401 for missing or invalid sessions on admin routes", async () => {
    const noSessionResponse = await getAdminApplications(
      new Request("http://localhost/api/admin/applications"),
    );
    expect(noSessionResponse.status).toBe(401);

    const invalidSessionResponse = await getAdminApplications(
      authedRequest("not-a-real-token", "/api/admin/applications"),
    );
    expect(invalidSessionResponse.status).toBe(401);
  });
});
