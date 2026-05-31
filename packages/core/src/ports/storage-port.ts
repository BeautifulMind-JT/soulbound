/**
 * ⛔ CONTRACT-FROZEN — owned by Cowork. To change, say "unfreeze contract".
 * P0 implementation: SupabaseStorageAdapter only.
 */
import type { EvidenceReceipt, PutEvidenceInput } from "../domain/storage/types";

export interface StoragePort {
  put(input: PutEvidenceInput): Promise<EvidenceReceipt>;
  getSignedUrl(evidenceId: string): Promise<string>;
  markForDeletion(evidenceId: string): Promise<void>;
}
