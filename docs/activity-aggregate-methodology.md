# Activity Aggregate Methodology

Buildmarks v0 intentionally leaves public issue, pull request, and external contributor aggregates at zero in the live collector. This document defines the methodology boundary before any API expansion.

## Goal

Activity aggregates should explain visible maintainer behavior, not rank people.

Allowed future signals:

- public issue response traces
- public pull request review traces
- public external contributor traces

Rejected signals:

- raw commit count
- contribution streaks
- follower count
- private repositories or private contributions
- employer work, compensation, seniority, hiring suitability, or developer worth

## Public Issue Response

The intended signal is whether public repository maintainers respond to issues in a way that leaves a visible maintenance trace.

Future collection may use public issue metadata and public comments to derive aggregate counts such as responded issues or unresolved public issues. It must not read private discussion, private triage, or organization-only context.

## Public Pull Request Review

The intended signal is whether collaboration happens through public review traces.

Future collection may count public review or review-comment presence at an aggregate level. It must not infer review quality from private code review, private repositories, employer work, or raw comment volume.

## External Contributors

The intended signal is whether a repository has visible participation from people other than the owner.

Future collection may use public pull request authors, public contributor metadata, or public issue and pull request participation. It must cap and explain the signal because popularity and project age can distort it.

## API Cost Boundary

These aggregates are deferred because they can multiply API requests across repositories. Before implementation, Buildmarks must define:

- endpoint list and request budget
- cache keys and TTLs
- stale-result behavior
- rate-limit failure behavior
- tests with mocked fetch only

Until then, the live collector keeps these aggregate fields at zero and documents that limitation in reports.
