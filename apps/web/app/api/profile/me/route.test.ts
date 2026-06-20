import { AppError } from "@soulbound/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PATCH } from "./route";

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

function request(method = "GET", body?: unknown): Request {
  return new Request("http://localhost/api/profile/me", {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    headers: {
      authorization: "Bearer token",
      "content-type": "application/json",
    },
  });
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

describe("/api/profile/me", () => {
  beforeEach(() => {
    authMocks.resolveUserContext.mockReset();
    adapterMocks.membershipRepo.findByUserId.mockReset();
    adapterMocks.profileRepo.getMyPersona.mockReset();
    adapterMocks.profileRepo.updateMyPersona.mockReset();
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
      handle: "member",
      displayName: "Member",
      bio: "Quiet signal.",
    });
    adapterMocks.profileRepo.updateMyPersona.mockResolvedValue({
      handle: "member",
      displayName: "Member",
      bio: "Updated.",
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

  it("returns persona-only response keys", async () => {
    const response = await GET(request());
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual([
      "bio",
      "displayName",
      "handle",
    ]);
    expect(body).toEqual({
      handle: "member",
      displayName: "Member",
      bio: "Quiet signal.",
    });
    for (const key of [
      "id",
      "role",
      "email",
      "wallet_address",
      "membership_status",
      "membership",
      "userId",
    ]) {
      expect(key in body).toBe(false);
    }
  });

  it("rejects avatar and protected fields in PATCH", async () => {
    const response = await PATCH(request("PATCH", {
      avatar_url: "https://example.com/me.png",
      displayName: "Member",
    }));

    expect(response.status).toBe(422);
    expect(adapterMocks.profileRepo.updateMyPersona).not.toHaveBeenCalled();
  });

  it("updates persona fields and returns persona-only keys", async () => {
    const response = await PATCH(request("PATCH", {
      bio: "Updated.",
    }));
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(adapterMocks.profileRepo.updateMyPersona).toHaveBeenCalledWith(
      "user-1",
      { bio: "Updated." },
    );
    expect(Object.keys(body).sort()).toEqual([
      "bio",
      "displayName",
      "handle",
    ]);
  });

  it("maps duplicate handles to 409", async () => {
    adapterMocks.profileRepo.updateMyPersona.mockRejectedValue(
      new AppError("CONFLICT", "duplicate"),
    );

    const response = await PATCH(request("PATCH", { handle: "taken" }));

    expect(response.status).toBe(409);
  });
});
