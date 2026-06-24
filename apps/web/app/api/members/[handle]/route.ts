import {
  DefaultProfileService,
  forbidden,
  type PublicPersona,
} from "@soulbound/core";
import {
  makeSupabaseMembershipRepository,
  makeUserScopedProfileRepository,
} from "@soulbound/adapters";
import { resolveUserContext } from "../../_lib/auth";
import {
  appErrorResponse,
  dependencyFailure,
  jsonResponse,
  resultToResponse,
  unauthorized,
  validationError,
} from "../../_lib/http";
import { memberHandleSchema } from "../../_lib/schemas";

interface RouteContext {
  readonly params: Promise<{
    readonly handle: string;
  }>;
}

interface PublicPersonaResponse extends PublicPersona {
  readonly isMe: boolean;
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

function attachIsMe(
  persona: PublicPersona,
  myHandle: string | null,
): PublicPersonaResponse {
  return {
    handle: persona.handle,
    displayName: persona.displayName,
    bio: persona.bio,
    isMe: myHandle !== null && persona.handle === myHandle,
  };
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const authorized = await requireActiveProfileService(request);
    if ("response" in authorized) {
      return authorized.response;
    }

    const params = await context.params;
    const handle = memberHandleSchema.safeParse(
      decodeURIComponent(params.handle),
    );
    if (!handle.success) {
      return validationError(handle.error.message);
    }

    const [myPersona, memberPersona] = await Promise.all([
      authorized.profileService.getMyPersona(authorized.userId),
      authorized.profileService.getActivePublicPersonaByHandle(handle.data),
    ]);
    if (!myPersona.ok) {
      return resultToResponse(myPersona);
    }
    if (!memberPersona.ok) {
      return resultToResponse(memberPersona);
    }

    return jsonResponse(attachIsMe(memberPersona.value, myPersona.value.handle));
  } catch (error) {
    return dependencyFailure(error);
  }
}
