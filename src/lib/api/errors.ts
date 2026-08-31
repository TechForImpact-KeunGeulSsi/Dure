// Stable API error codes and user-facing error boundaries.

export type ApiErrorCode =
  | "AUTH_REQUIRED"
  | "WORKSPACE_ACCESS_DENIED"
  | "ROLE_FORBIDDEN"
  | "SCOPE_FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_FAILED"
  | "CONFLICT"
  | "UPLOAD_POLICY_VIOLATION"
  | "INVITE_EXPIRED"
  | "INVITE_ALREADY_ACCEPTED"
  | "INTERNAL_ERROR";

export type ApiError = {
  code: ApiErrorCode;
  message: string;
  fieldErrors?: Record<string, string[]>;
  meta?: Record<string, unknown>;
};

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

export function apiOk<T>(data: T): ApiResult<T> {
  return { ok: true, data };
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  extras?: Pick<ApiError, "fieldErrors" | "meta">,
): ApiResult<never> {
  return { ok: false, error: { code, message, ...extras } };
}
