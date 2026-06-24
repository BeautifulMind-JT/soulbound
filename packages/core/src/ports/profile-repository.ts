import type {
  ListActivePublicPersonasInput,
  ListActivePublicPersonasResult,
  Persona,
  PublicPersona,
  UpdatePersonaInput,
} from "../domain/profile/types";

export interface ProfileRepository {
  getMyPersona(userId: string): Promise<Persona>;
  updateMyPersona(
    userId: string,
    input: UpdatePersonaInput,
  ): Promise<Persona>;
  listActivePublicPersonas(
    input: Required<ListActivePublicPersonasInput>,
  ): Promise<ListActivePublicPersonasResult>;
  getActivePublicPersonaByHandle(handle: string): Promise<PublicPersona | null>;
}
