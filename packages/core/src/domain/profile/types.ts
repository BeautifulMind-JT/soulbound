export interface Persona {
  readonly handle: string | null;
  readonly displayName: string | null;
  readonly bio: string | null;
}

export interface UpdatePersonaInput {
  readonly handle?: string | null;
  readonly displayName?: string | null;
  readonly bio?: string | null;
}
