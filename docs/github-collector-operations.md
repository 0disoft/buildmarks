# GitHub Collector Operations

Buildmarks has a small local GitHub REST client for public-only collection. This document sets the guardrails that keep one profile refresh bounded and predictable.

The executable source of truth is `defaultGitHubCollectorPolicy` for public-only collection and `privateLocalGitHubCollectorPolicy` for owner-supplied private-local collection in `src/collector/policy.ts`.

The current adapter is `collectPublicGitHubProfile()` in `src/collector/github-client.ts`.

The current username-to-card CLI is `src/cli/render-github-card.ts`. It uses the same adapter and writes a fallback SVG when collection or rendering fails.

## Collection Boundary

- `collectPublicGitHubProfile()` is public-only.
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

A future repository file cache covers slower checks for README, LICENSE, CI, tests, changelog, contribution and security guidance, package manifests, and coarse codebase shape. The live collector currently derives most path-based findings and size buckets from one recursive tree response per repository instead of probing every possible path.

The storage-neutral cache contract is documented in [Cache Contract](cache-contract.md). Buildmarks v0 does not ship Redis, KV, database, filesystem, or hosted cache storage.

## Repository Limits

Default repository limits:

- Scan up to 30 repositories per profile by default. Policy validation caps this at 100.
- Display up to 12 evaluated repositories per profile by default. The legacy `maxRepositoriesScored` policy field controls this display limit and is capped at 24; all successfully evaluated repositories still contribute to the profile calculation.
- Collect up to 3 repositories concurrently by default. Policy validation caps this at 8.
- Spend at most 160 GitHub REST requests per profile collection by default. Policy validation caps this at 500, and every retry spends budget.
- Analyze repositories pushed within the last 365 days by default. Policy validation caps this at 3650.

The scan limit protects API cost and local runtime. Bounded concurrency shortens the wait without turning a profile refresh into an uncontrolled burst. The scored/display setting limits what the card can show, but methodology `2.0.0` calculates the profile from every eligible repository that was successfully evaluated, not only the repositories selected for display.

The scan limit must be greater than or equal to the display limit exposed as `maxRepositoriesScored`.

The activity window uses the public `pushed_at` timestamp and filters repositories before per-repository collection. Callers may set `--activity-window-days 180` for a six-month card. This is a recency and cost-control setting, not proof that older projects are inactive or low quality.

If one repository detail request fails for a reason other than rate limiting, the collector leaves that repository out, continues with the rest, and reports how many were omitted. A repository-list failure, rate limit, abuse limit, or request-budget exhaustion remains fatal because the collector cannot tell whether the partial profile is representative.

Collected profiles record how many active repositories were attempted. If failed detail requests and truncated trees make up at least half of that set, generated reports mark the result as insufficient and do not present a normal score. A repository with an incomplete recursive tree is excluded from scoring and improvement hints because an unseen file cannot honestly be called missing.

## Live Client Scope

The live collector uses GitHub REST API endpoints for:

- public user repositories
- public repository community profile metrics
- one recursive public repository tree lookup per scanned repository for file-presence and coarse codebase-shape signals
- public repository README text for usage-guide detection
- public releases and tags

The adapter sets activity aggregate fields to zero. Public issue replies, pull request reviews, and outside-contributor collection remain deferred because those fields need separate request-cost and interpretation rules.

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

In private-local mode, the built-in collector keeps private file contents out of the collection boundary. It can detect private README file presence from tree metadata, but it does not read private README text, so private usage-guide signals are conservative.

## API Cost Policy

The local client is not designed to sit behind an uncached endpoint that runs once per card view.

GitHub currently documents unauthenticated REST requests as 60 requests per hour per originating IP address and authenticated REST requests as generally 5,000 requests per hour for a user token. It also documents secondary rate limits and recommends using rate-limit response headers. See the official [REST API rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) documentation for the current values.

Before a hosted endpoint is added, it must define cache storage, abuse limits, stale-result behavior, and a way to avoid repeated uncached repository-content scans for the same profile.

The live client uses a short timeout and retries a transient GitHub response once before reporting the request as failed.

The request budget is enforced immediately before each HTTP attempt. Exhaustion is fatal for the profile rather than being hidden as an omitted repository. Fatal rate-limit and budget errors stop new repository work and abort in-flight sibling requests; an aborted request is not retried.

The backend-free profile README workflow pays collection cost only when it refreshes the checked-in artifacts. Profile visitors load a static SVG from GitHub and do not trigger new API work.

Generated text artifacts are written to unpredictable temporary files in the destination directory, flushed, closed, and then renamed over the destination. This provides file-level atomic replacement on ordinary local filesystems. A multi-file SVG/HTML/JSON generation is not claimed to be one transaction, and directory fsync or network-filesystem durability is platform-dependent.

## API Version

The live adapter sends `X-GitHub-Api-Version: 2026-03-10`, which is listed in GitHub's [REST API versions](https://docs.github.com/en/rest/about-the-rest-api/api-versions) documentation at the time this document was updated on 2026-05-29.
