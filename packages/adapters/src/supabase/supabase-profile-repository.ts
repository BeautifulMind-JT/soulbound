import type {
  ListActivePublicPersonasResult,
  Persona,
  ProfileRepository,
  PublicPersona,
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

export const publicPersonaSelect = profileSelect;

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

function mapPublicPersonaRow(row: ProfileRow): PublicPersona {
  if (!row.handle) {
    throw new Error("public persona row requires a handle");
  }
  return {
    handle: row.handle,
    displayName: row.display_name ?? null,
    bio: row.bio ?? null,
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

  async listActivePublicPersonas(input: {
    readonly limit: number;
    readonly cursor: string | null;
  }): Promise<ListActivePublicPersonasResult> {
    let query = this.client
      .from("profiles")
      .select(publicPersonaSelect)
      .not("handle", "is", null)
      .order("handle", { ascending: true })
      .limit(input.limit + 1);

    if (input.cursor) {
      query = query.gt("handle", input.cursor);
    }

    const { data, error } = await query;
    throwIfSupabaseError(error);

    const rows = ((data ?? []) as unknown as ProfileRow[])
      .map(mapPublicPersonaRow);
    const page = rows.slice(0, input.limit);

    return {
      items: page,
      nextCursor: rows.length > input.limit
        ? page[page.length - 1]?.handle ?? null
        : null,
    };
  }

  async getActivePublicPersonaByHandle(
    handle: string,
  ): Promise<PublicPersona | null> {
    const { data, error } = await this.client
      .from("profiles")
      .select(publicPersonaSelect)
      .eq("handle", handle)
      .maybeSingle();

    throwIfSupabaseError(error);
    return data ? mapPublicPersonaRow(data as unknown as ProfileRow) : null;
  }
}

export function makeUserScopedProfileRepository(
  client: SupabaseAdapterClient,
): ProfileRepository {
  return new SupabaseProfileRepository(client);
}
