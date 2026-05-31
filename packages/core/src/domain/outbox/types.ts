/**
 * ⛔ CONTRACT-FROZEN — owned by Cowork. To change, say "unfreeze contract".
 *
 * P0 main branch processes `internal` only. `external_ledger` is activated solely
 * on the option branch (Task 10) and is chain-neutral (no concrete chain named).
 * `icp` / `filecoin` / `arweave` are schema-level placeholders across all of P0 (F3).
 * INV-16: payload carries codes/ids/refs only — never raw plaintext or keys.
 */
import type { ISODateString } from "../shared/types";

export type OutboxTarget =
  | "internal"
  | "external_ledger"
  | "icp"
  | "filecoin"
  | "arweave";

export type OutboxStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "failed"
  | "dead_letter";

export interface OutboxEvent {
  readonly id: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
  readonly target: OutboxTarget;
  readonly status: OutboxStatus;
  readonly idempotencyKey: string;
  readonly attemptCount: number;
  readonly lastError?: string;
  readonly processedAt?: ISODateString;
  readonly createdAt: ISODateString;
}

export interface EnqueueOutboxInput {
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
  readonly target: OutboxTarget;
  readonly idempotencyKey: string;
}
