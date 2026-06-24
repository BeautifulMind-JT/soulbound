import { createServiceRoleSupabaseClient } from "@soulbound/adapters";
import {
  createActiveMember,
  createApplicant,
  deleteFixtureUsers,
  readIntegrationConfig,
  type TestSession,
  uniqueSuffix,
} from "./_integration/fixtures";
import { GET as getMemberDetail } from "./members/[handle]/route";
import { GET as getMemberDirectory } from "./members/route";

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

function routeContext(handle: string) {
  return {
    params: Promise.resolve({ handle }),
  };
}

function expectPersonaOnly(value: Record<string, unknown>): void {
  expect(Object.keys(value).sort()).toEqual([
    "bio",
    "displayName",
    "handle",
    "isMe",
  ]);
  for (const key of [
    "id",
    "role",
    "email",
    "wallet_address",
    "membership_status",
    "membership",
    "userId",
    "avatar_url",
    "statement",
    "motivation",
    "referralCode",
    "personaClipAssetId",
    "personaClipHash",
  ]) {
    expect(key in value).toBe(false);
  }
}

describe("member directory route handlers", () => {
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

  it("lists active public personas only and hides inactive or protected profile data", async () => {
    const config = readIntegrationConfig();
    const viewer = await createActiveMember(config, "directory-viewer", {
      display_name: "Directory Viewer",
      bio: "Viewer bio.",
    });
    fixtureUsers.push(viewer);
    const otherMember = await createActiveMember(config, "directory-other", {
      display_name: "Directory Other",
      bio: "Other bio.",
    });
    fixtureUsers.push(otherMember);
    const inactiveApplicant = await createApplicant(
      config,
      "directory-inactive",
    );
    fixtureUsers.push(inactiveApplicant);
    const serviceRoleClient = createServiceRoleSupabaseClient({
      url: config.url,
      serviceRoleKey: config.serviceRoleKey,
    });
    const runId = uniqueSuffix().replace(/[^a-z0-9]/g, "").slice(-8);
    const viewerHandle = `dirv_${runId}`;
    const otherHandle = `diro_${runId}`;
    const inactiveHandle = `diri_${runId}`;
    const { error: handleSetupError } = await serviceRoleClient
      .from("profiles")
      .upsert([
        { id: viewer.id, handle: viewerHandle },
        { id: otherMember.id, handle: otherHandle },
        { id: inactiveApplicant.id, handle: inactiveHandle },
      ], { onConflict: "id" });
    if (handleSetupError) {
      throw handleSetupError;
    }

    const listResponse = await getMemberDirectory(
      authedRequest(viewer.accessToken, "/api/members"),
    );
    expect(listResponse.status).toBe(200);
    const directory = await listResponse.json() as {
      readonly items: readonly Record<string, unknown>[];
      readonly nextCursor: string | null;
    };
    expect(Object.keys(directory).sort()).toEqual(["items", "nextCursor"]);
    const handles = directory.items.map((item) => item.handle);
    expect(handles).toContain(viewerHandle);
    expect(handles).toContain(otherHandle);
    expect(handles).not.toContain(inactiveHandle);
    for (const item of directory.items) {
      expectPersonaOnly(item);
    }
    expect(
      directory.items.find((item) => item.handle === viewerHandle),
    ).toMatchObject({
      handle: viewerHandle,
      displayName: "Directory Viewer",
      bio: "Viewer bio.",
      isMe: true,
    });
    expect(
      directory.items.find((item) => item.handle === otherHandle),
    ).toMatchObject({
      handle: otherHandle,
      displayName: "Directory Other",
      bio: "Other bio.",
      isMe: false,
    });

    const pagedResponse = await getMemberDirectory(
      authedRequest(viewer.accessToken, "/api/members?limit=1"),
    );
    expect(pagedResponse.status).toBe(200);
    const page = await pagedResponse.json() as {
      readonly items: readonly Record<string, unknown>[];
      readonly nextCursor: string | null;
    };
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toEqual(expect.any(String));

    const detailResponse = await getMemberDetail(
      authedRequest(viewer.accessToken, `/api/members/${otherHandle}`),
      routeContext(otherHandle),
    );
    expect(detailResponse.status).toBe(200);
    const detail = await detailResponse.json() as Record<string, unknown>;
    expectPersonaOnly(detail);
    expect(detail).toEqual({
      handle: otherHandle,
      displayName: "Directory Other",
      bio: "Other bio.",
      isMe: false,
    });

    const inactiveDetailResponse = await getMemberDetail(
      authedRequest(
        viewer.accessToken,
        `/api/members/${inactiveHandle}`,
      ),
      routeContext(inactiveHandle),
    );
    expect(inactiveDetailResponse.status).toBe(404);

    const nonMemberViewerResponse = await getMemberDirectory(
      authedRequest(inactiveApplicant.accessToken, "/api/members"),
    );
    expect(nonMemberViewerResponse.status).toBe(403);
  });
});
