import { describe, expect, it, vi } from "vitest";

import { AppError } from "../../application/errors";
import { isErr, isOk } from "../../application/result";
import type { ProfileRepository } from "../../ports/profile-repository";
import { DefaultProfileService } from "./profile-service";
import type { Persona } from "./types";

const emptyPersona: Persona = {
  handle: null,
  displayName: null,
  bio: null,
};

function makeRepo(overrides: Partial<ProfileRepository> = {}) {
  return {
    getMyPersona: vi.fn().mockResolvedValue(emptyPersona),
    updateMyPersona: vi.fn().mockResolvedValue(emptyPersona),
    listActivePublicPersonas: vi.fn().mockResolvedValue({
      items: [],
      nextCursor: null,
    }),
    getActivePublicPersonaByHandle: vi.fn().mockResolvedValue(null),
    ...overrides,
  } as unknown as {
    readonly getMyPersona: ReturnType<typeof vi.fn>;
    readonly updateMyPersona: ReturnType<typeof vi.fn>;
    readonly listActivePublicPersonas: ReturnType<typeof vi.fn>;
    readonly getActivePublicPersonaByHandle: ReturnType<typeof vi.fn>;
  } & ProfileRepository;
}

describe("ProfileService", () => {
  it("reads an empty persona", async () => {
    const repo = makeRepo();
    const svc = new DefaultProfileService({ profileRepo: repo });

    const result = await svc.getMyPersona("user-1");

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual(emptyPersona);
    }
    expect(repo.getMyPersona).toHaveBeenCalledWith("user-1");
  });

  it("normalizes valid persona updates", async () => {
    const updated: Persona = {
      handle: "member_1",
      displayName: "Member One",
      bio: "Quiet human signal.",
    };
    const repo = makeRepo({
      updateMyPersona: vi.fn().mockResolvedValue(updated),
    });
    const svc = new DefaultProfileService({ profileRepo: repo });

    const result = await svc.updateMyPersona("user-1", {
      handle: "  MEMBER_1  ",
      displayName: "  Member One  ",
      bio: "  Quiet human signal.  ",
    });

    expect(isOk(result)).toBe(true);
    expect(repo.updateMyPersona).toHaveBeenCalledWith("user-1", {
      handle: "member_1",
      displayName: "Member One",
      bio: "Quiet human signal.",
    });
  });

  it("treats empty submitted strings as an explicit clear", async () => {
    const repo = makeRepo();
    const svc = new DefaultProfileService({ profileRepo: repo });

    await svc.updateMyPersona("user-1", {
      displayName: "",
      bio: "   ",
    });

    expect(repo.updateMyPersona).toHaveBeenCalledWith("user-1", {
      displayName: null,
      bio: null,
    });
  });

  it("validates handle format and length", async () => {
    const repo = makeRepo();
    const svc = new DefaultProfileService({ profileRepo: repo });

    for (const handle of ["ab", "-abc", "abc-", "bad handle", "a".repeat(25)]) {
      const result = await svc.updateMyPersona("user-1", { handle });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe("VALIDATION");
      }
    }
    expect(repo.updateMyPersona).not.toHaveBeenCalled();
  });

  it("validates display name and bio length", async () => {
    const repo = makeRepo();
    const svc = new DefaultProfileService({ profileRepo: repo });

    const longName = await svc.updateMyPersona("user-1", {
      displayName: "n".repeat(41),
    });
    const longBio = await svc.updateMyPersona("user-1", {
      bio: "b".repeat(161),
    });

    expect(isErr(longName)).toBe(true);
    expect(isErr(longBio)).toBe(true);
    if (isErr(longName)) {
      expect(longName.error.code).toBe("VALIDATION");
    }
    if (isErr(longBio)) {
      expect(longBio.error.code).toBe("VALIDATION");
    }
    expect(repo.updateMyPersona).not.toHaveBeenCalled();
  });

  it("rejects an empty update patch", async () => {
    const repo = makeRepo();
    const svc = new DefaultProfileService({ profileRepo: repo });

    const result = await svc.updateMyPersona("user-1", {});

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe("VALIDATION");
    }
    expect(repo.updateMyPersona).not.toHaveBeenCalled();
  });

  it("maps duplicate handles to conflict", async () => {
    const repo = makeRepo({
      updateMyPersona: vi.fn().mockRejectedValue(new AppError(
        "CONFLICT",
        "duplicate key value violates unique constraint",
      )),
    });
    const svc = new DefaultProfileService({ profileRepo: repo });

    const result = await svc.updateMyPersona("user-1", { handle: "taken" });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe("CONFLICT");
    }
  });

  it("lists active public personas with a bounded cursor contract", async () => {
    const repo = makeRepo({
      listActivePublicPersonas: vi.fn().mockResolvedValue({
        items: [
          {
            handle: "member_1",
            displayName: "Member One",
            bio: "Public intro.",
          },
        ],
        nextCursor: "member_1",
      }),
    });
    const svc = new DefaultProfileService({ profileRepo: repo });

    const result = await svc.listActivePublicPersonas({
      limit: 2,
      cursor: "  MEMBER_0  ",
    });

    expect(isOk(result)).toBe(true);
    expect(repo.listActivePublicPersonas).toHaveBeenCalledWith({
      limit: 2,
      cursor: "member_0",
    });
  });

  it("rejects invalid member directory list parameters", async () => {
    const repo = makeRepo();
    const svc = new DefaultProfileService({ profileRepo: repo });

    for (const input of [
      { limit: 0 },
      { limit: 51 },
      { limit: 1.5 },
      { cursor: "bad cursor" },
    ]) {
      const result = await svc.listActivePublicPersonas(input);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe("VALIDATION");
      }
    }
    expect(repo.listActivePublicPersonas).not.toHaveBeenCalled();
  });

  it("reads an active public persona by handle", async () => {
    const repo = makeRepo({
      getActivePublicPersonaByHandle: vi.fn().mockResolvedValue({
        handle: "member_1",
        displayName: "Member One",
        bio: null,
      }),
    });
    const svc = new DefaultProfileService({ profileRepo: repo });

    const result = await svc.getActivePublicPersonaByHandle(" MEMBER_1 ");

    expect(isOk(result)).toBe(true);
    expect(repo.getActivePublicPersonaByHandle)
      .toHaveBeenCalledWith("member_1");
  });

  it("maps a missing public persona to not found", async () => {
    const repo = makeRepo();
    const svc = new DefaultProfileService({ profileRepo: repo });

    const result = await svc.getActivePublicPersonaByHandle("missing");

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });
});
