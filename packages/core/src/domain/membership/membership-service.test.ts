/**
 * ⛔ CONTRACT-FROZEN TESTS — owned by Cowork.
 * Cline must NOT edit assertions, .skip, or .todo these. Implement bodies until green.
 */
import { describe, expect, it, vi } from "vitest";

import { DefaultMembershipService } from "./membership-service";
import { isOk } from "../../application/result";
import { makeMembership } from "../../test-support/mock-ports";
import type { MembershipRepository } from "../../ports/membership-repository";

describe("MembershipService.getMyMembership", () => {
  it("returns the membership when one exists", async () => {
    const repo = {
      findByUserId: vi.fn().mockResolvedValue(makeMembership({ status: "active" })),
    } as unknown as MembershipRepository;

    const svc = new DefaultMembershipService({ membershipRepo: repo });
    const res = await svc.getMyMembership("user-1");

    expect(isOk(res)).toBe(true);
    if (isOk(res)) {
      expect(res.value?.status).toBe("active");
      expect(res.value?.tier).toBe("basic");
    }
  });

  it("returns Ok(null) when the user has no membership", async () => {
    const repo = {
      findByUserId: vi.fn().mockResolvedValue(null),
    } as unknown as MembershipRepository;

    const svc = new DefaultMembershipService({ membershipRepo: repo });
    const res = await svc.getMyMembership("user-2");

    expect(isOk(res)).toBe(true);
    if (isOk(res)) expect(res.value).toBeNull();
  });
});
