# GitHub Collector Contract

Buildmarks collects public GitHub data through a narrow local REST adapter, and the public core keeps a strict boundary around what that adapter may observe.

The collector output is a normalized public-data contract. It is not a mirror of the GitHub REST or GraphQL response shape.

## Allowed Inputs

The collector may use public repository evidence:

- public repository owner, name, URL, fork flag, and archive flag
- public repository stars and forks
- public `createdAt` and `pushedAt` timestamps
- public `pushedAt` filtering for the configured recent-activity window
- public release or tag presence
- public file-presence signals for README, LICENSE, CI workflows, tests, changelog, contribution guide, code of conduct, security policy, demo/docs links, and package artifacts
- public Git tree metadata for coarse codebase-shape aggregates such as source file count, test file count, example file count, and source file size buckets
- public aggregate traces for issue responses, pull request reviews, and external contributors

## Prohibited Inputs

The collector must not collect or infer:

- private repositories
- private contributions
- private employer or organization work
- private review activity outside public GitHub surfaces
- raw commit count as a scoring signal
- contribution streak as a scoring signal
- follower count as a scoring signal
- language percentage as a quality signal
- compensation, seniority, job fit, hiring pass/fail, or developer worth

## Private Repository Boundary

The live public collector remains public-only. Private repositories are not part of `collectPublicGitHubProfile()`.

Owner-supplied private repository signals are supported only through the separate opt-in `collectOwnerSuppliedGitHubProfile()` private-local path. That mode must be explicit, local/self-hosted, token-provided by the owner, redacted by default, and labeled separately from public-only cards.

The private-local boundary is defined in [Private Repository Signal Contract](private-repository-signal-contract.md).

## Normalized Shape

The normalized contract is represented by:

- `CollectedGitHubProfile`
- `CollectedGitHubRepository`
- `CollectedRepositoryFileSignals`
- `CollectedRepositoryActivitySignals`

These types are converted into `ProfileInput` through `normalizePublicGitHubProfile`.

## Live API Status

This contract is now produced by the local `collectPublicGitHubProfile()` REST adapter.

The live adapter is intentionally narrow. It collects public repository metadata, public community profile file signals, selected public Git tree file signals, coarse codebase-shape aggregates, and release or tag presence. It does not collect private data, file contents, raw commit counts, contribution streaks, follower counts, language percentages, employer data, or hiring suitability signals.

Activity aggregate fields are currently set to zero by the live adapter, and collected live profiles set `activityAggregatesDeferred` so generated reports disclose that limitation. Public issue-response, pull-request-review, and external-contributor aggregate collection is deferred until those API-cost and methodology rules are designed.

Operational rules are defined in [GitHub Collector Operations](github-collector-operations.md).
