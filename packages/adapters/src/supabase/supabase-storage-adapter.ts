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
const draftDeleteAfterMs = 24 * 60 * 60 * 1000;
const signedUploadCacheControlSeconds = 3600;

export interface CreatePersonaClipUploadUrlInput {
  readonly ownerId: string;
  readonly contentHash: string;
  readonly mimeType: string;
  readonly durationSeconds?: number;
}

export interface PersonaClipUploadContract {
  readonly url: string;
  readonly method: "PUT";
  readonly headers: Readonly<Record<string, string>>;
}

export interface PersonaClipUploadUrl {
  readonly assetId: string;
  readonly upload: PersonaClipUploadContract;
}

export interface MarkOwnDraftForDeletionInput {
  readonly ownerId: string;
  readonly assetId: string;
}

export interface ClearSubmittedPersonaClipRetentionInput {
  readonly ownerId: string;
  readonly assetId: string;
  readonly applicationId: string;
}

function buildObjectPath(input: PutEvidenceInput): string {
  return `${input.ownerId}/${input.contentHash}`;
}

function buildUploadObjectPath(input: CreatePersonaClipUploadUrlInput): string {
  return `${input.ownerId}/${input.contentHash}`;
}

function draftDeleteAfter(): string {
  return new Date(Date.now() + draftDeleteAfterMs).toISOString();
}

export class SupabaseStorageAdapter implements StoragePort {
  constructor(private readonly client: SupabaseAdapterClient) {}

  async createUploadUrl(
    input: CreatePersonaClipUploadUrlInput,
  ): Promise<PersonaClipUploadUrl> {
    const storagePath = buildUploadObjectPath(input);
    const { data: clip, error: clipError } = await this.client
      .from("persona_clip_assets")
      .insert({
        applicant_id: input.ownerId,
        application_id: null,
        storage_provider: "supabase",
        storage_path: storagePath,
        content_hash: input.contentHash,
        mime_type: input.mimeType,
        size_bytes: 0,
        duration_seconds: input.durationSeconds ?? null,
        status: "draft",
        deletion_reason: null,
        delete_after: draftDeleteAfter(),
      })
      .select("id")
      .single();

    throwIfSupabaseError(clipError);

    const assetId = (clip as { id?: string } | null)?.id;
    if (!assetId) {
      throw dependencyFailure("supabase returned no persona clip asset id");
    }

    const { data, error } = await this.client.storage
      .from(personaClipBucket)
      .createSignedUploadUrl(storagePath);

    throwIfSupabaseError(error);

    if (!data?.signedUrl) {
      throw dependencyFailure("supabase returned no signed upload URL");
    }

    // Supabase's signed-upload endpoint accepts a plain fetch PUT to signedUrl.
    // This mirrors storage-js uploadToSignedUrl's raw-body branch, without
    // requiring the browser to import the Supabase SDK.
    return {
      assetId,
      upload: {
        url: data.signedUrl,
        method: "PUT",
        headers: {
          "cache-control": `max-age=${signedUploadCacheControlSeconds}`,
          "content-type": input.mimeType,
          "x-upsert": "false",
        },
      },
    };
  }

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

  async markOwnDraftForDeletion(
    input: MarkOwnDraftForDeletionInput,
  ): Promise<boolean> {
    const { data, error } = await this.client
      .from("persona_clip_assets")
      .update({
        delete_after: new Date().toISOString(),
        deletion_reason: "policy_cleanup",
      })
      .eq("id", input.assetId)
      .eq("applicant_id", input.ownerId)
      .eq("status", "draft")
      .select("id")
      .maybeSingle();

    throwIfSupabaseError(error);
    return Boolean((data as { id?: string } | null)?.id);
  }

  async clearSubmittedRetention(
    input: ClearSubmittedPersonaClipRetentionInput,
  ): Promise<boolean> {
    const { data, error } = await this.client
      .from("persona_clip_assets")
      .update({
        delete_after: null,
        deletion_reason: null,
      })
      .eq("id", input.assetId)
      .eq("applicant_id", input.ownerId)
      .eq("application_id", input.applicationId)
      .eq("status", "attached")
      .select("id")
      .maybeSingle();

    throwIfSupabaseError(error);
    return Boolean((data as { id?: string } | null)?.id);
  }
}

export function makeSupabaseStorageAdapter(
  client: SupabaseAdapterClient,
): SupabaseStorageAdapter {
  return new SupabaseStorageAdapter(client);
}
