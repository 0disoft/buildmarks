# Changelog

All notable Buildmarks changes are recorded here.

Buildmarks follows practical v0 release notes rather than a strict semver promise. The public contract still stays conservative: public-only GitHub data, inspectable scoring, no developer ranking, and backend-free profile README artifacts first.

## Unreleased

## v0.1.2 - 2026-05-30

- Add an explicit private-local repository signal contract for owner-supplied private evidence.
- Render private-local cards with `Public + Private Signals` disclosure instead of public-only wording.
- Document the real profile README adoption smoke-test path.
- Add methodology notes for deferred public issue, pull request, and external contributor aggregates.
- Add a storage-neutral cache contract before any hosted endpoint work.
- Add committed example SVG assets for profile, repository, and signal gaps cards.

## v0.1.1 - 2026-05-30

- Published the `buildmarks` npm package as a library package.
- Kept the GitHub Action as the recommended v0 profile README adoption path.
- Documented that npm has no official `bin` command contract yet.
- Added npm package dry-run checks to CI.

## v0.1.0 - 2026-05-30

- First public Buildmarks foundation release.
- Added fixture-based scoring and SVG rendering for public GitHub engineering signals.
- Added local CLI surfaces for profile cards, repository cards, signal gaps cards, and inspectable static reports.
- Added a public-only GitHub REST collector for backend-free profile README artifact generation.
- Added the `0disoft/buildmarks@v0` composite GitHub Action.
- Added docs for scoring, anti-gaming principles, public GitHub collection boundaries, and collector operations.
- Added repository CI and community health templates.
