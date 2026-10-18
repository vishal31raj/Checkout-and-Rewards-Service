export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function isPostgresError(
  error: unknown,
): error is Error & { code: string; constraint?: string } {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string"
  );
}
