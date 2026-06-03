import type {
  EvidenceReceipt,
  PutEvidenceInput,
  StoragePort,
} from "@soulbound/core";
import type { SupabaseAdapterClient } from "./clients";
import { dependencyFailure } from "@soulbound/core";
import { throwIfSupabaseError } from "./errors";
import { mapPersonaClipAssetToEvidenceReceipt } from "./mappers";
import type { PersonaClipAssetRow } from "./mappers";

const personaClipBucket = "persona-clips";
const signedUrlTtlSeconds = 60 * 5;

function buildObjectPath(input: PutEvidenceInput): string {
  return `${input.ownerId}/${input.contentHash}`;
}

export class SupabaseStorageAdapter implements StoragePort {
  constructor(private readonly client: SupabaseAdapterClient) {}

  async put(input: PutEvidenceInput): Promise<EvidenceReceipt> {
    const { data, error } = await this.client
      .from("persona_clip_assets")
      .insert({
        applicant_id: input.ownerId,
        application_id: input.applicationId ?? null,
        storage_provider: "supabase",
        storage_path: buildObjectPath(input),
        content_hash: input.contentHash,
        mime_type: input.mimeType,
        size_bytes: 0,
        status: input.applicationId ? "attached" : "draft",
      })
      .select("*")
      .single();

    throwIfSupabaseError(error);
    return mapPersonaClipAssetToEvidenceReceipt(data as PersonaClipAssetRow);
  }

  async getSignedUrl(evidenceId: string): Promise<string> {
    const { data: clip, error: clipError } = await this.client
      .from("persona_clip_assets")
      .select("storage_path")
      .eq("id", evidenceId)
      .maybeSingle();

    throwIfSupabaseError(clipError);

    const storagePath = (clip as { storage_path?: string } | null)?.storage_path;
    if (!storagePath) {
      throw dependencyFailure("persona clip storage path not found");
    }

    const { data, error } = await this.client.storage
      .from(personaClipBucket)
      .createSignedUrl(storagePath, signedUrlTtlSeconds);

    throwIfSupabaseError(error);

    if (!data?.signedUrl) {
      throw dependencyFailure("supabase returned no signed URL");
    }

    return data.signedUrl;
  }

  async markForDeletion(evidenceId: string): Promise<void> {
    const { error } = await this.client
      .from("persona_clip_assets")
      .update({
        delete_after: new Date().toISOString(),
        deletion_reason: "policy_cleanup",
      })
      .eq("id", evidenceId);

    throwIfSupabaseError(error);
  }
}

export function makeSupabaseStorageAdapter(
  client: SupabaseAdapterClient,
): StoragePort {
  return new SupabaseStorageAdapter(client);
}
