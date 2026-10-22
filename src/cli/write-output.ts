import type { rename } from "node:fs/promises";
import { constants } from "node:fs";
import { randomUUID } from "node:crypto";
import { basename, dirname, join, resolve } from "node:path";
import { canonicalFilePath, resolveFileSystem, type OutputFileSystem, type OutputFileHandle, type WriteOutputOptions } from "./file-system.js";
import { throwIfCancelled } from "../shared/cancellation.js";
export type { WriteOutputOptions } from "./file-system.js";

export function resolveRequiredPath(path: string, label: string): string {
  const normalizedPath = path.trim();
  if (normalizedPath === "") {
    throw new Error(`${label} is required.`);
  }

  return resolve(normalizedPath);
}

export async function tryWriteTextFile(path: string, content: string, options: WriteOutputOptions = {}): Promise<string | undefined> {
  try {
    await writeTextFileAtomically(path, content, options);
    return undefined;
  } catch (error) {
    throwIfCancelled(options.signal);
    return error instanceof Error ? error.message : "unknown file write failure";
  }
}

async function stageTextFile(path: string, content: string, fs: OutputFileSystem, signal?: AbortSignal): Promise<void> {
  let handle: OutputFileHandle | undefined;
  let owned = false;
  try {
    throwIfCancelled(signal);
    handle = await fs.open(path, "wx");
    owned = true;
    await handle.writeFile(content, "utf8");
    throwIfCancelled(signal);
    await handle.sync();
    await handle.close();
    handle = undefined;
    throwIfCancelled(signal);
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (owned) await fs.rm(path, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function writeTextFileAtomically(path: string, content: string, options: WriteOutputOptions = {}): Promise<void> {
  throwIfCancelled(options.signal);
  const fs = resolveFileSystem(options.fileSystem);
  const temporaryPath = join(dirname(path), `.${basename(path)}.${process.pid}.${(options.randomId ?? randomUUID)()}.tmp`);
  await stageTextFile(temporaryPath, content, fs, options.signal);
  try {
    throwIfCancelled(options.signal);
    // Once replacement starts, finish it even if the caller cancels concurrently.
    await fs.rename(temporaryPath, path);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export class OutputSetRollbackError extends Error {
  constructor(cause: unknown, failures: readonly string[]) {
    super(`Output replacement failed: ${cause instanceof Error ? cause.message : "unknown failure"}; recovery was incomplete: ${failures.join("; ")}`, { cause });
    this.name = "OutputSetRollbackError";
  }
}

interface OutputEntry {
  path: string;
  content: string;
  temporaryPath: string;
  backupPath: string;
  existed: boolean;
  temporaryOwned: boolean;
  backupOwned: boolean;
  published: boolean;
  retainBackup: boolean;
}

/** Stage a single-writer output set before publishing; restore it on caught failures. */
export async function writeTextFilesAsSet(
  outputs: readonly { path: string; content: string }[],
  replace?: typeof rename,
  options: WriteOutputOptions = {}
): Promise<void> {
  throwIfCancelled(options.signal);
  const fs = resolveFileSystem(options.fileSystem);
  const paths = outputs.map((output) => resolve(output.path));
  if (new Set(paths).size !== paths.length) throw new Error("Output destinations must be distinct.");
  await assertDistinctOutputIdentities(paths, fs);
  const entries = outputs.map((output, index) =>
    planOutputEntry(output.content, paths[index], process.pid, (options.randomId ?? randomUUID)())
  );
  try {
    for (const entry of entries) await prepareOutputEntry(entry, fs, options.signal);
    throwIfCancelled(options.signal);
    // Commit and recovery deliberately ignore cancellation after this point.
    await publishOutputEntries(entries, replace ?? fs.rename);
  } catch (error) {
    const failures = await restoreOutputEntries(entries, fs);
    if (failures.length > 0) throw new OutputSetRollbackError(error, failures);
    throw error;
  } finally {
    await cleanupOutputEntries(entries, fs);
  }
}

async function assertDistinctOutputIdentities(paths: readonly string[], fs: OutputFileSystem): Promise<void> {
  const identities = await Promise.all(paths.map(async path => {
    const canonical = await canonicalFilePath(path, fs);
    return process.platform === "win32" ? canonical.toLowerCase() : canonical;
  }));
  if (new Set(identities).size !== identities.length) throw new Error("Output destinations must be distinct.");
}

function planOutputEntry(content: string, path: string | undefined, pid: number, id: string): OutputEntry {
  if (path === undefined) throw new Error("Missing output destination.");
  const prefix = join(dirname(path), `.${basename(path)}.${pid}.${id}`);
  return {
    content, path, temporaryPath: `${prefix}.tmp`, backupPath: `${prefix}.bak`,
    existed: false, temporaryOwned: false, backupOwned: false, published: false, retainBackup: false
  };
}

async function prepareOutputEntry(entry: OutputEntry, fs: OutputFileSystem, signal?: AbortSignal): Promise<void> {
  throwIfCancelled(signal);
  try {
    const info = await fs.lstat(entry.path);
    if (!info.isFile()) throw new Error("Output destination must be a regular file.");
    entry.existed = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (entry.existed) {
    await fs.copyFile(entry.path, entry.backupPath, constants.COPYFILE_EXCL);
    entry.backupOwned = true;
  }
  await stageTextFile(entry.temporaryPath, entry.content, fs, signal);
  entry.temporaryOwned = true;
}

async function publishOutputEntries(entries: readonly OutputEntry[], replace: OutputFileSystem["rename"]): Promise<void> {
  for (const entry of entries) {
    await replace(entry.temporaryPath, entry.path);
    entry.temporaryOwned = false;
    entry.published = true;
  }
}

async function restoreOutputEntries(entries: readonly OutputEntry[], fs: OutputFileSystem): Promise<string[]> {
  const failures: string[] = [];
  for (const entry of [...entries].reverse()) {
    if (!entry.published) continue;
    try {
      if (entry.existed) {
        await fs.rename(entry.backupPath, entry.path);
        entry.backupOwned = false;
      } else await fs.rm(entry.path);
    } catch (recoveryError) {
      entry.retainBackup = true;
      failures.push(`${entry.path}: ${recoveryError instanceof Error ? recoveryError.message : "unknown recovery failure"}; backup: ${entry.backupPath}`);
    }
  }
  return failures;
}

async function cleanupOutputEntries(entries: readonly OutputEntry[], fs: OutputFileSystem): Promise<void> {
  for (const entry of entries) {
    if (entry.temporaryOwned) await fs.rm(entry.temporaryPath, { force: true }).catch(() => undefined);
    if (entry.backupOwned && !entry.retainBackup) await fs.rm(entry.backupPath, { force: true }).catch(() => undefined);
  }
}

export async function tryWriteTextFilesAsSet(outputs: readonly { path: string; content: string }[], options: WriteOutputOptions = {}): Promise<string | undefined> {
  try {
    await writeTextFilesAsSet(outputs, undefined, options);
    return undefined;
  } catch (error) {
    if (!(error instanceof OutputSetRollbackError)) throwIfCancelled(options.signal);
    return error instanceof Error ? error.message : "unknown output set write failure";
  }
}

export function appendWriteFailure(message: string, label: string, writeError: string | undefined): string {
  return writeError === undefined ? message : `${message} ${label} write failed: ${writeError}`;
}
