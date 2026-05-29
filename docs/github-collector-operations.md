# GitHub Collector Operations

Buildmarks does not have a live GitHub API client yet. This document defines the operations policy that a future client must follow.

The executable source of truth is `defaultGitHubCollectorPolicy` in `src/collector/policy.ts`.

## Collection Boundary

- Collection is public-only.
- Private repositories are not allowed.
- Private contributions are not inferred.
- Token mode must not require private repository or organization scopes.
- Unauthenticated mode is allowed only for local/demo use, where low rate limits are acceptable.

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

A future live client should avoid per-card uncached GitHub calls.

Before a hosted endpoint exists, the implementation should keep collection explicit and local. Before a hosted endpoint is added, it must define cache storage, abuse limits, and stale-result behavior.
