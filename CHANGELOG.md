# Changelog

All notable Buildmarks changes are recorded here.

Buildmarks follows practical v0 release notes rather than a strict semver promise. The public contract still stays conservative: public-only GitHub data, inspectable scoring, no developer ranking, and backend-free profile README artifacts first.

## Unreleased

## v0.1.17 - 2026-06-18

- Simplify card headers so profile and repository cards show only the subject on the left and the tier on the right.
- Move the visible Buildmarks version into the footer next to the card scope and generated date.
- Remove embedded SVG `View report` links because GitHub profile README image clicks are controlled by surrounding Markdown.
- Remove `--report-href` from card rendering CLIs so generated cards no longer expose a non-working report-link expectation.

## v0.1.16 - 2026-06-18

- Redact private repository owner names from scored repository outputs and static reports.
- Reject unsafe direct private repository scoring inputs before repository cards can expose names or URLs.
- Show visible `Public + Private Signals` disclosure on private-local profile cards instead of leaving it only in accessible descriptions.
- Derive README, license, contribution, code-of-conduct, and test-file signals from the Git tree when GitHub community profile data is missing.
- Avoid counting directory entries as example or fixture files in codebase-shape scoring.
- Reject blank GitHub repository identifiers in collected API responses before making detail requests.
- Update collector documentation so implemented private-local support is no longer described as future work.
- Avoid claiming private repositories are included when private-local collection returns only public repositories.
- Apply private-local disclosure validation to direct signal-gap analysis.
- Number redacted private repositories sequentially among emitted private repositories instead of using their scan position.
- Reject missing GitHub CLI option values when the next token is another option flag.
- Reject empty local input, SVG output, report output, and GitHub username values before they can resolve to the workspace or write fallback artifacts.
- Reject option-like positional values in local auxiliary CLIs instead of treating mistyped flags as file paths.
- Count root-level `tests/`, `test/`, `spec/`, and `__tests__/` source files as test files in codebase-shape scoring.
- Treat non-boolean direct scoring and gap inputs as absent signals instead of accepting truthy malformed values.
- Validate non-empty `username`, `output`, `report-output`, and private-local token Action inputs before setup or artifact generation.
- Trim local profile identity strings and reject blank local date strings before scoring or repository-card lookup.

## v0.1.15 - 2026-06-18

- Replace context-dependent `Collaboration` and `Public Adoption` front-card dimensions with always-measurable `Usability Surface` and `Project Stewardship` dimensions.
- Keep popularity and public collaboration traces out of default profile-card tier rows so cards do not show unavailable or deferred signal categories.
- Reject private or redacted local repository inputs unless the profile uses private-local signal visibility disclosure.
- Disclose reports with no eligible repositories instead of silently rendering an unexplained Gold V card.
- Normalize invalid runtime SVG theme values to the safe auto theme.
- Make fallback SVG and HTML output scope-neutral so failed private-local runs do not claim public-only signal coverage.

## v0.1.14 - 2026-06-18

- Omit unavailable and context-only dimensions from profile card tier rows so private-local cards no longer show `Public Adoption` as `N/A` on the visual card face.

## v0.1.13 - 2026-06-18

- Render profile and repository card scores as Gold, Platinum, and Diamond signal tiers while preserving underlying 0-100 scores in accessible descriptions, progress bars, and reports.

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
