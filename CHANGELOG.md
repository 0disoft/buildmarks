# Changelog

All notable Buildmarks changes are recorded here.

Buildmarks follows practical v0 release notes rather than a strict semver promise. The public contract still stays conservative: public-only GitHub data, inspectable scoring, no developer ranking, and backend-free profile README artifacts first.

## Unreleased

- Nothing yet.

## v0.1.12 - 2026-06-16

- Share common GitHub CLI option parsing across live GitHub card, report, and artifact commands.
- Expose repository overall score weights as a typed constant and test that the weights stay normalized.
- Detect common CI configuration files beyond GitHub Actions, including CircleCI, Travis CI, Jenkins, Azure Pipelines, GitLab CI, and Drone.
- Derive renderer version assertions from the package version export instead of hard-coding the current version string in tests.

## v0.1.11 - 2026-06-13

- Preserve GitHub recursive tree truncation warnings through collected file signals and profile report limitations.
- Reject non-decimal CLI repository limit values such as hexadecimal or exponent notation.
- Fall back to the current date when SVG card input contains an invalid generated date string.
- Collect repository details with bounded concurrency and disclose deferred live activity aggregates in generated reports.
- Classify GitHub 403 responses more precisely, reject private-local token owner mismatches, and keep private-local report and gap disclosures out of public-only wording.
- Harden fallback artifact writes and SVG/HTML text sanitization for malformed output paths, protocol-relative report links, and control characters.
- Type profile signal classifications as a fixed public union and tighten public-only private-repository disclosure validation.
- Split public-only and private-local GitHub collector policy validation, disclose public-only collection explicitly, align static-report timestamps, and avoid duplicate scoring in combined GitHub artifact generation.
- Omit individual repositories that fail detail collection while disclosing the omitted count, add bounded live-collector policy caps, and apply short GitHub request timeouts with transient retries.

## v0.1.10 - 2026-05-31

- Add clearer spacing between the Buildmarks brand mark and the visible package version on generated SVG cards.

## v0.1.9 - 2026-05-31

- Show the Buildmarks package version beside the top card brand mark on generated SVG cards.

## v0.1.8 - 2026-05-31

- Raise the default `max-repositories-scored` profile summary limit from 8 to 12 so default cards and reports reflect a wider project sample.

## v0.1.7 - 2026-05-31

- Fix the `max-repositories-scored` Action and CLI option so it limits the repositories summarized in profile cards and static reports.
- Add regression coverage for the repository summary limit in scoring and report generation.

## v0.1.6 - 2026-05-31

- Rebalance the front SVG card layout so score bars use the right side of the card instead of leaving a mostly empty score column.
- Render the `Project Care` score as a smaller top-right summary rather than a large detached number.
- Refresh committed example SVG assets to match the current renderer.

## v0.1.5 - 2026-05-31

- Simplify the front SVG card by removing source-disclosure subtitle lines, scope labels, repository counts, mark counts, activity-window text, score-band text, and the color legend.
- Reduce the front-card overall score size so the card reads more like a profile mark than a scoreboard.
- Keep private-local and scoring limitations in reports, docs, and accessible descriptions instead of placing them on the visual card face.

## v0.1.4 - 2026-05-31

- Reduce repetitive `signal`, `evidence`, and `found` wording on the front SVG cards.
- Render compact highlight chips such as `Tests`, `CI`, and `Changelog` instead of long evidence sentences.
- Show four front-card highlights so important maintenance marks are less likely to be hidden.
- Keep longer explanations in reports and docs while making profile README cards cleaner.

## v0.1.3 - 2026-05-31

- Add explicit private-local collection for owner-controlled GitHub Action and CLI runs.
- Require an explicit token before private-local collection starts.
- Redact private repository names and omit private repository URLs in generated profile data.
- Keep public-only collection as the default behavior.

## v0.1.2 - 2026-05-31

- Add an explicit private-local repository signal contract for owner-supplied private evidence.
- Render private-local cards with `Public + Private Signals` disclosure instead of public-only wording.
- Show public adoption as `N/A` on private-local cards and exclude it from the overall score.
- Shift SVG card front matter from a large `/100` overall score to a `Signals Found` count with checked repository coverage.
- Rename the card evidence section and report link to `Found Signals` and `View report` to keep the front card less defensive.
- Treat public collaboration as context instead of a score penalty for independent-builder profiles.
- Add coarse codebase-shape maintainability signals from Git tree metadata without reading source contents or counting lines.
- Add a repository activity window policy and Action/CLI input so old repositories can be skipped before per-repository collection.
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
