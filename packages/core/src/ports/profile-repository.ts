import type {
  Persona,
  UpdatePersonaInput,
} from "../domain/profile/types";

export interface ProfileRepository {
  getMyPersona(userId: string): Promise<Persona>;
  updateMyPersona(
    userId: string,
    input: UpdatePersonaInput,
  ): Promise<Persona>;
}
