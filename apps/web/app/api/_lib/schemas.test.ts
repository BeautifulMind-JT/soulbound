import {
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
