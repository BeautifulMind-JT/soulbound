import {
  createAnonSupabaseClient,
  createServiceRoleSupabaseClient,
  createUserSupabaseClient,
} from "@soulbound/adapters";
import { GET, PATCH } from "./profile/me/route";

declare const process: {
  readonly env: Record<string, string | undefined>;
};

interface IntegrationConfig {
  readonly url: string;
  readonly anonKey: string;
  readonly serviceRoleKey: string;
}

interface TestMember {
  readonly id: string;
  readonly email: string;
  readonly password: string;
  readonly accessToken: string;
  readonly handle: string;
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
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return new Request(`http://localhost${path}`, {
    ...init,
    headers,
  });
}

async function createActiveMember(
  config: IntegrationConfig,
  purpose: string,
): Promise<TestMember> {
  const serviceRoleClient = createServiceRoleSupabaseClient({
    url: config.url,
    serviceRoleKey: config.serviceRoleKey,
  });
  const suffix = uniqueSuffix();
  const email = `profile-${purpose}-${suffix}@soulbound.local`;
  const password = `Profile-${suffix}!`;
  const handle = `profile_${purpose}_${suffix}`.replace(/-/g, "_").slice(0, 24);

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
    .upsert(
      {
        id,
        handle,
        display_name: `Member ${purpose}`,
        bio: `Initial ${purpose} bio.`,
        role: "member",
        membership_status: "active",
      },
      { onConflict: "id" },
    );
  if (profileError) {
    throw profileError;
  }

  const { error: membershipError } = await serviceRoleClient
    .from("memberships")
    .insert({
      user_id: id,
      status: "active",
      tier: "basic",
    });
  if (membershipError) {
    throw membershipError;
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
    handle,
  };
}

describe("profile route handlers", () => {
  it("handles active-member read/update with persona-only responses and RLS-backed own-only writes", async () => {
    const config = readConfig();
    const member = await createActiveMember(config, "owner");
    const otherMember = await createActiveMember(config, "other");
    const serviceRoleClient = createServiceRoleSupabaseClient({
      url: config.url,
      serviceRoleKey: config.serviceRoleKey,
    });
    const ownerClient = createUserSupabaseClient({
      url: config.url,
      anonKey: config.anonKey,
      accessToken: member.accessToken,
    });

    const getResponse = await GET(
      authedRequest(member.accessToken, "/api/profile/me"),
    );
    expect(getResponse.status).toBe(200);
    const initialPersona = await getResponse.json() as Record<string, unknown>;
    expect(Object.keys(initialPersona).sort()).toEqual([
      "bio",
      "displayName",
      "handle",
    ]);
    expect(initialPersona).toEqual({
      handle: member.handle,
      displayName: "Member owner",
      bio: "Initial owner bio.",
    });

    const patchResponse = await PATCH(
      authedRequest(member.accessToken, "/api/profile/me", {
        method: "PATCH",
        body: JSON.stringify({ bio: "Updated owner bio." }),
      }),
    );
    expect(patchResponse.status).toBe(200);
    const updatedPersona = await patchResponse.json() as Record<string, unknown>;
    expect(Object.keys(updatedPersona).sort()).toEqual([
      "bio",
      "displayName",
      "handle",
    ]);
    expect(updatedPersona).toEqual({
      handle: member.handle,
      displayName: "Member owner",
      bio: "Updated owner bio.",
    });

    const unknownKeyResponse = await PATCH(
      authedRequest(member.accessToken, "/api/profile/me", {
        method: "PATCH",
        body: JSON.stringify({
          displayName: "Blocked Avatar",
          avatar_url: "https://example.com/avatar.png",
        }),
      }),
    );
    expect(unknownKeyResponse.status).toBe(422);

    const { data: crossUserRows, error: crossUserError } = await ownerClient
      .from("profiles")
      .update({ bio: "cross-user attack" })
      .eq("id", otherMember.id)
      .select("bio");
    expect(crossUserError).toBeNull();
    expect(crossUserRows).toEqual([]);

    const { data: protectedRows, error: protectedError } = await ownerClient
      .from("profiles")
      .update({
        role: "admin",
        membership_status: "suspended",
      })
      .eq("id", member.id)
      .select("role,membership_status");
    expect(protectedRows).toBeNull();
    expect(protectedError).toBeTruthy();

    const { data: ownerProfile, error: ownerReadError } = await serviceRoleClient
      .from("profiles")
      .select("bio,role,membership_status")
      .eq("id", member.id)
      .single();
    if (ownerReadError) {
      throw ownerReadError;
    }
    expect(ownerProfile).toMatchObject({
      bio: "Updated owner bio.",
      role: "member",
      membership_status: "active",
    });

    const { data: otherProfile, error: otherReadError } = await serviceRoleClient
      .from("profiles")
      .select("bio")
      .eq("id", otherMember.id)
      .single();
    if (otherReadError) {
      throw otherReadError;
    }
    expect(otherProfile).toMatchObject({
      bio: "Initial other bio.",
    });
  });
});
