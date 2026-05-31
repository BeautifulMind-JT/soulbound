/**
 * ⛔ CONTRACT-FROZEN — owned by Cowork. To change, say "unfreeze contract".
 * P0 implementation: SupabaseAuthAdapter. The service role client is NEVER
 * exposed to the browser (INV-17).
 */
import type { UserRole } from "../domain/shared/types";

export interface AuthSession {
  readonly userId: string;
  readonly role: UserRole;
}

export interface AuthCredentials {
  readonly email: string;
  readonly password: string;
}

export interface AuthPort {
  signUp(input: AuthCredentials): Promise<AuthSession>;
  signIn(input: AuthCredentials): Promise<AuthSession>;
  getSession(): Promise<AuthSession | null>;
  getUserId(): Promise<string | null>;
}
