import type {
  Actor,
  AdmissionApplication,
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

export interface AdminApplication extends AdmissionApplication {
  readonly applicantEmail: string | null;
  readonly reviewerEmail?: string | null;
}

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

function serviceRoleClient() {
  const env = readWebEnv();
  return createServiceRoleSupabaseClient({
    url: env.supabaseUrl,
    serviceRoleKey: env.supabaseServiceRoleKey,
  });
}

export function serviceRoleAdmissionRepo(): AdmissionRepository {
  return makeServiceRoleAdmissionRepository(serviceRoleClient());
}

async function authUserEmail(
  client: ReturnType<typeof createServiceRoleSupabaseClient>,
  userId: string,
): Promise<string | null> {
  const { data, error } = await client.auth.admin.getUserById(userId);
  if (error) {
    throw error;
  }

  return data.user?.email ?? null;
}

export async function enrichAdminApplicationEmails(
  application: AdmissionApplication,
): Promise<AdminApplication> {
  const client = serviceRoleClient();
  const [applicantEmail, reviewerEmail] = await Promise.all([
    authUserEmail(client, application.applicantId),
    application.reviewerId
      ? authUserEmail(client, application.reviewerId)
      : Promise.resolve(null),
  ]);

  return {
    ...application,
    applicantEmail,
    ...(application.reviewerId ? { reviewerEmail } : {}),
  };
}

export async function enrichAdminQueueEmails(
  applications: readonly AdmissionApplication[],
): Promise<readonly AdminApplication[]> {
  const client = serviceRoleClient();
  return await Promise.all(applications.map(async (application) => ({
    ...application,
    applicantEmail: await authUserEmail(client, application.applicantId),
  })));
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
