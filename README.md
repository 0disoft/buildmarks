# Buildmarks

Buildmarks turns public GitHub activity into engineering signal cards for GitHub profile READMEs.

It is not a developer ranking tool. It does not claim to measure a person's full engineering ability. It only visualizes signals that are visible in public GitHub repositories.

```txt
No streaks.
No commit vanity.
No language pie charts.

Just public signals for maintainability, completeness, shipping evidence, collaboration, and consistency.
```

## Quick Start: GitHub Profile README

1. Copy [examples/profile-readme-workflow.yml](examples/profile-readme-workflow.yml) into your profile README repository as `.github/workflows/update-buildmarks-card.yml`.

2. Add the generated card and report link to your profile `README.md`:

```md
![Buildmarks public GitHub signal card](./assets/buildmarks.svg)

[View the Buildmarks evidence report](./assets/buildmarks-report/buildmarks-report.html)
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
- Explain public engineering signals instead of producing vanity stats.
- Keep scoring rules transparent and inspectable.
- Return JSON reports with the same evidence shown in cards.
- Provide a self-hostable core before any hosted service layer.

## Non-Goals

Buildmarks must not become:

- a global developer leaderboard
- a hiring pass/fail tool
- an "elite developer" badge
- a raw commit-count or contribution-streak card
- a private repository analyzer
- a black-box developer score

## Signal Areas

Buildmarks focuses on these public signal areas:

```txt
maintainability
project completeness
shipping evidence
collaboration traces
consistency
external validation with strict caps
```

Examples of evidence:

- README with installation or usage guidance
- LICENSE file
- release or tag history
- CI workflow files
- test configuration or test directory
- issue and pull request templates
- public pull request or issue response traces
- demo, documentation, or package links

## Anti-Gaming Principles

- Raw commit count is not a primary score.
- Contribution streak is not scored.
- Stars and forks must be capped and treated as weak adoption signals.
- Forked repositories are excluded by default.
- Archived repositories are excluded by default.
- One popular repository must not dominate the whole profile.
- Low public activity must never produce a harsh personal label.
- Every score must show evidence and limitations.
- Every card must clearly state that it uses public data only.

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

Release history is tracked in [CHANGELOG.md](CHANGELOG.md). The current public Action channel is `0disoft/buildmarks@v0`, which points at the latest v0-compatible release.

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

Deferred public activity aggregates are documented in [docs/activity-aggregate-methodology.md](docs/activity-aggregate-methodology.md). The storage-neutral cache boundary is documented in [docs/cache-contract.md](docs/cache-contract.md).

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

The workflow example uses the composite action in [action.yml](action.yml), writes `assets/buildmarks.svg` and `assets/buildmarks-report/`, and commits only when the generated artifacts change. When report generation is enabled, the action collects public GitHub data once and renders both outputs from the same normalized profile. The generated SVG includes a `View evidence` link to the checked-in HTML report.

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

Action inputs are intentionally strict: `generate-report` must be exactly `"true"` or `"false"`, and repository limits must be positive integers. Invalid values fail before Buildmarks collects GitHub data.

| Input | Default | Notes |
| --- | --- | --- |
| `username` | required | GitHub username to analyze. |
| `output` | `assets/buildmarks.svg` | SVG artifact path in the caller repository. |
| `generate-report` | `"true"` | Must be exactly `"true"` or `"false"`. |
| `report-output` | `assets/buildmarks-report` | HTML and JSON report directory. |
| `token` | empty | Optional public-data token. Private scopes are not needed. |
| `max-repositories-scanned` | `30` | Positive integer public repository scan limit. |
| `max-repositories-scored` | `8` | Positive integer profile summary limit. |

## Example Card Assets

Committed sample SVGs live under [examples/assets](examples/assets) so readers can inspect the generated shapes without running Bun first.

Profile card:

```md
![Buildmarks public GitHub signal card](./examples/assets/example-card.svg)
```

Signal gaps card:

```md
![Buildmarks public signal gaps card](./examples/assets/example-gaps-card.svg)
```

Repository card:

```md
![Buildmarks repository signal card](./examples/assets/example-repo-card.svg)
```

## Generate a Signal Gaps Card

Buildmarks can also render a "What's Missing" card from the same local profile fixture:

```bash
bun run build:gaps-card
```

The gaps card is an improvement guide, not a score booster checklist. It only points out missing public repository signals such as tests, CI, licenses, changelogs, releases, or contribution guides.

## Generate a Repository Signal Card

Buildmarks can render a single repository card from the same profile fixture:

```bash
bun run build:repo-card
```

To choose another repository from a profile JSON file:

```bash
bun src/cli/render-repo-card.ts path/to/profile.json owner/repo out/repo-card.svg
```

Repository cards are useful inside project READMEs because they show one repository's maintainability, completeness, shipping, collaboration, consistency, and external validation signals without turning the owner profile into a leaderboard.

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

The report shows dimension scores, evidence, signal gaps, repository-level signals, and limitations. It is designed to sit next to generated SVG cards in a profile README repository or static site.

To generate the same report directly from public GitHub data:

```bash
bun src/cli/render-github-report.ts octocat out/report --token "public-data-token"
```

Like the SVG GitHub CLI, the report CLI requires tokens to be passed explicitly and writes fallback HTML/JSON files if collection fails.

To generate a GitHub SVG with an evidence link manually:

```bash
bun src/cli/render-github-card.ts octocat out/octocat-card.svg --report-href ./report/buildmarks-report.html
```

## Development

Buildmarks uses Bun for the current v0 scaffold.

```bash
bun run check
bun test
bun run build
bun run build:card
bun run build:gaps-card
bun run build:repo-card
bun run build:report
```

The current tests use local fixtures and mocked fetch calls. They do not call the live GitHub API.

Repository CI runs the core test, build, sample SVG, and sample report commands on pushes to `main` and pull requests. The CI workflow is read-only: it does not commit generated files, push tags, create releases, publish packages, or use secrets.

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
