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

vi.mock("../_lib/auth", () => ({
  resolveUserContext: authMocks.resolveUserContext,
}));

vi.mock("@soulbound/adapters", () => ({
  makeSupabaseMembershipRepository:
    adapterMocks.makeSupabaseMembershipRepository,
  makeUserScopedProfileRepository: adapterMocks.makeUserScopedProfileRepository,
}));

function request(path = "/api/members"): Request {
  return new Request(`http://localhost${path}`, {
    headers: {
      authorization: "Bearer token",
    },
  });
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

describe("/api/members", () => {
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
    adapterMocks.profileRepo.listActivePublicPersonas.mockResolvedValue({
      items: [
        {
          handle: "quiet_member",
          displayName: "Quiet Member",
          bio: "Signal.",
        },
        {
          handle: "other_member",
          displayName: "Other Member",
          bio: "Warm intro.",
        },
      ],
      nextCursor: "other_member",
    });
  });

  it("returns 401 without an authenticated user context", async () => {
    authMocks.resolveUserContext.mockResolvedValue(null);

    const response = await GET(request());

    expect(response.status).toBe(401);
  });

  it("requires active membership", async () => {
    adapterMocks.membershipRepo.findByUserId.mockResolvedValue(null);

    const response = await GET(request());

    expect(response.status).toBe(403);
  });

  it("returns persona-only active member rows with isMe and cursor", async () => {
    const response = await GET(request("/api/members?limit=50"));
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(["items", "nextCursor"]);
    expect(body.nextCursor).toBe("other_member");
    expect(adapterMocks.profileRepo.listActivePublicPersonas)
      .toHaveBeenCalledWith({ limit: 50, cursor: null });

    const items = body.items as Record<string, unknown>[];
    expect(items).toHaveLength(2);
    expect(Object.keys(items[0] ?? {}).sort()).toEqual([
      "bio",
      "displayName",
      "handle",
      "isMe",
    ]);
    expect(items[0]).toEqual({
      handle: "quiet_member",
      displayName: "Quiet Member",
      bio: "Signal.",
      isMe: true,
    });
    expect(items[1]).toEqual({
      handle: "other_member",
      displayName: "Other Member",
      bio: "Warm intro.",
      isMe: false,
    });
    for (const item of items) {
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
        expect(key in item).toBe(false);
      }
    }
  });

  it("rejects invalid pagination params", async () => {
    const response = await GET(request("/api/members?limit=51"));

    expect(response.status).toBe(422);
    expect(adapterMocks.profileRepo.listActivePublicPersonas)
      .not.toHaveBeenCalled();
  });
});
