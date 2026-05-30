# Scoring

Buildmarks uses transparent rule-based scoring before any live GitHub API or hosted service layer exists.

The score is not a developer ranking. It is a compact view of public GitHub evidence.

## v0 Dimensions

Buildmarks summarizes six dimensions:

- Maintainability
- Project Completeness
- Collaboration
- Shipping Evidence
- Consistency
- Public Adoption

Each repository receives a dimension score from 0 to 100. A profile report summarizes the highest-signal eligible repositories, excluding forks and archived repositories by default.

## Overall Weighting

The v0 overall repository score uses this weighting:

- Maintainability: 25%
- Project Completeness: 20%
- Collaboration: 20%
- Shipping Evidence: 15%
- Consistency: 10%
- Public Adoption: 10%

The weighting intentionally keeps stars and forks weak. Popularity is useful context, not proof of engineering quality.

## Evidence

Signals come from public repository evidence such as:

- README and usage guidance
- LICENSE
- CI workflows
- tests
- changelog or release notes
- releases or tags
- demo, documentation, or package links
- contribution guide
- code of conduct
- security policy
- public issue response traces
- public pull request review traces
- external contributor traces

Every score must expose evidence. If a future implementation cannot explain a score, it should not render that score.

## Exclusions

Buildmarks does not use these as primary quality signals:

- raw commit count
- contribution streaks
- follower count
- language percentage charts
- private repositories
- private employer work
- inferred seniority or job suitability

## Current Source of Truth

The executable v0 scoring rules live in `src/scoring/score-repo.ts` and `src/scoring/score-user.ts`.

The example input shape lives in `fixtures/example-public-profile.json`.
