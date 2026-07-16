# npm Packaging

Buildmarks is published to npm as a library. For a profile README that only needs generated artifacts, `0disoft/buildmarks@v0` remains the supported path.

## Current Status

- npm package name: `buildmarks`
- Current package version: `0.2.0`
- Do not add a package `bin` entry yet.
- Export the library from `dist/index.js` with TypeScript declarations at `dist/index.d.ts`.
- Keep the package contents dry-run checkable with `npm pack --dry-run`.
- Ship the static report schema at `schemas/buildmarks-report-v1.schema.json`.
- Keep `0disoft/buildmarks@v0` as the recommended profile README artifact workflow.
- Publish from `.github/workflows/release.yml` with npm Trusted Publisher OIDC when the pushed `vX.Y.Z` tag matches `package.json`.

## Trusted Publisher Settings

Configure the npm package Trusted Publisher connection with:

- Publisher: GitHub Actions
- Organization or user: `0disoft`
- Repository: `buildmarks`
- Workflow filename: `release.yml`
- Environment name: `npm`
- Allowed actions: `npm publish`

## Why There Is No CLI Bin Yet

GitHub Actions already covers the simplest job: refresh a checked-in card and report without running a service. The npm package is for library and source consumers, but command names and CLI compatibility are not stable enough to promise a `bin` contract yet.

The CLI can still be run from source with Bun:

```bash
bun src/cli/render-card.ts fixtures/example-public-profile.json out/example-card.svg
```

## Future CLI Criteria

Before adding `bin` commands, Buildmarks should define:

- `bin` command names
- supported runtime versions
- CLI argument compatibility policy
- release and tag workflow for CLI changes

Until those decisions are made, `npx buildmarks` and `bunx buildmarks` are not official adoption paths.

## Package Contents Dry Run

Run:

```bash
npm pack --dry-run
```

The package should include the public OSS core, build output, declarations, examples, and the machine-readable report contract:

- `dist/`
- `src/`
- `docs/`
- `examples/`
- `fixtures/`
- `schemas/`
- `action.yml`
- `CHANGELOG.md`
- `README.md`
- `LICENSE`

Generated `dist/` is created during `prepack`; it belongs in the package but not in the repository. Generated `out/` demo artifacts are intentionally excluded.

## Report Schema and Methodology Version

Static JSON reports currently declare `schemaVersion: "buildmarks-report/v1"`. Consumers can validate that envelope with the packaged file `schemas/buildmarks-report-v1.schema.json`.

The same report also carries `methodologyVersion: "2.0.0"`. These versions describe different things: `schemaVersion` identifies the JSON shape, while `methodologyVersion` identifies the scoring rules that produced the values. Consumers should not treat one as an alias for the other.
