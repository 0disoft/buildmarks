# Deterministic evaluation and I/O tests

Required arguments and result shapes are unchanged. Existing calls continue to use the built-in fetch, filesystem and timers. The new options are optional dependency injection points; they do not install global mocks.

## Evaluation time

`scoreRepository`, `scoreUserProfile`, `analyzeSignalGaps` and `createStaticReport` accept `now?: Date` in their existing options. Each profile or static report captures one time and passes it through all repository evaluations and gap selection.

An explicit `now` takes precedence. Otherwise, a profile's valid `generatedAt` is the evaluation time, so saved snapshots can be replayed. With neither value, the operation captures the current time. The resulting report records that evaluation time in `generatedAt`. Invalid explicit times and malformed input timestamps fail validation; SVG rendering of a malformed report date says `Date unavailable` instead of inventing a current date.

```ts
const now = new Date("2026-05-28T00:00:00.000Z");
const report = createStaticReport(profile, { now });
```

Local `renderCardFile`, `renderGapsCardFile` and `renderReportFiles` accept an optional options argument after their required paths. `renderRepoCardFile` accepts it after the input path, repository reference and output path. These options include `now`, `signal`, `fileSystem` and `randomId`.

## Collection and cancellation

The existing GitHub collector options additionally accept:

- `now?: Date`: one reference time for the activity window and `collectedAt`.
- `signal?: AbortSignal`: caller cancellation, propagated through requests, body consumption and retry waits.
- `timeoutMilliseconds?: number`: per-attempt deadline, including body consumption; default 10,000, valid range 1 through 2,147,483,647 integer milliseconds.
- `collectionTimeoutMilliseconds?: number`: optional total collection deadline covering pagination, concurrent detail reads and retry waits. It uses the same valid range as the per-attempt deadline and is disabled when omitted. Expiry rejects with `GitHubCollectorError.code === "github_collection_timeout"`; it never returns a partial profile as success.
- `runtime?: Partial<GitHubCollectorRuntime>`: optional `sleep(milliseconds, signal)` and `scheduleTimeout(callback, milliseconds)` implementations. The scheduler returns a function that cancels the scheduled callback. Test schedulers should queue callbacks for explicit advancement rather than calling them inline.

Rate-limit responses stop collection immediately. Buildmarks does not retry a 429 or rate-limited 403 ahead of `Retry-After`; caller workflows can retry later. Transient server and transport failures still get at most one retry, counted against the same request budget.

Caller cancellation rejects with `AbortError`, stops repository scheduling and does not generate fallback artifacts. Request and caller hooks are removed after completion. Injected fetchers should honor the request signal; the deadline also rejects the caller when a test double ignores cancellation. Retry waits follow the same rule.

Custom caller cancellation reasons are retained as the `AbortError` cause (an existing `AbortError` is propagated unchanged). Per-attempt expiry uses `TimeoutError` and may retry once; total expiry and caller cancellation never retry. Exhausted transient transport failures retain their original `cause`. Programming errors and malformed JSON are not retryable. The read retry policy lives in `src/collector/read-retry.ts`; file writes do not use it.

`runtime.onCleanupError?: (error: unknown) => void | Promise<void>` observes response-body cleanup failures without replacing the primary result. It is opt-in, has no built-in logging, and must not retain secrets. Observer failures are isolated and the operation does not wait for an observer or stalled body cleanup. Private-local fatal collector errors copy and redact diagnostic causes rather than exposing raw private repository names through nested errors.

## Filesystem boundaries

The CLI renderer options accept `fileSystem?: Partial<RenderFileSystem>`. Unspecified operations retain their built-in implementation. Inject all operations a memory-only test may use: input identity checks (`realpath`, `stat`), reads, directory creation, output existence checks and output operations. A fixed `randomId` makes temporary-name collisions reproducible.

The low-level writers accept `WriteOutputOptions`:

```ts
await writeTextFileAtomically(path, content, options);
await writeTextFilesAsSet(outputs, undefined, options);
```

The existing second `replace` argument to `writeTextFilesAsSet` is preserved. An injected filesystem can separately fail backup creation, staging, publication and recovery.

Writers remove only temporary and backup files they successfully created. Cancellation before publication cleans owned staging files and preserves existing outputs. Once replacement starts, publication and recovery finish without cancellation checks; a successfully published output set remains a success. If recovery fails, its diagnostic and retained backup are preserved even when the caller also cancels. Exclusive per-destination lock files exclude overlapping writers across cooperating processes, including fallback existence checks and writes. Conflicts throw `OutputBusyError` without fallback output; cleanup failures throw `OutputLockReleaseError` with the original cause. Caught-failure recovery does not make multiple renames atomic or protect against process termination or power loss. See [collector operations](github-collector-operations.md) for leftover-lock recovery and shared-storage requirements.

Temporary-file and backup cleanup failures throw `OutputCleanupError` with the primary failure as `cause` and cleanup failures in `errors`. Its `committed` flag identifies a successful publication followed by failed cleanup; renderers propagate this error without publishing fallback files. Inaccessible output paths have an `unknown` existence state and raise `OutputInspectionError` instead of claiming preservation or assuming absence. Filesystem writes are not raced against a timeout: a pending rename can still finish, so the owner retains its locks until publication and recovery settle.

## Regression coverage

- `scoring-boundaries.test.ts`: unrounded coverage thresholds, partial invalid metrics, count consistency, collection availability and owner-qualified selection.
- `evaluation-time.test.ts`: snapshot replay, explicit time overrides, shared report time and millisecond activity boundaries.
- `collector-runtime.test.ts`: manual deadlines, unread-body cleanup, late responses, sibling cancellation and settlement, request budgets and rate-limit handling without live GitHub calls.
- `failure-isolation.test.ts`: transport causes, permanent-error retry exclusion, custom cancellation reasons and private diagnostic redaction.
- `output-runtime.test.ts`: memory filesystem rendering, exclusive-name collisions, write failures, publication rollback and cancellation.
- `output-concurrency.test.ts`: overlapping output sets, fallback races, partial lock acquisition, cleanup failures, directory aliases and a separate writer process.

The existing input-alias and bundled Node CLI tests continue to exercise real filesystem and runtime integration.
