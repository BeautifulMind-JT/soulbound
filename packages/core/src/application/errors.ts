/**
 * ⛔ CONTRACT-FROZEN — owned by Cowork.
 * Do NOT add/rename codes or change AppError shape. To change, say "unfreeze contract".
 *
 * These codes map to HTTP status at the route boundary:
 *   VALIDATION                -> 422
 *   FORBIDDEN                 -> 403   (INV-11)
 *   NOT_FOUND                 -> 404
 *   INVALID_STATE_TRANSITION  -> 409
 *   CONFLICT                  -> 409   (idempotency replay / duplicate active application)
 *   DEPENDENCY_FAILURE        -> 502   (surfaced external dependency error; rarely returned, usually thrown)
 */

export type AppErrorCode =
  | "VALIDATION"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_STATE_TRANSITION"
  | "CONFLICT"
  | "DEPENDENCY_FAILURE";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly meta?: Record<string, unknown> | undefined;

  constructor(code: AppErrorCode, message: string, meta?: Record<string, unknown>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.meta = meta;
  }
}

export const validation = (m: string, meta?: Record<string, unknown>): AppError =>
  new AppError("VALIDATION", m, meta);
export const forbidden = (m = "forbidden", meta?: Record<string, unknown>): AppError =>
  new AppError("FORBIDDEN", m, meta);
export const notFound = (m = "not found", meta?: Record<string, unknown>): AppError =>
  new AppError("NOT_FOUND", m, meta);
export const invalidTransition = (m: string, meta?: Record<string, unknown>): AppError =>
  new AppError("INVALID_STATE_TRANSITION", m, meta);
export const conflict = (m: string, meta?: Record<string, unknown>): AppError =>
  new AppError("CONFLICT", m, meta);
export const dependencyFailure = (m: string, meta?: Record<string, unknown>): AppError =>
  new AppError("DEPENDENCY_FAILURE", m, meta);
