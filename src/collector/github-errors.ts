export type GitHubCollectorErrorCode =
  | "invalid_policy"
  | "missing_fetch"
  | "github_request_failed"
  | "github_owner_mismatch"
  | "github_rate_limited"
  | "github_request_budget_exhausted"
  | "github_collection_timeout"
  | "github_request_queue_full"
  | "github_response_too_large"
  | "github_tree_too_large"
  | "invalid_github_response";

export class GitHubCollectorError extends Error {
  readonly code: GitHubCollectorErrorCode;
  readonly status?: number;
  readonly rateLimitReset?: string;

  constructor(
    code: GitHubCollectorErrorCode,
    message: string,
    options: ErrorOptions & { status?: number; rateLimitReset?: string } = {}
  ) {
    super(message, options);
    this.name = "GitHubCollectorError";
    this.code = code;
    if (options.status !== undefined) {
      this.status = options.status;
    }
    if (options.rateLimitReset !== undefined) {
      this.rateLimitReset = options.rateLimitReset;
    }
  }
}

/** Copy only diagnostic fields, never arbitrary adapter metadata or private names. */
export function redactErrorCause(value: unknown, redact: (text: string) => string, seen = new Set<unknown>()): unknown {
  if (typeof value === "string") return redact(value);
  if (value === null || value === undefined || typeof value === "number" || typeof value === "boolean") return value;
  if (!(value instanceof Error) || seen.has(value) || seen.size >= 8) return new Error("Redacted error detail.");
  seen.add(value);
  const copy = new Error(redact(value.message), "cause" in value ? { cause: redactErrorCause(value.cause, redact, seen) } : {});
  copy.name = redact(value.name);
  if (value.stack !== undefined) copy.stack = redact(value.stack);
  const code = (value as Error & { code?: unknown }).code;
  if (typeof code === "string") Object.assign(copy, { code: redact(code) });
  return copy;
}
