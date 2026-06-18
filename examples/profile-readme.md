# Profile README Example

## Quick Start: Recommended GitHub Actions Setup

1. Copy [profile-readme-workflow.yml](profile-readme-workflow.yml) into your profile README repository as `.github/workflows/update-buildmarks-card.yml`.

2. Add the generated card and report link to your profile `README.md`:

```md
![Buildmarks public GitHub signal card](./assets/buildmarks.svg)

[View the Buildmarks report](./assets/buildmarks-report/buildmarks-report.html)
```

3. Run the workflow once from GitHub Actions using the manual `workflow_dispatch` button.

The workflow creates and commits:

```txt
assets/buildmarks.svg
assets/buildmarks-report/buildmarks-report.html
assets/buildmarks-report/buildmarks-report.json
```

This is the recommended backend-free path. GitHub serves the checked-in SVG and report files directly from your profile repository.

## Static Checked-In Card

Generate a local SVG card from a profile fixture:

```bash
bun run build:card
```

Then copy the generated SVG into a public location that your GitHub profile README can load.

```md
![Buildmarks public GitHub signal card](./out/example-card.svg)
```

## Public GitHub Collection

Generate a card directly from public GitHub data:

```bash
bun src/cli/render-github-card.ts YOUR_USERNAME assets/buildmarks.svg --token "optional-public-data-token"
```

Generate the matching static report from the same public data:

```bash
bun src/cli/render-github-report.ts YOUR_USERNAME assets/buildmarks-report --token "optional-public-data-token"
```

Add the report link to the SVG when generating the card manually:

```bash
bun src/cli/render-github-card.ts YOUR_USERNAME assets/buildmarks.svg --report-href ./buildmarks-report/buildmarks-report.html --token "optional-public-data-token"
```

For quick unauthenticated demos, keep the scan small:

```bash
bun src/cli/render-github-card.ts YOUR_USERNAME assets/buildmarks.svg --max-repositories-scanned 1 --max-repositories-scored 1
```

Then reference the checked-in SVG from your profile README:

```md
![Buildmarks public GitHub signal card](./assets/buildmarks.svg)

[View the Buildmarks report](./assets/buildmarks-report/buildmarks-report.html)
```

The token is optional for local public-only experiments, but authenticated requests are much less likely to hit GitHub's low unauthenticated REST API limit. Buildmarks does not read tokens from environment variables automatically; pass a token explicitly when you want one used.

Private-local mode is opt-in. Use `private-local: "true"` only in owner-controlled workflows that pass an explicit token with read access to selected private repositories. Private repository names and URLs are redacted by default.

## GitHub Actions

Copy [profile-readme-workflow.yml](profile-readme-workflow.yml) into your profile README repository as `.github/workflows/update-buildmarks-card.yml`.

That workflow uses the official composite action, generates `assets/buildmarks.svg` plus `assets/buildmarks-report/`, links the SVG to the HTML report, and commits the generated artifacts only when they change. This keeps the profile README backend-free: GitHub serves the SVG and report as normal repository assets.

The composite action generates files only. The workflow around it owns checkout, repository write permission, staging, commit, and push. The example stages generated artifacts before checking for changes, so the first run commits new files correctly.

Use exact string values for action booleans. `generate-report` and `private-local` accept `"true"` or `"false"` only, and repository limits must be positive integers.

The default repository activity window is 365 days from the public `pushed_at` timestamp. Use `activity-window-days: "180"` for a six-month card that emphasizes recent work and makes fewer per-repository API calls.

Minimal action step:

```yaml
- uses: 0disoft/buildmarks@v0
  with:
    username: ${{ github.repository_owner }}
    output: assets/buildmarks.svg
    generate-report: "true"
    report-output: assets/buildmarks-report
    token: ${{ github.token }}
```

Action inputs:

| Input | Default | Notes |
| --- | --- | --- |
| `username` | required | Non-empty GitHub username to analyze. |
| `output` | `assets/buildmarks.svg` | Non-empty SVG artifact path in the caller repository. |
| `generate-report` | `"true"` | Must be exactly `"true"` or `"false"`. |
| `report-output` | `assets/buildmarks-report` | Non-empty HTML and JSON report directory. |
| `token` | empty | Optional token. Public-only mode does not need private scopes; private-local mode requires an explicit owner-provided read token. |
| `private-local` | `"false"` | Must be exactly `"true"` or `"false"`. Opts into owner-supplied private-local collection with redacted private repository names. |
| `max-repositories-scanned` | `30` | Positive integer public repository scan limit, capped at 100 and must be greater than or equal to `max-repositories-scored`. |
| `max-repositories-scored` | `12` | Positive integer profile summary limit, capped at 24. |
| `activity-window-days` | `365` | Positive integer recent-activity window based on public `pushed_at`, capped at 3650. |

See [profile-smoke-test.md](profile-smoke-test.md) for the real v0 adoption smoke-test checklist.

## Example Card Assets

Committed sample SVGs are available in [assets](assets) for quick visual inspection:

```md
![Buildmarks public GitHub signal card](./assets/example-card.svg)
![Buildmarks public signal gaps card](./assets/example-gaps-card.svg)
![Buildmarks repository signal card](./assets/example-repo-card.svg)
```

## Signal Gaps Card

Generate a static "What's Missing" card from the local fixture:

```bash
bun run build:gaps-card
```

Then reference it from your README:

```md
![Buildmarks public signal gaps card](./out/example-gaps-card.svg)
```

## Repository Card

Generate a static card for one repository from the local fixture:

```bash
bun run build:repo-card
```

Then reference it from a project README:

```md
![Buildmarks repository signal card](./out/example-repo-card.svg)
```

## Inspectable Static Report

Generate an HTML and JSON report:

```bash
bun run build:report
```

Then link to the static report from your README:

```md
[View the Buildmarks report](./out/report/buildmarks-report.html)
```

For a hosted version, replace the checked-in SVG path with the future card endpoint once that service exists.
