/**
 * ⛔ CONTRACT-FROZEN — owned by Cowork. To change, say "unfreeze contract".
 *
 * P0 implementation: SupabaseStorageAdapter only. The migration fields
 * (ipfsCid / filecoinDealId / arweaveTxId) are present but unused in P0 (F5).
 * Core never touches raw bytes — that is an adapter concern.
 */

export type StorageProvider = "supabase" | "ipfs" | "filecoin" | "arweave";

export interface PutEvidenceInput {
  readonly ownerId: string;
  readonly applicationId?: string;
  readonly mimeType: string;
  readonly retentionPolicy: string;
  readonly contentHash: string;
}

export interface EvidenceReceipt {
  readonly id: string;
  readonly provider: StorageProvider;
  readonly objectPath?: string;
  readonly contentHash: string;
  readonly sizeBytes: number;
  readonly ipfsCid?: string;
  readonly filecoinDealId?: string;
  readonly arweaveTxId?: string;
}
