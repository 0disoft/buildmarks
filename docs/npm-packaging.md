# npm Packaging Decision

Buildmarks is not published to npm in v0. The supported adoption path is the `0disoft/buildmarks@v0` GitHub Action plus source usage from this repository.

## Current Decision

- Do not publish to npm yet.
- Do not add a package `bin` entry yet.
- Keep the package contents dry-run checkable with `npm pack --dry-run`.
- Keep package metadata ready for a future npm package without implying it already exists.

## Why npm Is Deferred

The first useful Buildmarks workflow is backend-free profile README artifact generation through GitHub Actions. Publishing to npm before the CLI contract is stable would create a second public distribution channel too early.

The CLI can still be run from source with Bun:

```bash
bun src/cli/render-card.ts fixtures/example-public-profile.json out/example-card.svg
```

## Future npm Criteria

Before publishing to npm, Buildmarks should define:

- package entrypoint contract
- `bin` command names
- supported runtime versions
- CLI argument compatibility policy
- package contents policy
- release and tag workflow for npm publish

Until those decisions are made, `npm install buildmarks`, `npx buildmarks`, and `bunx buildmarks` are not official adoption paths.

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
