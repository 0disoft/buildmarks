export type GitHubCollectorErrorCode =
  | "invalid_policy"
  | "missing_fetch"
  | "github_request_failed"
  | "github_owner_mismatch"
  | "github_rate_limited"
  | "github_request_budget_exhausted"
  | "invalid_github_response";

export class GitHubCollectorError extends Error {
  readonly code: GitHubCollectorErrorCode;
  readonly status?: number;
  readonly rateLimitReset?: string;

  constructor(
    code: GitHubCollectorErrorCode,
    message: string,
    options: { status?: number; rateLimitReset?: string } = {}
  ) {
    super(message);
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
