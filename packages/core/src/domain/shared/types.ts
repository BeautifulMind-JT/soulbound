/**
 * ⛔ CONTRACT-FROZEN — owned by Cowork. To change, say "unfreeze contract".
 */

export type UserRole = "applicant" | "member" | "reviewer" | "admin";

/** The acting principal for any use case. Role drives authorization (INV-11). */
export interface Actor {
  readonly id: string;
  readonly role: UserRole;
}

/** ISO-8601 timestamp string (e.g. "2026-05-29T12:00:00.000Z"). */
export type ISODateString = string;
