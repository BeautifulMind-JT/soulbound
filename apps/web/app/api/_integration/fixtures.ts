import {
  createAnonSupabaseClient,
  createServiceRoleSupabaseClient,
} from "@soulbound/adapters";

declare const process: {
  readonly env: Record<string, string | undefined>;
};

export interface IntegrationConfig {
  readonly url: string;
  readonly anonKey: string;
  readonly serviceRoleKey: string;
}

export interface TestSession {
  readonly id: string;
  readonly email: string;
  readonly handle: string;
  readonly password: string;
  readonly accessToken: string;
}

interface FixtureUser {
  readonly id: string;
}

interface AuthRetryOptions {
  readonly label: string;
  readonly attempts?: number;
  readonly delayMs?: number;
  readonly perAttemptTimeoutMs?: number;
}

interface CreateActorOptions {
  readonly role: "admin" | "applicant" | "member" | "reviewer";
  readonly purpose: string;
  readonly prefix: string;
  readonly handlePrefix: string;
  readonly profile?: Record<string, unknown>;
  readonly membership?: {
    readonly status: "active" | "none" | "suspended";
    readonly tier?: "basic" | "founding" | "guardian";
  };
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

export function readIntegrationConfig(): IntegrationConfig {
  return {
    url: requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

export function uniqueSuffix(): string {
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
    || error.name === "AbortError"
    || error.message === "fetch failed"
    || error.message.includes("fetch failed")
    || error.message.includes("timed out")
  );
}

async function withTimeout<T>(
  label: string,
  timeoutMs: number,
  operation: () => Promise<T>,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export async function retryAuthFixtureOperation<T>(
  options: AuthRetryOptions,
  operation: () => Promise<T>,
): Promise<T> {
  const attempts = options.attempts ?? 4;
  const delayMs = options.delayMs ?? 250;
  const perAttemptTimeoutMs = options.perAttemptTimeoutMs ?? 10_000;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await withTimeout(
        options.label,
        perAttemptTimeoutMs,
        operation,
      );
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

export async function signInFixture(
  config: IntegrationConfig,
  email: string,
  password: string,
): Promise<Omit<TestSession, "handle">> {
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
    password,
    accessToken,
  };
}

async function createActor(
  config: IntegrationConfig,
  options: CreateActorOptions,
): Promise<TestSession> {
  const serviceRoleClient = createServiceRoleSupabaseClient({
    url: config.url,
    serviceRoleKey: config.serviceRoleKey,
  });
  const suffix = uniqueSuffix();
  const email = `${options.prefix}-${options.purpose}-${suffix}@soulbound.local`;
  const password = `${options.prefix}-${suffix}!`;
  const handle = `${options.handlePrefix}-${options.purpose}-${suffix}`.slice(0, 48);

  const { data: created, error: createError } =
    await serviceRoleClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {},
      app_metadata: {},
    });
  if (createError) {
    throw createError;
  }

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
        role: options.role,
        membership_status: options.membership?.status ?? "none",
        ...options.profile,
      },
      { onConflict: "id" },
    );
  if (profileError) {
    throw profileError;
  }

  if (options.membership?.status === "active") {
    const { error: membershipError } = await serviceRoleClient
      .from("memberships")
      .insert({
        user_id: id,
        status: "active",
        tier: options.membership.tier ?? "basic",
      });
    if (membershipError) {
      throw membershipError;
    }
  }

  const session = await signInFixture(config, email, password);
  return {
    ...session,
    handle,
  };
}

export function createApplicant(
  config: IntegrationConfig,
  purpose: string,
): Promise<TestSession> {
  return createActor(config, {
    role: "applicant",
    purpose,
    prefix: "applicant",
    handlePrefix: "applicant",
  });
}

export function createReviewer(
  config: IntegrationConfig,
  purpose: string,
): Promise<TestSession> {
  return createActor(config, {
    role: "reviewer",
    purpose,
    prefix: "reviewer",
    handlePrefix: "reviewer",
  });
}

export function createAdmin(
  config: IntegrationConfig,
  purpose: string,
): Promise<TestSession> {
  return createActor(config, {
    role: "admin",
    purpose,
    prefix: "admin",
    handlePrefix: "admin",
  });
}

export function createActiveMember(
  config: IntegrationConfig,
  purpose: string,
  profile: Record<string, unknown> = {},
): Promise<TestSession> {
  return createActor(config, {
    role: "member",
    purpose,
    prefix: "member",
    handlePrefix: "member",
    profile,
    membership: {
      status: "active",
      tier: "basic",
    },
  });
}

export async function deleteFixtureUsers(
  config: IntegrationConfig,
  users: readonly FixtureUser[],
): Promise<void> {
  const serviceRoleClient = createServiceRoleSupabaseClient({
    url: config.url,
    serviceRoleKey: config.serviceRoleKey,
  });

  const ids = [...new Set(users.map((user) => user.id))];
  for (const id of ids) {
    const { error } = await serviceRoleClient.auth.admin.deleteUser(id);
    if (error) {
      throw error;
    }
  }
}
