import { AppError, conflict, notFound, validation } from "../../application/errors";
import { err, ok, type Result } from "../../application/result";
import type { ProfileRepository } from "../../ports/profile-repository";
import type {
  ListActivePublicPersonasInput,
  ListActivePublicPersonasResult,
  Persona,
  PublicPersona,
  UpdatePersonaInput,
} from "./types";

export interface ProfileServiceDeps {
  readonly profileRepo: ProfileRepository;
}

export interface ProfileService {
  getMyPersona(userId: string): Promise<Result<Persona, AppError>>;
  updateMyPersona(
    userId: string,
    input: UpdatePersonaInput,
  ): Promise<Result<Persona, AppError>>;
  listActivePublicPersonas(
    input: ListActivePublicPersonasInput,
  ): Promise<Result<ListActivePublicPersonasResult, AppError>>;
  getActivePublicPersonaByHandle(
    handle: string,
  ): Promise<Result<PublicPersona, AppError>>;
}

const handlePattern = /^[a-z0-9](?:[a-z0-9_-]{1,22}[a-z0-9])$/;
const defaultDirectoryLimit = 50;

function normalizeNullable(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function hasOwn<K extends string>(
  input: UpdatePersonaInput,
  key: K,
): input is UpdatePersonaInput & Record<K, string | null | undefined> {
  return Object.prototype.hasOwnProperty.call(input, key);
}

function normalizeHandle(value: string | null): Result<string | null, AppError> {
  const normalized = normalizeNullable(value);
  if (normalized === null) {
    return ok(null);
  }

  const handle = normalized.toLowerCase();
  if (!handlePattern.test(handle)) {
    return err(
      validation(
        "handle must be 3-24 characters and use letters, numbers, underscore, or hyphen",
      ),
    );
  }

  return ok(handle);
}

function normalizeBoundedText(
  value: string | null,
  maxLength: number,
  field: string,
): Result<string | null, AppError> {
  const normalized = normalizeNullable(value);
  if (normalized !== null && normalized.length > maxLength) {
    return err(validation(`${field} must be ${maxLength} characters or less`));
  }
  return ok(normalized);
}

function normalizeInput(
  input: UpdatePersonaInput,
): Result<UpdatePersonaInput, AppError> {
  const hasHandle = hasOwn(input, "handle");
  const hasDisplayName = hasOwn(input, "displayName");
  const hasBio = hasOwn(input, "bio");

  if (!hasHandle && !hasDisplayName && !hasBio) {
    return err(validation("at least one persona field is required"));
  }

  const next: {
    handle?: string | null;
    displayName?: string | null;
    bio?: string | null;
  } = {};

  if (hasHandle) {
    const normalized = normalizeHandle(input.handle ?? null);
    if (!normalized.ok) {
      return normalized;
    }
    next.handle = normalized.value;
  }

  if (hasDisplayName) {
    const normalized = normalizeBoundedText(
      input.displayName ?? null,
      40,
      "displayName",
    );
    if (!normalized.ok) {
      return normalized;
    }
    next.displayName = normalized.value;
  }

  if (hasBio) {
    const normalized = normalizeBoundedText(input.bio ?? null, 160, "bio");
    if (!normalized.ok) {
      return normalized;
    }
    next.bio = normalized.value;
  }

  return ok(next);
}

function normalizeDirectoryLimit(value: number | undefined): Result<number, AppError> {
  if (value === undefined) {
    return ok(defaultDirectoryLimit);
  }
  if (!Number.isInteger(value) || value < 1 || value > defaultDirectoryLimit) {
    return err(validation("limit must be an integer from 1 to 50"));
  }
  return ok(value);
}

function normalizeCursor(value: string | null | undefined): Result<string | null, AppError> {
  const normalized = normalizeNullable(value ?? null);
  if (normalized === null) {
    return ok(null);
  }
  return normalizeHandle(normalized);
}

export class DefaultProfileService implements ProfileService {
  constructor(private readonly deps: ProfileServiceDeps) {}

  async getMyPersona(userId: string): Promise<Result<Persona, AppError>> {
    return ok(await this.deps.profileRepo.getMyPersona(userId));
  }

  async updateMyPersona(
    userId: string,
    input: UpdatePersonaInput,
  ): Promise<Result<Persona, AppError>> {
    const normalized = normalizeInput(input);
    if (!normalized.ok) {
      return normalized;
    }

    try {
      return ok(
        await this.deps.profileRepo.updateMyPersona(userId, normalized.value),
      );
    } catch (error) {
      if (error instanceof AppError && error.code === "CONFLICT") {
        return err(conflict("handle already exists"));
      }
      throw error;
    }
  }

  async listActivePublicPersonas(
    input: ListActivePublicPersonasInput,
  ): Promise<Result<ListActivePublicPersonasResult, AppError>> {
    const limit = normalizeDirectoryLimit(input.limit);
    if (!limit.ok) {
      return limit;
    }

    const cursor = normalizeCursor(input.cursor);
    if (!cursor.ok) {
      return cursor;
    }

    return ok(await this.deps.profileRepo.listActivePublicPersonas({
      limit: limit.value,
      cursor: cursor.value,
    }));
  }

  async getActivePublicPersonaByHandle(
    handle: string,
  ): Promise<Result<PublicPersona, AppError>> {
    const normalized = normalizeHandle(handle);
    if (!normalized.ok) {
      return normalized;
    }
    if (normalized.value === null) {
      return err(validation("handle is required"));
    }

    const persona =
      await this.deps.profileRepo.getActivePublicPersonaByHandle(
        normalized.value,
      );
    return persona ? ok(persona) : err(notFound("member not found"));
  }
}
