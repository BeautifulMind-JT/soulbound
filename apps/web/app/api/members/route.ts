import {
  DefaultProfileService,
  forbidden,
  type ListActivePublicPersonasResult,
  type PublicPersona,
} from "@soulbound/core";
import {
  makeSupabaseMembershipRepository,
  makeUserScopedProfileRepository,
} from "@soulbound/adapters";
import { resolveUserContext } from "../_lib/auth";
import {
  appErrorResponse,
  dependencyFailure,
  jsonResponse,
  resultToResponse,
  unauthorized,
  validationError,
} from "../_lib/http";
import { memberDirectoryQuerySchema } from "../_lib/schemas";

interface PublicPersonaResponse extends PublicPersona {
  readonly isMe: boolean;
}

interface MemberDirectoryResponse {
  readonly items: readonly PublicPersonaResponse[];
  readonly nextCursor: string | null;
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
  result: ListActivePublicPersonasResult,
  myHandle: string | null,
): MemberDirectoryResponse {
  return {
    items: result.items.map((persona) => ({
      handle: persona.handle,
      displayName: persona.displayName,
      bio: persona.bio,
      isMe: myHandle !== null && persona.handle === myHandle,
    })),
    nextCursor: result.nextCursor,
  };
}

export async function GET(request: Request): Promise<Response> {
  try {
    const authorized = await requireActiveProfileService(request);
    if ("response" in authorized) {
      return authorized.response;
    }

    const query = memberDirectoryQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!query.success) {
      return validationError(query.error.message);
    }

    const [myPersona, directory] = await Promise.all([
      authorized.profileService.getMyPersona(authorized.userId),
      authorized.profileService.listActivePublicPersonas({
        limit: query.data.limit,
        cursor: query.data.cursor ?? null,
      }),
    ]);
    if (!myPersona.ok) {
      return resultToResponse(myPersona);
    }
    if (!directory.ok) {
      return resultToResponse(directory);
    }

    return jsonResponse(attachIsMe(directory.value, myPersona.value.handle));
  } catch (error) {
    return dependencyFailure(error);
  }
}
