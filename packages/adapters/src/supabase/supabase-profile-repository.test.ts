import { AppError } from "@soulbound/core";
import {
  profileSelect,
  profileUpdatePayload,
} from "./supabase-profile-repository";
import { mapPostgresError } from "./errors";

describe("SupabaseProfileRepository helpers", () => {
  it("selects only pseudonymous persona columns", () => {
    expect(profileSelect.split(",")).toEqual([
      "handle",
      "display_name",
      "bio",
    ]);
    expect(profileSelect).not.toContain("avatar_url");
    expect(profileSelect).not.toContain("role");
    expect(profileSelect).not.toContain("wallet");
    expect(profileSelect).not.toContain("membership");
    expect(profileSelect).not.toContain("email");
    expect(profileSelect).not.toContain("id");
  });

  it("writes only provided persona keys for merge-style PATCH semantics", () => {
    expect(profileUpdatePayload({ bio: "hello" })).toEqual({ bio: "hello" });
    expect(profileUpdatePayload({
      handle: null,
      displayName: "Member",
    })).toEqual({
      handle: null,
      display_name: "Member",
    });

    const payload = profileUpdatePayload({
      handle: "member",
      displayName: "Member",
      bio: null,
    });
    expect(payload).toEqual({
      handle: "member",
      display_name: "Member",
      bio: null,
    });
    expect("avatar_url" in payload).toBe(false);
    expect("role" in payload).toBe(false);
    expect("membership_status" in payload).toBe(false);
    expect("wallet_address" in payload).toBe(false);
    expect("id" in payload).toBe(false);
  });

  it("maps unique handle violations to conflict", () => {
    const error = mapPostgresError({
      code: "23505",
      message: "duplicate key value violates unique constraint",
    });

    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe("CONFLICT");
  });
});
