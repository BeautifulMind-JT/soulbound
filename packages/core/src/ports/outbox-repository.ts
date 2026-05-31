/**
 * ⛔ CONTRACT-FROZEN — owned by Cowork. To change, say "unfreeze contract".
 * P0 main processes target="internal" only (INV-21 / F3).
 */
import type { EnqueueOutboxInput, OutboxEvent } from "../domain/outbox/types";

export interface OutboxRepository {
  enqueue(input: EnqueueOutboxInput): Promise<OutboxEvent>;
  claimPending(limit: number): Promise<readonly OutboxEvent[]>;
  markSucceeded(id: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
}
