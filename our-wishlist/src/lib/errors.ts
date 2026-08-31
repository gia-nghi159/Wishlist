export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "NOT_IN_GROUP"
  | "CONFLICT"
  | "LIMIT_EXCEEDED"
  | "DB_ERROR"
  | "AI_ERROR"
  | "LINK_PARSE_TIMEOUT";

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = "AppError";
  }
}
