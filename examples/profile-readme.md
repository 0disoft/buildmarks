# Profile README Example

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

For quick unauthenticated demos, keep the scan small:

```bash
bun src/cli/render-github-card.ts YOUR_USERNAME assets/buildmarks.svg --max-repositories-scanned 1 --max-repositories-scored 1
```

Then reference the checked-in SVG from your profile README:

```md
![Buildmarks public GitHub signal card](./assets/buildmarks.svg)
```

The token is optional for local experiments, but authenticated requests are much less likely to hit GitHub's low unauthenticated REST API limit. Buildmarks does not read tokens from environment variables automatically; pass a token explicitly when you want one used.

## GitHub Actions

Copy [profile-readme-workflow.yml](profile-readme-workflow.yml) into your profile README repository as `.github/workflows/update-buildmarks-card.yml`.

That workflow uses the official composite action, generates `assets/buildmarks.svg`, and commits the SVG only when it changes. This keeps the profile README backend-free: GitHub serves the SVG as a normal repository asset.

Minimal action step:

```yaml
- uses: 0disoft/buildmarks@v0
  with:
    username: ${{ github.repository_owner }}
    output: assets/buildmarks.svg
    token: ${{ github.token }}
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

For a hosted version, replace the checked-in SVG path with the future card endpoint once that service exists.
