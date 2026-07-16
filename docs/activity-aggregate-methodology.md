# Activity Aggregate Methodology

Buildmarks currently leaves public issue, pull request, and outside-contributor aggregates at zero in the live collector. The fields exist, but the collection work stays deferred until the cost and interpretation are honest enough to ship.

## Goal

These aggregates may eventually add context about how a public project is cared for. They must not become a popularity contest or a developer ranking.

Possible future inputs:

- public issue response traces
- public pull request review traces
- public external contributor traces

Still out of bounds:

- raw commit count
- contribution streaks
- follower count
- private repositories or private contributions
- employer work, compensation, seniority, hiring suitability, or developer worth

## Public Issue Response

The useful question is simple: when people open public issues, is there a visible sign that the project is being tended?

Future collection may use public issue metadata and comments to count things such as issues with a maintainer response or still-open issues without one. Those counts need age windows and repository-size context before they mean much. Private discussion, private triage, and organization-only work stay outside the boundary.

## Public Pull Request Review

Here the question is whether collaboration leaves a public review trail.

Future collection may count the presence of public reviews or review comments at an aggregate level. Comment volume is a bad stand-in for review quality, and silence says nothing about review that happened privately or elsewhere.

## External Contributors

This would describe whether people other than the owner visibly participate in the public project.

Future collection may use public pull request authors, contributor metadata, or issue and pull request participation. Any result must be capped and explained because an old, popular project naturally attracts more people than a new or specialized one.

## API Cost Boundary

These fields are deferred because collecting them can multiply API requests across every repository in a profile. Before implementation, Buildmarks must define:

- endpoint list and request budget
- cache keys and TTLs
- stale-result behavior
- rate-limit failure behavior
- tests with mocked fetch only

Until then, the live collector keeps the fields at zero, sets `activityAggregatesDeferred`, and says plainly in generated reports that issue replies, reviews, and outside contributors were not folded into the score. Zero here means “not collected,” not “none happened.”
