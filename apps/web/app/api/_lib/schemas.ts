import { z } from "zod";

const optionalString = z.string().trim().min(1).optional();
const optionalNullableString = z.string().trim().min(1).nullable().optional();

export const submitApplicationSchema = z.object({
  applicantStatement: optionalString,
  motivation: optionalString,
  referralCode: optionalString,
  personaClipAssetId: optionalNullableString,
  personaClipHash: optionalNullableString,
  idempotencyKey: z.string().trim().min(1),
});

export type SubmitApplicationBody =
  z.infer<typeof submitApplicationSchema>;
