export interface AccountDeletionGateway {
  prepare(userId: string): Promise<{
    readonly personaClipAssetIds: readonly string[];
  }>;
  purgePersonaClips(
    userId: string,
    assetIds: readonly string[],
  ): Promise<{ readonly deletedAssetIds: readonly string[] }>;
  deleteAuthUser(userId: string): Promise<"deleted" | "already_deleted">;
}

export interface AccountDeletionResult {
  readonly deleted: true;
  readonly personaClipsRemoved: number;
}

// Order matters for retry safety: (1) codes-only audit + dossier shredding,
// (2) raw Persona Clip bytes via StoragePort path, (3) auth user deletion,
// which cascades every owned row. Any failure aborts before step 3.
export async function deleteOwnAccount(
  gateway: AccountDeletionGateway,
  userId: string,
): Promise<AccountDeletionResult> {
  const prepared = await gateway.prepare(userId);
  let personaClipsRemoved = 0;
  if (prepared.personaClipAssetIds.length > 0) {
    const purged = await gateway.purgePersonaClips(
      userId,
      prepared.personaClipAssetIds,
    );
    personaClipsRemoved = purged.deletedAssetIds.length;
  }
  await gateway.deleteAuthUser(userId);
  return { deleted: true, personaClipsRemoved };
}
