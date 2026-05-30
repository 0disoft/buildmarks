# Cache Contract

Buildmarks does not ship hosted cache storage in v0. This contract defines the storage-neutral behavior required before any hosted endpoint or reusable local cache is added.

## Goals

- Avoid repeated uncached GitHub API scans for the same public profile.
- Keep stale results explicit instead of silently pretending they are fresh.
- Keep Redis, KV, Cloudflare, database, and filesystem choices outside the public core contract.

## Cache Entries

Profile report cache:

- key shape: `profile-report:v1:{username}:{policyHash}`
- default TTL: 6 hours
- value: normalized collected profile plus generated timestamp and limitations

Repository file-signal cache:

- key shape: `repo-file-signals:v1:{owner}/{repo}:{defaultBranch}:{policyHash}`
- default TTL: 24 hours
- value: public file-presence signals and release or tag presence

The `policyHash` must represent scan limits and public-only collection settings that affect the result. It must not include secrets or token values.

## Stale Results

If GitHub collection fails and a stale entry exists, a future hosted or local cache adapter may return that stale entry only when the rendered output clearly marks the result as stale.

Fallback SVG and report generation must remain available when no usable cache entry exists.

## Storage Adapter Boundary

A future cache adapter should expose simple get, set, and delete behavior around string keys and JSON-serializable values.

The public core must not require:

- Redis
- Cloudflare KV
- D1
- R2
- a hosted worker
- private tokens
- telemetry

## Invalidation

Manual refresh may bypass profile cache for one request, but it must still respect repository scan limits and GitHub rate-limit handling.

Generated profile README artifacts avoid per-view cache concerns because viewers load checked-in static files from the profile repository.
