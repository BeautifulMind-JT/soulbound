export interface Persona {
  readonly handle: string | null;
  readonly displayName: string | null;
  readonly bio: string | null;
}

export interface PublicPersona {
  readonly handle: string;
  readonly displayName: string | null;
  readonly bio: string | null;
}

export interface ListActivePublicPersonasInput {
  readonly limit?: number;
  readonly cursor?: string | null;
}

export interface ListActivePublicPersonasResult {
  readonly items: readonly PublicPersona[];
  readonly nextCursor: string | null;
}

export interface UpdatePersonaInput {
  readonly handle?: string | null;
  readonly displayName?: string | null;
  readonly bio?: string | null;
}
