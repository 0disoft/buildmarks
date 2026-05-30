# GitHub Collector Contract

Buildmarks will eventually collect public GitHub data, but the public core must keep a strict boundary before live API code exists.

The collector output is a normalized public-data contract. It is not a mirror of the GitHub REST or GraphQL response shape.

## Allowed Inputs

The collector may use public repository evidence:

- public repository owner, name, URL, fork flag, and archive flag
- public repository stars and forks
- public `createdAt` and `pushedAt` timestamps
- public release or tag presence
- public file-presence signals for README, LICENSE, CI workflows, tests, changelog, contribution guide, code of conduct, security policy, demo/docs links, and package artifacts
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

Owner-supplied private repository signals may be designed as a separate opt-in private-local mode. That mode must be explicit, local/self-hosted, token-provided by the owner, redacted by default, and labeled separately from public-only cards.

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

The live adapter is intentionally narrow. It collects public repository metadata, public community profile file signals, selected public content-path signals, and release or tag presence. It does not collect private data, raw commit counts, contribution streaks, follower counts, language percentages, employer data, or hiring suitability signals.

Activity aggregate fields are currently set to zero by the live adapter. Public issue-response, pull-request-review, and external-contributor aggregate collection is deferred until those API-cost and methodology rules are designed.

Operational rules are defined in [GitHub Collector Operations](github-collector-operations.md).
