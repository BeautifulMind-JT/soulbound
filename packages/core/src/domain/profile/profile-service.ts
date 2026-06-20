import { AppError, conflict, validation } from "../../application/errors";
import { err, ok, type Result } from "../../application/result";
import type { ProfileRepository } from "../../ports/profile-repository";
import type { Persona, UpdatePersonaInput } from "./types";

export interface ProfileServiceDeps {
  readonly profileRepo: ProfileRepository;
}

export interface ProfileService {
  getMyPersona(userId: string): Promise<Result<Persona, AppError>>;
  updateMyPersona(
    userId: string,
    input: UpdatePersonaInput,
  ): Promise<Result<Persona, AppError>>;
}

const handlePattern = /^[a-z0-9](?:[a-z0-9_-]{1,22}[a-z0-9])$/;

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
}
