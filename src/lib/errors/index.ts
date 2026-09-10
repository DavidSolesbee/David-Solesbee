/**
 * Typed error handling structure for Perseus.
 *
 * A small, explicit error taxonomy plus a Result<T> helper so services can
 * return failures without throwing across layer boundaries. Security-related
 * failures are first-class so later milestones can enforce them consistently.
 */

export type PerseusErrorCode =
  | "READ_ONLY_VIOLATION"
  | "DB_UNAVAILABLE"
  | "NOT_FOUND"
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INTERNAL";

export class PerseusError extends Error {
  readonly code: PerseusErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(
    code: PerseusErrorCode,
    message: string,
    options?: { status?: number; details?: unknown; cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = "PerseusError";
    this.code = code;
    this.status = options?.status ?? defaultStatusForCode(code);
    this.details = options?.details;
  }
}

function defaultStatusForCode(code: PerseusErrorCode): number {
  switch (code) {
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
    case "READ_ONLY_VIOLATION":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "VALIDATION":
      return 400;
    case "DB_UNAVAILABLE":
      return 503;
    default:
      return 500;
  }
}

/** Lightweight Result type for fallible operations that should not throw. */
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: PerseusError };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err(error: PerseusError): Result<never> {
  return { ok: false, error };
}

/** Wrap an unknown thrown value into a PerseusError. */
export function toPerseusError(e: unknown): PerseusError {
  if (e instanceof PerseusError) return e;
  if (e instanceof Error) {
    return new PerseusError("INTERNAL", e.message, { cause: e });
  }
  return new PerseusError("INTERNAL", "Unknown error", { details: e });
}
