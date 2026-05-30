# npm Packaging

Buildmarks is published to npm as a library package, but the supported v0 profile README adoption path remains the `0disoft/buildmarks@v0` GitHub Action.

## Current Status

- npm package name: `buildmarks`
- Current package version: `0.1.2`
- Do not add a package `bin` entry yet.
- Keep the package contents dry-run checkable with `npm pack --dry-run`.
- Keep `0disoft/buildmarks@v0` as the recommended profile README artifact workflow.

## Why There Is No CLI Bin Yet

The first useful Buildmarks workflow is backend-free profile README artifact generation through GitHub Actions. The npm package is available for library/source consumers, but command names and CLI compatibility are not stable enough for a `bin` contract.

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

The package should include the public OSS core and examples:

- `src/`
- `docs/`
- `examples/`
- `fixtures/`
- `action.yml`
- `CHANGELOG.md`
- `README.md`
- `LICENSE`

Generated `dist/` and `out/` artifacts are intentionally not part of the package.
