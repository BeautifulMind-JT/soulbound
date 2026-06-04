import { submitApplicationSchema } from "./schemas";

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
