import { SupabaseStorageAdapter } from "./supabase-storage-adapter";
import type { SupabaseAdapterClient } from "./clients";

interface InsertedClip {
  readonly applicant_id: string;
  readonly storage_path: string;
  readonly content_hash: string;
  readonly mime_type: string;
  readonly duration_seconds: number | null;
  readonly status: string;
  readonly deletion_reason: string | null;
  readonly delete_after: string;
}

function makeCreateUploadClient(
  inserted: InsertedClip[],
  signedPaths: string[],
): SupabaseAdapterClient {
  return {
    from: (table: string) => {
      if (table !== "persona_clip_assets") {
        throw new Error(`unexpected table: ${table}`);
      }

      return {
        insert: (value: InsertedClip) => {
          inserted.push(value);
          return {
            select: (columns: string) => {
              expect(columns).toBe("id");
              return {
                single: async () => ({
                  data: { id: "asset-1" },
                  error: null,
                }),
              };
            },
          };
        },
      };
    },
    storage: {
      from: (bucket: string) => {
        expect(bucket).toBe("persona-clips");
        return {
          createSignedUploadUrl: async (path: string) => {
            signedPaths.push(path);
            return {
              data: {
                signedUrl: `http://storage.local/upload?token=token-1&path=${encodeURIComponent(path)}`,
                path,
                token: "token-1",
              },
              error: null,
            };
          },
        };
      },
    },
  } as unknown as SupabaseAdapterClient;
}

function makeDeletionClient() {
  const calls: Array<readonly [string, string]> = [];
  const client = {
    from: (table: string) => {
      expect(table).toBe("persona_clip_assets");
      return {
        update: (value: Record<string, unknown>) => {
          expect(value.deletion_reason).toBe("policy_cleanup");
          expect(typeof value.delete_after).toBe("string");
          return {
            eq: (column: string, value: string) => {
              calls.push([column, value]);
              return {
                eq: (column2: string, value2: string) => {
                  calls.push([column2, value2]);
                  return {
                    eq: (column3: string, value3: string) => {
                      calls.push([column3, value3]);
                      return {
                        select: (columns: string) => {
                          expect(columns).toBe("id");
                          return {
                            maybeSingle: async () => ({
                              data: { id: "asset-1" },
                              error: null,
                            }),
                          };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseAdapterClient;

  return { client, calls };
}

function makeRetentionClearClient() {
  const calls: Array<readonly [string, string]> = [];
  const client = {
    from: (table: string) => {
      expect(table).toBe("persona_clip_assets");
      return {
        update: (value: Record<string, unknown>) => {
          expect(value).toEqual({
            delete_after: null,
            deletion_reason: null,
          });
          return {
            eq: (column: string, value: string) => {
              calls.push([column, value]);
              return {
                eq: (column2: string, value2: string) => {
                  calls.push([column2, value2]);
                  return {
                    eq: (column3: string, value3: string) => {
                      calls.push([column3, value3]);
                      return {
                        eq: (column4: string, value4: string) => {
                          calls.push([column4, value4]);
                          return {
                            select: (columns: string) => {
                              expect(columns).toBe("id");
                              return {
                                maybeSingle: async () => ({
                                  data: { id: "asset-1" },
                                  error: null,
                                }),
                              };
                            },
                          };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseAdapterClient;

  return { client, calls };
}

describe("SupabaseStorageAdapter", () => {
  it("creates draft persona clip rows and a plain-fetch upload contract", async () => {
    const inserted: InsertedClip[] = [];
    const signedPaths: string[] = [];
    const adapter = new SupabaseStorageAdapter(
      makeCreateUploadClient(inserted, signedPaths),
    );

    await expect(adapter.createUploadUrl({
      ownerId: "user-1",
      contentHash: "hash-1",
      mimeType: "video/webm",
      durationSeconds: 9,
    })).resolves.toEqual({
      assetId: "asset-1",
      upload: {
        url: "http://storage.local/upload?token=token-1&path=user-1%2Fhash-1",
        method: "PUT",
        headers: {
          "cache-control": "max-age=3600",
          "content-type": "video/webm",
          "x-upsert": "false",
        },
      },
    });

    expect(inserted).toHaveLength(1);
    const [insertedClip] = inserted;
    if (!insertedClip) {
      throw new Error("expected inserted persona clip row");
    }
    expect(insertedClip).toMatchObject({
      applicant_id: "user-1",
      storage_path: "user-1/hash-1",
      content_hash: "hash-1",
      mime_type: "video/webm",
      duration_seconds: 9,
      status: "draft",
      deletion_reason: null,
    });
    expect(Date.parse(insertedClip.delete_after)).not.toBeNaN();
    expect(signedPaths).toEqual(["user-1/hash-1"]);
  });

  it("marks only the caller-owned draft row for deletion", async () => {
    const { client, calls } = makeDeletionClient();
    const adapter = new SupabaseStorageAdapter(client);

    await expect(adapter.markOwnDraftForDeletion({
      ownerId: "user-1",
      assetId: "asset-1",
    })).resolves.toBe(true);

    expect(calls).toEqual([
      ["id", "asset-1"],
      ["applicant_id", "user-1"],
      ["status", "draft"],
    ]);
  });

  it("clears only the submitted attached clip retention columns", async () => {
    const { client, calls } = makeRetentionClearClient();
    const adapter = new SupabaseStorageAdapter(client);

    await expect(adapter.clearSubmittedRetention({
      ownerId: "user-1",
      assetId: "asset-1",
      applicationId: "app-1",
    })).resolves.toBe(true);

    expect(calls).toEqual([
      ["id", "asset-1"],
      ["applicant_id", "user-1"],
      ["application_id", "app-1"],
      ["status", "attached"],
    ]);
  });
});
