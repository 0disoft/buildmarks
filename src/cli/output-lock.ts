import { createHash } from "node:crypto";
import { hostname } from "node:os";
import { dirname, join, resolve } from "node:path";
import { throwIfCancelled } from "../shared/cancellation.js";
import { canonicalFilePath, resolveFileSystem, type OutputFileHandle, type OutputFileSystem, type WriteOutputOptions } from "./file-system.js";

const lockScope = Symbol("buildmarksOutputLockScope");
interface LockScope {
  active: boolean;
  identities: ReadonlySet<string>;
  fileSystem: WriteOutputOptions["fileSystem"];
}
type ScopedOptions = WriteOutputOptions & { [lockScope]?: LockScope };
interface HeldLock { path: string; handle: OutputFileHandle; }

export class OutputBusyError extends Error {
  constructor(path: string) {
    super(`Output destination is already locked: ${path}. Retry after its writer finishes; do not remove a live writer's lock.`);
    this.name = "OutputBusyError";
  }
}

export class OutputLockReleaseError extends Error {
  constructor(failures: readonly string[], cause: unknown) {
    super(`Output lock cleanup failed: ${failures.join("; ")}`, { cause });
    this.name = "OutputLockReleaseError";
  }
}

export function isOutputLockError(error: unknown): boolean {
  return error instanceof OutputBusyError || error instanceof OutputLockReleaseError;
}

/** Exclusive files coordinate processes; only this scope's acquired locks are removed. */
export async function withOutputLocks<T, Options extends WriteOutputOptions>(
  paths: readonly string[], options: Options, operation: (lockedOptions: Options) => Promise<T>
): Promise<T> {
  throwIfCancelled(options.signal);
  const fs = resolveFileSystem(options.fileSystem);
  const identities = await outputIdentities(paths, fs);
  const parent = (options as ScopedOptions)[lockScope];
  const inherited = parent?.active && parent.fileSystem === options.fileSystem ? parent.identities : new Set<string>();
  const scope: LockScope = { active: true, identities: new Set([...inherited, ...identities]), fileSystem: options.fileSystem };
  const held: HeldLock[] = [];
  let cause: unknown;
  try {
    for (const identity of identities) {
      if (!inherited.has(identity)) await acquireOutputLock(identity, fs, held, options.signal);
    }
    throwIfCancelled(options.signal);
    return await operation(Object.assign({}, options, { [lockScope]: scope }));
  } catch (error) {
    cause = error;
    throw error;
  } finally {
    scope.active = false;
    const failures = await releaseOutputLocks(held, fs);
    if (failures.length > 0) throw new OutputLockReleaseError(failures, cause);
  }
}

async function outputIdentities(paths: readonly string[], fs: OutputFileSystem): Promise<string[]> {
  const identities = await Promise.all(paths.map(async path => {
    const canonical = await canonicalFilePath(resolve(path), fs);
    return process.platform === "win32" ? canonical.toLowerCase() : canonical;
  }));
  return [...new Set(identities)].sort();
}

async function acquireOutputLock(identity: string, fs: OutputFileSystem, held: HeldLock[], signal?: AbortSignal): Promise<void> {
  throwIfCancelled(signal);
  const digest = createHash("sha256").update(identity).digest("hex");
  const path = join(dirname(identity), `.buildmarks-${digest}.lock`);
  let handle: OutputFileHandle;
  try {
    handle = await fs.open(path, "wx");
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "EEXIST") throw new OutputBusyError(path);
    throw error;
  }
  held.push({ path, handle });
  await handle.writeFile(`${JSON.stringify({ pid: process.pid, host: hostname(), destination: identity })}\n`, "utf8");
}

async function releaseOutputLocks(held: readonly HeldLock[], fs: OutputFileSystem): Promise<string[]> {
  const failures: string[] = [];
  for (const lock of [...held].reverse()) {
    try { await lock.handle.close(); }
    catch (error) { failures.push(`${lock.path}: close: ${message(error)}`); }
    try { await fs.rm(lock.path); }
    catch (error) { failures.push(`${lock.path}: remove: ${message(error)}`); }
  }
  return failures;
}

function message(error: unknown): string { return error instanceof Error ? error.message : "unknown failure"; }
