import { describe, expect, it, vi } from "vitest";
import {
  deleteOwnAccount,
  type AccountDeletionGateway,
} from "./account-deletion-service";

function gateway(overrides: Partial<AccountDeletionGateway> = {}) {
  const calls: string[] = [];
  const value: AccountDeletionGateway = {
    prepare: vi.fn(async (userId: string) => {
      calls.push(`prepare:${userId}`);
      return { personaClipAssetIds: ["clip-1"] };
    }),
    purgePersonaClips: vi.fn(async (userId: string, ids: readonly string[]) => {
      calls.push(`purge:${userId}:${ids.join(",")}`);
      return { deletedAssetIds: [...ids] };
    }),
    deleteAuthUser: vi.fn(async (userId: string) => {
      calls.push(`auth:${userId}`);
      return "deleted" as const;
    }),
    ...overrides,
  };
  return { value, calls };
}

describe("deleteOwnAccount", () => {
  it("prepares, purges Persona Clip media, then deletes the auth user", async () => {
    const { value, calls } = gateway();

    await expect(deleteOwnAccount(value, "user-1")).resolves.toEqual({
      deleted: true,
      personaClipsRemoved: 1,
    });
    expect(calls).toEqual(["prepare:user-1", "purge:user-1:clip-1", "auth:user-1"]);
  });

  it("skips the purge when there is no media", async () => {
    const { value, calls } = gateway({
      prepare: vi.fn(async () => ({ personaClipAssetIds: [] })),
    });

    await deleteOwnAccount(value, "user-1");
    expect(calls).toEqual(["auth:user-1"]);
  });

  it("does not delete the auth user when media removal fails", async () => {
    const { value } = gateway({
      purgePersonaClips: vi.fn(async () => {
        throw new Error("storage down");
      }),
    });

    await expect(deleteOwnAccount(value, "user-1")).rejects.toThrow("storage down");
    expect(value.deleteAuthUser).not.toHaveBeenCalled();
  });

  it("is idempotent when the auth user is already gone", async () => {
    const { value } = gateway({
      prepare: vi.fn(async () => ({ personaClipAssetIds: [] })),
      deleteAuthUser: vi.fn(async () => "already_deleted" as const),
    });

    await expect(deleteOwnAccount(value, "user-1")).resolves.toEqual({
      deleted: true,
      personaClipsRemoved: 0,
    });
  });
});
