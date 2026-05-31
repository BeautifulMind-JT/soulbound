/**
 * ⛔ CONTRACT-FROZEN — owned by Cowork. To change, say "unfreeze contract".
 *
 * NOTE: for admission state transitions, audit rows are written INSIDE the
 * atomic rpc (see admission-repository.ts), not via this port. This port exists
 * for standalone admin actions (e.g. role.changed). INV-16: codes/ids only.
 */
import type { AuditAppendInput } from "../domain/audit/types";

export interface AuditLogRepository {
  append(input: AuditAppendInput): Promise<void>;
}
