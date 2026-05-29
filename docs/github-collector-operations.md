# GitHub Collector Operations

Buildmarks has a small local GitHub REST client for public-only collection. This document defines the operations policy that client must follow.

The executable source of truth is `defaultGitHubCollectorPolicy` in `src/collector/policy.ts`.

The current adapter is `collectPublicGitHubProfile()` in `src/collector/github-client.ts`.

## Collection Boundary

- Collection is public-only.
- Private repositories are not allowed.
- Private contributions are not inferred.
- Token mode must not require private repository or organization scopes.
- Unauthenticated mode is allowed only for local/demo use, where low rate limits are acceptable.
- Tokens are never loaded from environment variables by the public core. Callers must pass a token explicitly if they want a higher public-data limit.

## Cache Policy

Default cache values:

- Profile report cache TTL: 6 hours.
- Repository file-signals cache TTL: 24 hours.

The profile report cache covers the normalized profile-level result used to render a card or JSON report.

The repository file-signals cache covers slower file-presence checks such as README, LICENSE, CI workflows, tests, changelog, contribution guide, security policy, and package artifact signals.

## Repository Limits

Default repository limits:

- Scan up to 30 repositories per profile.
- Score up to 8 repositories per profile.

The scan limit protects GitHub API cost and local runtime. The score limit keeps one profile card readable and limits how much one account can make the renderer do.

The scan limit must be greater than or equal to the score limit.

## Live Client v0 Scope

The live collector uses GitHub REST API endpoints for:

- public user repositories
- public repository community profile metrics
- public repository content existence checks
- public repository README text for usage-guide detection
- public releases and tags

The adapter sets activity aggregate fields to zero in v0. Public issue-response, pull-request-review, and external-contributor aggregate collection remains deferred because those signals need separate API-cost and methodology rules.

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

## API Cost Policy

The live local client should avoid being used as an uncached per-card hosted endpoint.

GitHub currently documents unauthenticated REST requests as 60 requests per hour per originating IP address and authenticated REST requests as generally 5,000 requests per hour for a user token. It also documents secondary rate limits and recommends using rate-limit response headers. See the official [REST API rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) documentation for the current values.

Before a hosted endpoint is added, it must define cache storage, abuse limits, stale-result behavior, and a way to avoid repeated uncached repository-content scans for the same profile.

## API Version

The live adapter sends `X-GitHub-Api-Version: 2026-03-10`, which is listed in GitHub's [REST API versions](https://docs.github.com/en/rest/about-the-rest-api/api-versions) documentation at the time this document was updated on 2026-05-29.
