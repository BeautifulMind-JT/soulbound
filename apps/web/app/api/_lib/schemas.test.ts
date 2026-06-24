import {
  createPersonaClipSchema,
  deletePersonaClipQuerySchema,
  memberDirectoryQuerySchema,
  memberHandleSchema,
  profilePersonaPatchSchema,
  reviewDecisionSchema,
  reviewQueueQuerySchema,
  startReviewSchema,
  submitApplicationSchema,
} from "./schemas";

describe("submitApplicationSchema", () => {
  it("requires an idempotency key", () => {
    const parsed = submitApplicationSchema.safeParse({
      motivation: "hello",
    });

    expect(parsed.success).toBe(false);
  });

  it("strips caller-supplied applicantId so routes use the actor", () => {
    const parsed = submitApplicationSchema.parse({
      applicantId: "not-the-actor",
      idempotencyKey: "idem",
      motivation: "hello",
    });

    expect("applicantId" in parsed).toBe(false);
    expect(parsed.idempotencyKey).toBe("idem");
  });
});

describe("admin route schemas", () => {
  it("validates review start and decision bodies", () => {
    expect(startReviewSchema.parse({ idempotencyKey: "review-1" }))
      .toEqual({ idempotencyKey: "review-1" });

    expect(reviewDecisionSchema.parse({
      reasonCode: "meets_phase1_policy",
      reviewSummary: "internal",
      idempotencyKey: "approve-1",
    })).toEqual({
      reasonCode: "meets_phase1_policy",
      reviewSummary: "internal",
      idempotencyKey: "approve-1",
    });
  });

  it("rejects unknown reason codes and statuses", () => {
    expect(reviewDecisionSchema.safeParse({
      reasonCode: "free_text_reason",
      idempotencyKey: "bad-reason",
    }).success).toBe(false);

    expect(reviewQueueQuerySchema.safeParse({
      status: "not_a_status",
    }).success).toBe(false);
  });

  it("coerces and bounds review queue query params", () => {
    expect(reviewQueueQuerySchema.parse({})).toEqual({ limit: 50 });
    expect(reviewQueueQuerySchema.parse({
      status: "submitted",
      limit: "25",
      cursor: "2026-01-01T00:00:00.000Z",
    })).toEqual({
      status: "submitted",
      limit: 25,
      cursor: "2026-01-01T00:00:00.000Z",
    });
    expect(reviewQueueQuerySchema.safeParse({ limit: "101" }).success)
      .toBe(false);
  });
});

describe("persona clip schemas", () => {
  it("accepts supported private-bucket mime types", () => {
    expect(createPersonaClipSchema.parse({
      contentHash: "abc12345",
      mimeType: "video/webm",
      durationSeconds: 12,
    })).toEqual({
      contentHash: "abc12345",
      mimeType: "video/webm",
      durationSeconds: 12,
    });
  });

  it("rejects path-like hashes and unsupported mime types", () => {
    expect(createPersonaClipSchema.safeParse({
      contentHash: "../abc12345",
      mimeType: "video/webm",
    }).success).toBe(false);

    expect(createPersonaClipSchema.safeParse({
      contentHash: "abc12345",
      mimeType: "image/png",
    }).success).toBe(false);
  });

  it("validates persona clip delete query params", () => {
    expect(deletePersonaClipQuerySchema.parse({
      assetId: "11111111-1111-4111-8111-111111111111",
    })).toEqual({
      assetId: "11111111-1111-4111-8111-111111111111",
    });
    expect(deletePersonaClipQuerySchema.safeParse({
      assetId: "not-a-uuid",
    }).success).toBe(false);
  });
});

describe("member directory schemas", () => {
  it("coerces bounded list query params and normalizes handles", () => {
    expect(memberDirectoryQuerySchema.parse({})).toEqual({ limit: 50 });
    expect(memberDirectoryQuerySchema.parse({
      limit: "25",
      cursor: "member_1",
    })).toEqual({
      limit: 25,
      cursor: "member_1",
    });
    expect(memberDirectoryQuerySchema.safeParse({ limit: "51" }).success)
      .toBe(false);
    expect(memberHandleSchema.parse("  Member-1 ")).toBe("member-1");
    expect(memberHandleSchema.safeParse("bad handle").success).toBe(false);
  });
});

describe("profile persona schema", () => {
  it("accepts partial persona patches and normalizes empty strings to null", () => {
    expect(profilePersonaPatchSchema.parse({
      handle: "  Member_1 ",
      bio: "   ",
    })).toEqual({
      handle: "Member_1",
      bio: null,
    });
  });

  it("rejects empty patches and non-persona fields", () => {
    expect(profilePersonaPatchSchema.safeParse({}).success).toBe(false);
    expect(profilePersonaPatchSchema.safeParse({
      avatar_url: "https://example.com/avatar.png",
    }).success).toBe(false);
    expect(profilePersonaPatchSchema.safeParse({
      display_name: "snake case is not the API",
    }).success).toBe(false);
    expect(profilePersonaPatchSchema.safeParse({
      role: "admin",
      displayName: "Member",
    }).success).toBe(false);
  });
});
