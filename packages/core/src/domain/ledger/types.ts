/**
 * ⛔ CONTRACT-FROZEN — owned by Cowork. To change, say "unfreeze contract".
 *
 * P0 main implementation of LedgerPort is NoopLedgerAdapter ONLY.
 * Every Noop call returns { status: "skipped" }. (INV-21)
 *
 * CHAIN-NEUTRAL (v1.3): no concrete chain is named. `LedgerChain` is "external"
 * (some future settlement ledger, chosen on an option branch) or "none".
 */

export type LedgerChain = "none" | "external";

export interface ChainReceipt {
  readonly chain: LedgerChain;
  readonly txRef?: string;
  readonly objectRef?: string;
  readonly status: "succeeded" | "failed" | "skipped";
  readonly raw?: unknown;
}

export interface IssueAdmissionTicketInput {
  readonly applicationId: string;
  readonly applicantId: string;
  readonly walletAddress?: string;
  readonly policyVersion: string;
  readonly idempotencyKey: string;
}

export interface IssueMembershipCredentialInput {
  readonly userId: string;
  readonly applicationId: string;
  readonly walletAddress?: string;
  readonly idempotencyKey: string;
}

/**
 * Activation stake issuance. NOT liquid SOUL. NOT a reward. NOT an airdrop.
 * Records/issues locked Activation SOUL as DefaultStakedSoul only, funded by
 * previously-collected Review Tolls or protocol reserves — never freshly minted.
 * (Renamed from grantSoul in v1.3 to remove reward/airdrop connotation.)
 */
export interface IssueActivationStakeInput {
  readonly userId: string;
  readonly applicationId: string;
  readonly amount: string;
  readonly reasonCode: string;
  readonly idempotencyKey: string;
}
