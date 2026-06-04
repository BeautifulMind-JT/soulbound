import type { SubmitApplicationCommand } from "@soulbound/core";
import { resolveActor } from "../../_lib/auth";
import { getContainer } from "../../_lib/container";
import {
  dependencyFailure,
  resultToResponse,
  unauthorized,
  validationError,
} from "../../_lib/http";
import { submitApplicationSchema } from "../../_lib/schemas";
import type { SubmitApplicationBody } from "../../_lib/schemas";

function optionalProps(
  body: SubmitApplicationBody,
): Omit<SubmitApplicationCommand, "applicantId" | "idempotencyKey"> {
  return {
    ...(body.applicantStatement !== undefined
      ? { applicantStatement: body.applicantStatement }
      : {}),
    ...(body.motivation !== undefined
      ? { motivation: body.motivation }
      : {}),
    ...(body.referralCode !== undefined
      ? { referralCode: body.referralCode }
      : {}),
    ...(body.personaClipAssetId !== undefined
      ? { personaClipAssetId: body.personaClipAssetId }
      : {}),
    ...(body.personaClipHash !== undefined
      ? { personaClipHash: body.personaClipHash }
      : {}),
  };
}

export async function POST(request: Request): Promise<Response> {
  try {
    const actor = await resolveActor(request);
    if (!actor) {
      return unauthorized();
    }

    const parsed = submitApplicationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return validationError(parsed.error.message);
    }

    const result = await getContainer().admissionService.submitApplication({
      applicantId: actor.id,
      idempotencyKey: parsed.data.idempotencyKey,
      ...optionalProps(parsed.data),
    });

    return resultToResponse(result, 201);
  } catch (error) {
    return dependencyFailure(error);
  }
}
