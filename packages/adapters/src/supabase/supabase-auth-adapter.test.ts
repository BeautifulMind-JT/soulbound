import { SupabaseAuthAdapter } from "./supabase-auth-adapter";
import type { SupabaseAdapterClient } from "./clients";

function makeClientWithSignInUser(user: {
  readonly id: string;
  readonly app_metadata?: Record<string, unknown>;
  readonly user_metadata?: Record<string, unknown>;
}): SupabaseAdapterClient {
  return {
    auth: {
      signInWithPassword: async () => ({
        data: {
          user,
        },
        error: null,
      }),
    },
    from: () => {
      throw new Error("profiles.role must not be queried by AuthPort");
    },
  } as unknown as SupabaseAdapterClient;
}

describe("SupabaseAuthAdapter", () => {
  it("reads role from trusted app metadata without querying profiles.role", async () => {
    const adapter = new SupabaseAuthAdapter(
      makeClientWithSignInUser({
        id: "user-1",
        app_metadata: {
          role: "reviewer",
        },
      }),
    );

    await expect(
      adapter.signIn({
        email: "reviewer@soulbound.local",
        password: "password123",
      }),
    ).resolves.toEqual({
      userId: "user-1",
      role: "reviewer",
    });
  });

  it("ignores user-editable user metadata role claims", async () => {
    const adapter = new SupabaseAuthAdapter(
      makeClientWithSignInUser({
        id: "user-1",
        user_metadata: {
          role: "admin",
        },
      }),
    );

    await expect(
      adapter.signIn({
        email: "applicant@soulbound.local",
        password: "password123",
      }),
    ).resolves.toEqual({
      userId: "user-1",
      role: "applicant",
    });
  });
});
