/**
 * ⛔ CONTRACT-FROZEN — owned by Cowork. To change, say "unfreeze contract".
 * Membership creation happens inside approveApplicationTx (atomic). This port
 * is for reads in P0.
 */
import type { Membership } from "../domain/membership/types";

export interface MembershipRepository {
  findByUserId(userId: string): Promise<Membership | null>;
}
