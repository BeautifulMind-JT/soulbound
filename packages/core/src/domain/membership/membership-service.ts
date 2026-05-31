/**
 * ⛔ CONTRACT-FROZEN signatures — owned by Cowork.
 * Cline implements the body in Task 2. To change, say "unfreeze contract".
 */
import type { Result } from "../../application/result";
import type { AppError } from "../../application/errors";
import type { MembershipRepository } from "../../ports/membership-repository";
import type { Membership } from "./types";

export interface MembershipServiceDeps {
  readonly membershipRepo: MembershipRepository;
}

export interface MembershipService {
  getMyMembership(userId: string): Promise<Result<Membership | null, AppError>>;
}

const NOT_IMPLEMENTED = "NOT_IMPLEMENTED: implement in Cline Task 2";

export class DefaultMembershipService implements MembershipService {
  constructor(private readonly deps: MembershipServiceDeps) {}

  async getMyMembership(
    _userId: string,
  ): Promise<Result<Membership | null, AppError>> {
    throw new Error(NOT_IMPLEMENTED);
  }
}
