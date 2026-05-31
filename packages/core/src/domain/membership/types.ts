/**
 * ⛔ CONTRACT-FROZEN — owned by Cowork. To change, say "unfreeze contract".
 */
import type { ISODateString } from "../shared/types";

export type MembershipStatus = "active" | "suspended" | "revoked";

export type MembershipTier = "basic" | "trusted" | "founding" | "admin";

export interface Membership {
  readonly id: string;
  readonly userId: string;
  readonly status: MembershipStatus;
  readonly tier: MembershipTier;
  readonly sourceApplicationId?: string;
  // migration fields — present but unused in P0 (F5). Chain-neutral (v1.3).
  readonly ledgerCredentialRef?: string;
  readonly ledgerTxRef?: string;
  readonly issuedAt: ISODateString;
  readonly expiresAt?: ISODateString;
  readonly revokedAt?: ISODateString;
}
