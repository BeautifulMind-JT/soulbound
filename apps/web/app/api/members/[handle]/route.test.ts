import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const authMocks = vi.hoisted(() => ({
  resolveUserContext: vi.fn(),
}));

const adapterMocks = vi.hoisted(() => ({
  membershipRepo: {
    findByUserId: vi.fn(),
  },
  profileRepo: {
    getMyPersona: vi.fn(),
    updateMyPersona: vi.fn(),
    listActivePublicPersonas: vi.fn(),
    getActivePublicPersonaByHandle: vi.fn(),
  },
  makeSupabaseMembershipRepository: vi.fn(),
  makeUserScopedProfileRepository: vi.fn(),
}));

vi.mock("../../_lib/auth", () => ({
  resolveUserContext: authMocks.resolveUserContext,
}));

vi.mock("@soulbound/adapters", () => ({
  makeSupabaseMembershipRepository:
    adapterMocks.makeSupabaseMembershipRepository,
  makeUserScopedProfileRepository: adapterMocks.makeUserScopedProfileRepository,
}));

function request(handle = "other_member"): Request {
  return new Request(`http://localhost/api/members/${handle}`, {
    headers: {
      authorization: "Bearer token",
    },
  });
}

function context(handle = "other_member") {
  return {
    params: Promise.resolve({ handle }),
  };
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

describe("/api/members/[handle]", () => {
  beforeEach(() => {
    authMocks.resolveUserContext.mockReset();
    adapterMocks.membershipRepo.findByUserId.mockReset();
    adapterMocks.profileRepo.getMyPersona.mockReset();
    adapterMocks.profileRepo.updateMyPersona.mockReset();
    adapterMocks.profileRepo.listActivePublicPersonas.mockReset();
    adapterMocks.profileRepo.getActivePublicPersonaByHandle.mockReset();
    adapterMocks.makeSupabaseMembershipRepository.mockReset()
      .mockReturnValue(adapterMocks.membershipRepo);
    adapterMocks.makeUserScopedProfileRepository.mockReset()
      .mockReturnValue(adapterMocks.profileRepo);
    authMocks.resolveUserContext.mockResolvedValue({
      userId: "user-1",
      client: {},
    });
    adapterMocks.membershipRepo.findByUserId.mockResolvedValue({
      id: "membership-1",
      userId: "user-1",
      status: "active",
      tier: "basic",
      issuedAt: "2026-06-20T00:00:00.000Z",
    });
    adapterMocks.profileRepo.getMyPersona.mockResolvedValue({
      handle: "quiet_member",
      displayName: "Quiet Member",
      bio: "Signal.",
    });
    adapterMocks.profileRepo.getActivePublicPersonaByHandle.mockResolvedValue({
      handle: "other_member",
      displayName: "Other Member",
      bio: "Warm intro.",
    });
  });

  it("returns 401 without an authenticated user context", async () => {
    authMocks.resolveUserContext.mockResolvedValue(null);

    const response = await GET(request(), context());

    expect(response.status).toBe(401);
  });

  it("requires active membership", async () => {
    adapterMocks.membershipRepo.findByUserId.mockResolvedValue(null);

    const response = await GET(request(), context());

    expect(response.status).toBe(403);
  });

  it("returns persona-only detail for an active public persona", async () => {
    const response = await GET(request("Other_Member"), context("Other_Member"));
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(adapterMocks.profileRepo.getActivePublicPersonaByHandle)
      .toHaveBeenCalledWith("other_member");
    expect(Object.keys(body).sort()).toEqual([
      "bio",
      "displayName",
      "handle",
      "isMe",
    ]);
    expect(body).toEqual({
      handle: "other_member",
      displayName: "Other Member",
      bio: "Warm intro.",
      isMe: false,
    });
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
    ]) {
      expect(key in body).toBe(false);
    }
  });

  it("returns the same 404 for missing or non-public persona rows", async () => {
    adapterMocks.profileRepo.getActivePublicPersonaByHandle.mockResolvedValue(
      null,
    );

    const response = await GET(request("missing_member"), context(
      "missing_member",
    ));

    expect(response.status).toBe(404);
  });

  it("rejects invalid handles", async () => {
    const response = await GET(request("bad.handle"), context("bad.handle"));

    expect(response.status).toBe(422);
    expect(adapterMocks.profileRepo.getActivePublicPersonaByHandle)
      .not.toHaveBeenCalled();
  });
});
