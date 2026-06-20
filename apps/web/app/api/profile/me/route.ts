import {
  DefaultProfileService,
  forbidden,
  type UpdatePersonaInput,
} from "@soulbound/core";
import {
  makeSupabaseMembershipRepository,
  makeUserScopedProfileRepository,
} from "@soulbound/adapters";
import { resolveUserContext } from "../../_lib/auth";
import {
  appErrorResponse,
  dependencyFailure,
  resultToResponse,
  unauthorized,
  validationError,
} from "../../_lib/http";
import { profilePersonaPatchSchema } from "../../_lib/schemas";
import type { ProfilePersonaPatchBody } from "../../_lib/schemas";

function toUpdatePersonaInput(
  body: ProfilePersonaPatchBody,
): UpdatePersonaInput {
  return {
    ...(Object.prototype.hasOwnProperty.call(body, "handle")
      ? { handle: body.handle ?? null }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(body, "displayName")
      ? { displayName: body.displayName ?? null }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(body, "bio")
      ? { bio: body.bio ?? null }
      : {}),
  };
}

async function requireActiveProfileService(request: Request) {
  const context = await resolveUserContext(request);
  if (!context) {
    return { response: unauthorized() } as const;
  }

  const membership =
    await makeSupabaseMembershipRepository(context.client)
      .findByUserId(context.userId);
  if (membership?.status !== "active") {
    return {
      response: appErrorResponse(forbidden("active membership required")),
    } as const;
  }

  return {
    userId: context.userId,
    profileService: new DefaultProfileService({
      profileRepo: makeUserScopedProfileRepository(context.client),
    }),
  } as const;
}

export async function GET(request: Request): Promise<Response> {
  try {
    const authorized = await requireActiveProfileService(request);
    if ("response" in authorized) {
      return authorized.response;
    }

    const result =
      await authorized.profileService.getMyPersona(authorized.userId);
    return resultToResponse(result);
  } catch (error) {
    return dependencyFailure(error);
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const authorized = await requireActiveProfileService(request);
    if ("response" in authorized) {
      return authorized.response;
    }

    const parsed = profilePersonaPatchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return validationError(parsed.error.message);
    }

    const result = await authorized.profileService.updateMyPersona(
      authorized.userId,
      toUpdatePersonaInput(parsed.data),
    );
    return resultToResponse(result);
  } catch (error) {
    return dependencyFailure(error);
  }
}
