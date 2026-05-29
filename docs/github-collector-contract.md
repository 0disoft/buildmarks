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

## Normalized Shape

The normalized contract is represented by:

- `CollectedGitHubProfile`
- `CollectedGitHubRepository`
- `CollectedRepositoryFileSignals`
- `CollectedRepositoryActivitySignals`

These types are converted into `ProfileInput` through `normalizePublicGitHubProfile`.

## Live API Status

This contract does not call GitHub APIs. It only defines what a future API client is allowed to produce.

Before a live GitHub client is added, Buildmarks must document cache behavior, rate limits, token handling, and GitHub API cost.

Those operational rules are defined in [GitHub Collector Operations](github-collector-operations.md).
