import { z } from "zod";
import type {
  AdmissionReasonCode,
  AdmissionStatus,
} from "@soulbound/core";

const optionalString = z.string().trim().min(1).optional();
const optionalNullableString = z.string().trim().min(1).nullable().optional();

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
