import type {
  Actor,
  AdmissionRepository,
  ReviewDecisionCommand,
} from "@soulbound/core";
import {
  createServiceRoleSupabaseClient,
  makeServiceRoleAdmissionRepository,
} from "@soulbound/adapters";
import { readWebEnv } from "./env";
import { jsonResponse } from "./http";
import type { ReviewDecisionBody } from "./schemas";

export function requireReviewer(actor: Actor): Response | null {
  if (actor.role === "reviewer" || actor.role === "admin") {
    return null;
  }

  return jsonResponse({
    error: {
      code: "FORBIDDEN",
      message: "reviewer role required",
    },
  }, 403);
}

export function serviceRoleAdmissionRepo(): AdmissionRepository {
  const env = readWebEnv();
  const client = createServiceRoleSupabaseClient({
    url: env.supabaseUrl,
    serviceRoleKey: env.supabaseServiceRoleKey,
  });

  return makeServiceRoleAdmissionRepository(client);
}

export function reviewDecisionOptionalProps(
  body: ReviewDecisionBody,
): Pick<ReviewDecisionCommand, "applicantNotice" | "reviewSummary"> {
  return {
    ...(body.applicantNotice !== undefined
      ? { applicantNotice: body.applicantNotice }
      : {}),
    ...(body.reviewSummary !== undefined
      ? { reviewSummary: body.reviewSummary }
      : {}),
  };
}
