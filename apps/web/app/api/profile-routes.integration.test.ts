import {
  createServiceRoleSupabaseClient,
  createUserSupabaseClient,
} from "@soulbound/adapters";
import {
  createActiveMember,
  deleteFixtureUsers,
  readIntegrationConfig,
  type TestSession,
} from "./_integration/fixtures";
import { GET, PATCH } from "./profile/me/route";

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

describe("profile route handlers", () => {
  const fixtureUsers: TestSession[] = [];

  afterEach(async () => {
    if (fixtureUsers.length === 0) {
      return;
    }

    try {
      await deleteFixtureUsers(readIntegrationConfig(), fixtureUsers);
    } finally {
      fixtureUsers.length = 0;
    }
  });

  it("handles active-member read/update with persona-only responses and RLS-backed own-only writes", async () => {
    const config = readIntegrationConfig();
    const member = await createActiveMember(config, "owner", {
      display_name: "Member owner",
      bio: "Initial owner bio.",
    });
    fixtureUsers.push(member);
    const otherMember = await createActiveMember(config, "other", {
      display_name: "Member other",
      bio: "Initial other bio.",
    });
    fixtureUsers.push(otherMember);
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
