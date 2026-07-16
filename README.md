# Buildmarks

Buildmarks turns the public traces around GitHub projects into compact profile README cards and inspectable reports.

It is not a developer ranking tool and does not claim to measure a person's engineering ability. It shows what can be checked in public repositories: how projects are documented, maintained, packaged, and shipped.

```txt
No streaks.
No commit vanity.
No language pie charts.

Just a public snapshot of maintainability, readiness, ease of use, shipping, consistency, and project care.
```

## Quick Start: GitHub Profile README

1. Copy [examples/profile-readme-workflow.yml](examples/profile-readme-workflow.yml) into your profile README repository as `.github/workflows/update-buildmarks-card.yml`.

2. Add the generated card and report link to your profile `README.md`:

```md
![Buildmarks public project snapshot](./assets/buildmarks.svg)

[View the Buildmarks report](./assets/buildmarks-report/buildmarks-report.html)
```

3. Run the workflow once from the GitHub Actions `workflow_dispatch` button.

The workflow creates and commits:

```txt
assets/buildmarks.svg
assets/buildmarks-report/buildmarks-report.html
assets/buildmarks-report/buildmarks-report.json
```

No hosted Buildmarks backend is required. Your profile repository stores the static SVG and inspectable report files.

## Status

Buildmarks is in v0 foundation stage. The repository currently includes fixture-based scoring, static SVG renderers, a fallback SVG path, a public-only GitHub collector, local CLI card generation, a composite GitHub Action, profile README examples, documentation for the scoring philosophy, and Bun tests.

The intended license is 0BSD so the scoring rules, renderer, and self-host path can stay easy to reuse.

## Project Goals

- Generate SVG cards that can be embedded in GitHub profile READMEs.
- Explain visible project practices instead of producing vanity stats.
- Keep scoring rules transparent and inspectable.
- Return JSON reports with the same findings summarized in cards.
- Provide a self-hostable core before any hosted service layer.
- Define a safe opt-in private-local mode for owners who want to include selected private repositories without changing the public-only default.

## Non-Goals

Buildmarks must not become:

- a global developer leaderboard
- a hiring pass/fail tool
- an "elite developer" badge
- a raw commit-count or contribution-streak card
- a default private repository analyzer
- a black-box developer score

## What Buildmarks Reviews

Buildmarks looks at six parts of a project:

```txt
maintainability
project readiness
ease of use
shipping
consistency
project care
```

Popularity and collaboration activity stay out of the score because they are often missing, deferred, or shaped by project age and audience. Stars, forks, public issues, and reviews may add report context, but they do not raise the default result.

Examples of what Buildmarks can find:

- README with installation or usage guidance
- LICENSE file
- release or tag history
- CI workflow files
- test configuration or test directory
- coarse repository shape such as test-file ratio and source-file size buckets
- issue and pull request templates
- demo, documentation, or package links

## Anti-Gaming Principles

- Raw commit count is not a primary score.
- Contribution streak is not scored.
- Stars and forks are not default profile-card tier dimensions.
- Forked repositories are excluded by default.
- Archived repositories are excluded by default.
- One popular repository must not dominate the whole profile.
- Low public activity must never produce a harsh personal label.
- Every score must show the supporting details, coverage, and limitations behind it.
- Generated cards and reports must clearly disclose the data scope.

## Scoring Methodology 2.0.0

Methodology `2.0.0` reviews each repository according to its kind: `library`, `application`, `cli`, `documentation`, `monorepo`, `experiment`, or `general`. Checks that do not fit a kind are `not-applicable`; checks Buildmarks could not observe are `unavailable`. Neither is silently turned into a failed check.

The report keeps four ideas separate: score, confidence, coverage, and applicability. A dimension needs at least 50% coverage before it receives a score. Isolated file-presence checks can reach at most 40; a higher score needs at least one corroborated practice, such as tests backed by CI or a release backed by an installable package.

All eligible repositories that were successfully evaluated contribute to the profile calculation. The card display is shorter and uses a kind-stratified selection so different project types have a chance to appear. The report records both evaluated and displayed counts.

Static JSON reports use `schemaVersion: "buildmarks-report/v1"` while the scoring rules use `methodologyVersion: "2.0.0"`. They are separate version lines. The npm package includes the report schema at `schemas/buildmarks-report-v1.schema.json`.

See [docs/scoring.md](docs/scoring.md) for the complete calculation and its limits.

## Planned Surfaces

Future hosted or self-hosted API shape may look like this:

```txt
GET /api/card/user/{username}.svg
GET /api/card/repo/{owner}/{repo}.svg
GET /api/report/user/{username}.json
GET /api/report/repo/{owner}/{repo}.json
```

These routes are not implemented yet. The current implementation supports local scoring, SVG rendering, public GitHub collection, and backend-free profile README updates before hosted API routing.

## Candidate Hosted Domain

`buildmarks.xyz` is a candidate domain for a hosted service or public documentation site. Until the domain is actually owned and deployed, it must be treated as a candidate only.

## Release Readiness

Buildmarks v0 is packaged as a public OSS core and GitHub Action artifact generator. Package and Action metadata point to the GitHub repository at `https://github.com/0disoft/buildmarks` while `buildmarks.xyz` remains candidate-only.

The primary v0 adoption path is backend-free profile README generation: `assets/buildmarks.svg`, `assets/buildmarks-report/buildmarks-report.html`, and `assets/buildmarks-report/buildmarks-report.json`. The composite action generates artifacts only; caller workflows own checkout, `contents: write`, commit, and push behavior.

Release history is tracked in [CHANGELOG.md](CHANGELOG.md). The current public Action channel is `0disoft/buildmarks@v0`; the npm package uses explicit versions such as `0.2.0`.

Buildmarks is published to npm as `buildmarks`, but the package has no `bin` entry yet. The recommended v0 adoption path is still the `0disoft/buildmarks@v0` GitHub Action. The npm package and dry-run package contents contract are documented in [docs/npm-packaging.md](docs/npm-packaging.md). npm releases are published from `.github/workflows/release.yml` through npm Trusted Publisher OIDC when a `vX.Y.Z` tag matches `package.json`.

## Repository Shape

The current implementation starts small:

```txt
fixtures/
src/
  cli/
  collector/
  renderer/
  scoring/
  shared/
tests/
docs/
  scoring.md
  anti-gaming.md
examples/
```

HTTP routing, cache storage, hosted billing, and deployment files are intentionally deferred.

The public collector contract is documented in [docs/github-collector-contract.md](docs/github-collector-contract.md). It defines what future GitHub API code may collect and what it must not infer.

The collector operations policy is documented in [docs/github-collector-operations.md](docs/github-collector-operations.md). It defines cache, token, repository limit, and API cost defaults for the live public GitHub collector.

Owner-supplied private repositories are documented separately in [docs/private-repository-signal-contract.md](docs/private-repository-signal-contract.md). The default collector remains public-only; private repositories require the explicit `collectOwnerSuppliedGitHubProfile()` path, an owner-provided read-only token, redaction by default, and the exact `Public + Private Signals` disclosure.

Deferred public activity aggregates are documented in [docs/activity-aggregate-methodology.md](docs/activity-aggregate-methodology.md). The storage-neutral cache boundary is documented in [docs/cache-contract.md](docs/cache-contract.md).

The npm packaging status is documented in [docs/npm-packaging.md](docs/npm-packaging.md). The package includes `schemas/buildmarks-report-v1.schema.json` and can be inspected with `npm pack --dry-run`.

## Collect from Public GitHub Data

Buildmarks can collect a normalized profile report from public GitHub REST API responses:

```ts
import { collectPublicGitHubProfile, normalizePublicGitHubProfile, scoreUserProfile } from "buildmarks";

const collected = await collectPublicGitHubProfile("octocat", {
  token: "optional-public-data-token"
});
const profile = normalizePublicGitHubProfile(collected);
const report = scoreUserProfile(profile);
```

The token is optional and must be passed explicitly. Buildmarks does not read tokens from environment variables. The collector is public-only and does not collect private repositories, follower counts, language percentages, contribution streaks, or raw commit counts.

The live collector is still a local library surface, not a hosted endpoint. It intentionally has no cache storage, Redis/KV binding, Cloudflare Worker, billing, or web server in this repository.

Private repositories are not part of `collectPublicGitHubProfile()`. Use `collectOwnerSuppliedGitHubProfile()` or the Action `private-local: "true"` input only when the owner explicitly supplies a read token. Private-local output follows [docs/private-repository-signal-contract.md](docs/private-repository-signal-contract.md) and is labeled `Public + Private Signals`. Even with redacted names, the artifacts can reveal private project details, so do not commit the SVG, HTML, or JSON to a public profile repository unless that disclosure is intentional.

## Generate from a GitHub Username

Buildmarks can generate an SVG directly from public GitHub data:

```bash
bun src/cli/render-github-card.ts octocat out/octocat-card.svg
```

Authenticated public-data collection is supported by passing a token explicitly:

```bash
bun src/cli/render-github-card.ts octocat out/octocat-card.svg --token "public-data-token"
```

For cheaper local demos, scan fewer repositories:

```bash
bun src/cli/render-github-card.ts octocat out/octocat-card.svg --max-repositories-scanned 1 --max-repositories-scored 1
```

The CLI does not read `GITHUB_TOKEN` or other environment variables automatically. This keeps token flow visible and avoids surprising secret use in the public core.

If public GitHub collection fails, the CLI writes a readable fallback SVG instead of leaving a broken image behind.

## Backend-Free Profile README Updates

Buildmarks does not need a hosted backend for the first useful workflow. A profile README repository can generate a static SVG plus an inspectable HTML/JSON report on a schedule and commit those artifacts back to the repository.

See [examples/profile-readme.md](examples/profile-readme.md) and [examples/profile-readme-workflow.yml](examples/profile-readme-workflow.yml).

The workflow example uses the composite action in [action.yml](action.yml), writes `assets/buildmarks.svg` and `assets/buildmarks-report/`, and commits only when the generated artifacts change. When report generation is enabled, the action collects public GitHub data once and renders both outputs from the same normalized profile. The SVG stays self-contained because GitHub profile README image clicks are controlled by the surrounding Markdown, not by links embedded inside the SVG.

The composite action only generates artifacts. The caller workflow owns checkout, `contents: write` permission, commit, and push behavior. The example keeps that boundary explicit so profile repositories can adapt branch protection, commit messages, or review policy without Buildmarks hiding those decisions.

The example workflow uses `concurrency` to avoid overlapping scheduled updates. It stages generated files before checking for changes, so the first run commits newly created `assets/` files as well as later updates.

Minimal action usage:

```yaml
- uses: 0disoft/buildmarks@v0
  with:
    username: ${{ github.repository_owner }}
    output: assets/buildmarks.svg
    generate-report: "true"
    report-output: assets/buildmarks-report
    token: ${{ github.token }}
```

Set `generate-report: "false"` when you only want the SVG card.

Set `private-local: "true"` only when the caller workflow passes an explicit owner-provided token that can read the selected private repositories. Private-local cards redact repository names, omit private URLs, use the exact `Public + Private Signals` label, and apply the same project checks as public-only cards. The built-in collector does not read private file contents, so it is conservative about whether a private README contains useful setup guidance. Do not commit private-local SVG, HTML, or JSON to a public profile repository unless publishing those details is intentional.

Action inputs are intentionally strict: `username`, `output`, and `report-output` must be non-empty, `generate-report` must be exactly `"true"` or `"false"`, and repository limits must be positive integers. Invalid values fail before Buildmarks collects GitHub data.

The default repository activity window is 365 days based on each repository's public `pushed_at` timestamp. Set `activity-window-days: "180"` when you want a six-month card that favors recent work and reduces GitHub API cost.

| Input | Default | Notes |
| --- | --- | --- |
| `username` | required | Non-empty GitHub username to analyze. |
| `output` | `assets/buildmarks.svg` | Non-empty SVG artifact path in the caller repository. |
| `generate-report` | `"true"` | Must be exactly `"true"` or `"false"`. |
| `report-output` | `assets/buildmarks-report` | Non-empty HTML and JSON report directory. |
| `token` | empty | Optional token. Public-only mode does not need private scopes; private-local mode requires an explicit owner-provided read token. |
| `private-local` | `"false"` | Must be exactly `"true"` or `"false"`. Opts into owner-supplied private-local collection with redacted private repository names. |
| `max-repositories-scanned` | `30` | Positive integer public repository scan limit, capped at 100 and must be greater than or equal to `max-repositories-scored`. |
| `max-repositories-scored` | `12` | Positive integer repository display limit, capped at 24. Despite the legacy input name, all successfully evaluated repositories contribute to the profile calculation. |
| `activity-window-days` | `365` | Positive integer recent-activity window based on public `pushed_at`, capped at 3650. |
| `max-api-requests` | `160` | Positive integer GitHub REST request budget for one profile collection, capped at 500. Retries spend budget. |

## Example Card Assets

Committed sample SVGs live under [examples/assets](examples/assets) so readers can inspect the generated shapes without running Bun first.

Profile card:

```md
![Buildmarks public project snapshot](./examples/assets/example-card.svg)
```

Project suggestions card:

```md
![Buildmarks project improvement card](./examples/assets/example-gaps-card.svg)
```

Repository card:

```md
![Buildmarks repository card](./examples/assets/example-repo-card.svg)
```

## Generate a Project Suggestions Card

Buildmarks can also turn the same local profile fixture into a short list of practical ways to strengthen the projects:

```bash
bun run build:gaps-card
```

The suggestions card offers concrete ways to improve a project, such as adding tests, CI, licensing, change notes, releases, or contribution guidance.

## Generate a Repository Snapshot Card

Buildmarks can render a single repository card from the same profile fixture:

```bash
bun run build:repo-card
```

To choose another repository from a profile JSON file:

```bash
bun src/cli/render-repo-card.ts path/to/profile.json owner/repo out/repo-card.svg
```

Repository cards are useful inside project READMEs because they show how one project is maintained, documented, made usable, and shipped without turning its owner into a leaderboard entry.

## Generate an Inspectable Static Report

Buildmarks can write a static HTML report and a matching JSON report from the same profile fixture:

```bash
bun run build:report
```

The default command writes:

```txt
out/report/buildmarks-report.html
out/report/buildmarks-report.json
```

The report shows dimension scores, confidence, coverage, applicability, supporting details, improvement ideas, repository kinds, and limitations. Its calculation uses every eligible repository that was successfully evaluated even when the card displays only a representative subset.

The JSON declares `schemaVersion: "buildmarks-report/v1"` and `methodologyVersion: "2.0.0"`. Validate its envelope with the packaged schema at `schemas/buildmarks-report-v1.schema.json`; do not assume the schema version and methodology version advance together.

To generate the same report directly from public GitHub data:

```bash
bun src/cli/render-github-report.ts octocat out/report --token "public-data-token"
```

Like the SVG GitHub CLI, the report CLI requires tokens to be passed explicitly and writes fallback HTML/JSON files if collection fails.
Add `--private-local` with an explicit owner-provided token when generating a private-local report.

To generate a GitHub SVG that can sit beside a report link:

```bash
bun src/cli/render-github-card.ts octocat out/octocat-card.svg
```

## Development

Buildmarks uses Bun for the current v0 scaffold.

```bash
bun run check
bun test
bun run typecheck
bun run build
bun run build:card
bun run build:gaps-card
bun run build:repo-card
bun run build:report
npm pack --dry-run
```

The current tests use local fixtures and mocked fetch calls. They do not call the live GitHub API.

Repository CI runs dependency installation from the lockfile, core tests, TypeScript typecheck, build, sample SVG, sample report, and npm package dry-run checks on pushes to `main` and pull requests. The CI workflow is read-only: it does not commit generated files, push tags, create releases, publish packages, or use secrets.

## Contributing and Security

Use the issue and pull request templates in `.github/` when reporting bugs, proposing features, or opening changes. Keep reports public-data only: do not include secrets, tokens, private GitHub data, private repository names, or personal data.

Sensitive vulnerabilities should not be reported in public issues. See [SECURITY.md](SECURITY.md) for the private reporting path and supported version policy.

## Generate a Local SVG Card

Buildmarks can render a local profile JSON fixture into an SVG file:

```bash
bun run build:card
```

The default command reads `fixtures/example-public-profile.json` and writes `out/example-card.svg`.

To render another file directly:

```bash
bun src/cli/render-card.ts path/to/profile.json out/profile-card.svg
```

If the input cannot be read or parsed, the CLI writes a fallback SVG instead of leaving a broken image behind.

## API-Free Example

```ts
import { renderUserSignalCard, scoreUserProfile } from "buildmarks";

const report = scoreUserProfile(profileFixture);
const svg = renderUserSignalCard(report);
```

## License

Buildmarks is intended to be released under the 0BSD license. See [LICENSE](LICENSE).
