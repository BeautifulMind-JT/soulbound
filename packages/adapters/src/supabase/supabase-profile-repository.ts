import type {
  Persona,
  ProfileRepository,
  UpdatePersonaInput,
} from "@soulbound/core";
import type { SupabaseAdapterClient } from "./clients";
import { throwIfSupabaseError } from "./errors";
import { mapProfileRow, type ProfileRow } from "./mappers";

export const profileSelect = [
  "handle",
  "display_name",
  "bio",
].join(",");

function hasOwn<K extends string>(
  input: UpdatePersonaInput,
  key: K,
): input is UpdatePersonaInput & Record<K, string | null | undefined> {
  return Object.prototype.hasOwnProperty.call(input, key);
}

export function profileUpdatePayload(
  input: UpdatePersonaInput,
): Record<string, string | null> {
  return {
    ...(hasOwn(input, "handle") ? { handle: input.handle ?? null } : {}),
    ...(hasOwn(input, "displayName")
      ? { display_name: input.displayName ?? null }
      : {}),
    ...(hasOwn(input, "bio") ? { bio: input.bio ?? null } : {}),
  };
}

export class SupabaseProfileRepository implements ProfileRepository {
  constructor(private readonly client: SupabaseAdapterClient) {}

  async getMyPersona(userId: string): Promise<Persona> {
    const { data, error } = await this.client
      .from("profiles")
      .select(profileSelect)
      .eq("id", userId)
      .single();

    throwIfSupabaseError(error);
    return mapProfileRow(data as unknown as ProfileRow);
  }

  async updateMyPersona(
    userId: string,
    input: UpdatePersonaInput,
  ): Promise<Persona> {
    const { data, error } = await this.client
      .from("profiles")
      .update(profileUpdatePayload(input))
      .eq("id", userId)
      .select(profileSelect)
      .single();

    throwIfSupabaseError(error);
    return mapProfileRow(data as unknown as ProfileRow);
  }
}

export function makeUserScopedProfileRepository(
  client: SupabaseAdapterClient,
): ProfileRepository {
  return new SupabaseProfileRepository(client);
}
