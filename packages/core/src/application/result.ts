/**
 * ⛔ CONTRACT-FROZEN — owned by Cowork.
 * Do NOT edit signatures or semantics. Cline may only consume this type.
 * To change, the user must explicitly say "unfreeze contract".
 *
 * Hybrid error model: expected domain failures are returned as Err(AppError);
 * genuine bugs / unexpected adapter explosions are thrown (caught at the boundary).
 */

export type Result<T, E = unknown> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export const isOk = <T, E>(
  r: Result<T, E>,
): r is { readonly ok: true; readonly value: T } => r.ok;

export const isErr = <T, E>(
  r: Result<T, E>,
): r is { readonly ok: false; readonly error: E } => !r.ok;
