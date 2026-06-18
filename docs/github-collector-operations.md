# GitHub Collector Operations

Buildmarks has a small local GitHub REST client for public-only collection. This document defines the operations policy that client must follow.

The executable source of truth is `defaultGitHubCollectorPolicy` for public-only collection and `privateLocalGitHubCollectorPolicy` for owner-supplied private-local collection in `src/collector/policy.ts`.

The current adapter is `collectPublicGitHubProfile()` in `src/collector/github-client.ts`.

The current username-to-card CLI is `src/cli/render-github-card.ts`. It uses the same adapter and writes a fallback SVG when collection or rendering fails.

## Collection Boundary

- Collection is public-only.
- Private repositories are not allowed.
- Private contributions are not inferred.
- Token mode must not require private repository or organization scopes.
- Unauthenticated mode is allowed only for local/demo use, where low rate limits are acceptable.
- Tokens are never loaded from environment variables by the public core. Callers must pass a token explicitly if they want a higher public-data limit.
- The CLI follows the same rule: pass `--token <token>` explicitly if token mode is desired.
- The CLI also supports `--max-repositories-scanned <n>`, `--max-repositories-scored <n>`, and `--activity-window-days <n>` so local demos can reduce GitHub API cost.

## Cache Policy

Default cache contract values:

- Profile report cache TTL: 6 hours.
- Repository file-signals cache TTL: 24 hours.

These values define the storage-neutral cache contract only; the v0 local collector does not persist cache entries. A future profile report cache covers the normalized profile-level result used to render a card or JSON report.

A future repository file-signals cache covers slower file-presence checks such as README, LICENSE, CI workflows, tests, changelog, contribution guide, security policy, package artifact signals, and coarse codebase-shape aggregates. The v0 live collector derives most path-based file signals and size-bucket shape signals from one recursive tree response per repository instead of probing every candidate path separately.

The storage-neutral cache contract is documented in [Cache Contract](cache-contract.md). Buildmarks v0 does not ship Redis, KV, database, filesystem, or hosted cache storage.

## Repository Limits

Default repository limits:

- Scan up to 30 repositories per profile by default. Policy validation caps this at 100.
- Score up to 12 repositories per profile by default. Policy validation caps this at 24.
- Collect up to 3 repositories concurrently by default. Policy validation caps this at 8.
- Analyze repositories pushed within the last 365 days by default. Policy validation caps this at 3650.

The scan limit protects GitHub API cost and local runtime. The bounded repository concurrency reduces local wait time without turning one profile into an unbounded burst of GitHub API requests. The score limit keeps one profile card readable and limits how much one account can make the renderer do.

The scan limit must be greater than or equal to the score limit.

The activity window uses the public `pushed_at` timestamp and filters repositories before per-repository collection. Callers may set `--activity-window-days 180` for a six-month card. This is a recency and cost-control setting, not proof that older projects are inactive or low quality.

If one non-rate-limit repository detail collection fails after the repository list is loaded, the collector omits that repository, continues with the rest of the profile, and reports the omitted repository count as a limitation. Repository-list failures and GitHub rate-limit or abuse-limit responses remain fatal because the collector cannot know whether the partial profile is representative.

## Live Client v0 Scope

The live collector uses GitHub REST API endpoints for:

- public user repositories
- public repository community profile metrics
- one recursive public repository tree lookup per scanned repository for file-presence and coarse codebase-shape signals
- public repository README text for usage-guide detection
- public releases and tags

The adapter sets activity aggregate fields to zero in v0. Public issue-response, pull-request-review, and external-contributor aggregate collection remains deferred because those signals need separate API-cost and methodology rules.

The deferred methodology is documented in [Activity Aggregate Methodology](activity-aggregate-methodology.md).

The adapter does not collect follower counts, language percentages, raw commit counts, contribution streaks, private repositories, private contributions, employer information, compensation, seniority, job fit, or hiring pass/fail signals.

## Token Policy

The public core must not require tokens with private scopes.

Allowed future token behavior:

- no token for local/demo use
- token with no private repository scope for higher public API limits

Rejected token behavior:

- `repo`
- `repo:status`
- `repo_deployment`
- `repo:invite`
- `security_events`
- organization admin or private organization scopes

Private repository support is a separate opt-in private-local mode rather than a change to the public collector. That boundary is documented in [Private Repository Signal Contract](private-repository-signal-contract.md).

## API Cost Policy

The live local client should avoid being used as an uncached per-card hosted endpoint.

GitHub currently documents unauthenticated REST requests as 60 requests per hour per originating IP address and authenticated REST requests as generally 5,000 requests per hour for a user token. It also documents secondary rate limits and recommends using rate-limit response headers. See the official [REST API rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) documentation for the current values.

Before a hosted endpoint is added, it must define cache storage, abuse limits, stale-result behavior, and a way to avoid repeated uncached repository-content scans for the same profile.

The live client applies a short timeout and one retry for transient GitHub responses before surfacing the request as failed.

The backend-free profile README workflow avoids per-view GitHub API cost by committing a generated SVG into the profile repository. Viewers load a static file from GitHub instead of causing fresh collection work.

## API Version

The live adapter sends `X-GitHub-Api-Version: 2026-03-10`, which is listed in GitHub's [REST API versions](https://docs.github.com/en/rest/about-the-rest-api/api-versions) documentation at the time this document was updated on 2026-05-29.
