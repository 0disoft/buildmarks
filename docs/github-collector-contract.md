# GitHub Collector Contract

Buildmarks uses a small local REST adapter to collect public GitHub data. The public core deliberately sees less than GitHub could provide: enough to describe visible project practices, but not enough to reconstruct a person's work history.

The collector returns a normalized contract rather than leaking GitHub's REST or GraphQL response shape into scoring and rendering.

## Allowed Inputs

The collector may use these public traces:

- public repository owner, name, URL, fork flag, and archive flag
- public repository stars and forks
- public `createdAt` and `pushedAt` timestamps
- public `pushedAt` filtering for the configured recent-activity window
- public release or tag presence
- public file-presence signals for README, LICENSE, CI workflows, tests, changelog, contribution guide, code of conduct, security policy, demo/docs links, and package artifacts
- public Git tree metadata for coarse codebase-shape aggregates such as source file count, test file count, example file count, and source file size buckets
- public aggregate traces for issue responses, pull request reviews, and external contributors once their separate methodology and request-budget rules are implemented

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

`collectPublicGitHubProfile()` remains public-only. It does not quietly widen token access or add private repositories when a token is present.

Owner-supplied private repository details are supported only through the separate, opt-in `collectOwnerSuppliedGitHubProfile()` path. That mode must stay explicit and owner-controlled, use a token supplied by the owner, redact names by default, and label its output `Public + Private Signals`.

The private-local boundary is defined in [Private Repository Signal Contract](private-repository-signal-contract.md).

## Normalized Shape

The normalized contract is represented by these API types:

- `CollectedGitHubProfile`
- `CollectedGitHubRepository`
- `CollectedRepositoryFileSignals`
- `CollectedRepositoryActivitySignals`

`normalizePublicGitHubProfile` converts those types into `ProfileInput`. Repository kind fields travel through the normalized shape so scoring can distinguish `library`, `application`, `cli`, `documentation`, `monorepo`, `experiment`, and `general` projects without guessing again later.

## Live API Status

This contract is now produced by the local `collectPublicGitHubProfile()` REST adapter.

The live adapter collects public repository metadata, community-profile files, selected Git tree paths, coarse codebase-shape summaries, and release or tag presence. It does not collect private data, source contents, raw commit counts, streaks, followers, language percentages, employer data, or anything about hiring suitability.

The separate private-local collector keeps the same no-file-contents boundary. It can use private repository tree metadata to find familiar project surfaces and coarse codebase shape, but it does not read private README text, so usage-guide detection remains conservative.

Activity aggregate fields are currently set to zero, and live profiles set `activityAggregatesDeferred` so reports explain that those fields were not collected. Public issue replies, pull request reviews, and outside-contributor activity remain deferred until the request cost and interpretation rules are defined.

The collector also marks observations it could not obtain instead of turning them into false negatives. Scoring keeps those checks `unavailable`; repository-kind exclusions become `not-applicable`. This distinction is part of methodology `2.0.0`.

Operational rules are defined in [GitHub Collector Operations](github-collector-operations.md).
