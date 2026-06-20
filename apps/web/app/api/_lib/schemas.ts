import { z } from "zod";
import type {
  AdmissionReasonCode,
  AdmissionStatus,
} from "@soulbound/core";

const optionalString = z.string().trim().min(1).optional();
const optionalNullableString = z.string().trim().min(1).nullable().optional();
const personaClipMimeTypes = [
  "video/webm",
  "video/mp4",
  "audio/webm",
  "audio/mp4",
] as const;

const admissionStatusValues = [
  "draft",
  "submitted",
  "under_review",
  "needs_more_info",
  "approved",
  "rejected",
  "withdrawn",
  "expired",
] as const satisfies readonly [AdmissionStatus, ...AdmissionStatus[]];

const admissionReasonCodeValues = [
  "meets_phase1_policy",
  "insufficient_context",
  "mismatch_with_policy",
  "needs_identity_clarification",
  "duplicate_identity_suspected",
  "applicant_withdrew",
  "application_expired",
] as const satisfies readonly [
  AdmissionReasonCode,
  ...AdmissionReasonCode[],
];

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

export const startReviewSchema = z.object({
  idempotencyKey: z.string().trim().min(1),
});

export type StartReviewBody = z.infer<typeof startReviewSchema>;

export const reviewDecisionSchema = z.object({
  reasonCode: z.enum(admissionReasonCodeValues),
  applicantNotice: optionalString,
  reviewSummary: optionalString,
  idempotencyKey: z.string().trim().min(1),
});

export type ReviewDecisionBody = z.infer<typeof reviewDecisionSchema>;

export const reviewQueueQuerySchema = z.object({
  status: z.enum(admissionStatusValues).optional(),
  limit: z.preprocess(
    (value) => value === undefined || value === "" ? 50 : value,
    z.coerce.number().int().min(1).max(100),
  ),
  cursor: optionalString,
});

export type ReviewQueueQueryParams =
  z.infer<typeof reviewQueueQuerySchema>;

export const createPersonaClipSchema = z.object({
  contentHash: z.string()
    .trim()
    .min(8)
    .max(256)
    .regex(/^[A-Za-z0-9._:-]+$/),
  mimeType: z.enum(personaClipMimeTypes),
  durationSeconds: z.number().int().min(0).max(600).optional(),
});

export type CreatePersonaClipBody =
  z.infer<typeof createPersonaClipSchema>;

export const deletePersonaClipQuerySchema = z.object({
  assetId: z.string().uuid(),
});

export type DeletePersonaClipQuery =
  z.infer<typeof deletePersonaClipQuerySchema>;

const profileString = z.string().transform((value) => value.trim());
const nullableProfileString = profileString.transform((value) =>
  value.length > 0 ? value : null
);

export const profilePersonaPatchSchema = z.object({
  handle: nullableProfileString.optional(),
  displayName: nullableProfileString.optional(),
  bio: nullableProfileString.optional(),
}).strict().refine(
  (value) =>
    Object.prototype.hasOwnProperty.call(value, "handle")
    || Object.prototype.hasOwnProperty.call(value, "displayName")
    || Object.prototype.hasOwnProperty.call(value, "bio"),
  { message: "at least one persona field is required" },
);

export type ProfilePersonaPatchBody =
  z.infer<typeof profilePersonaPatchSchema>;
