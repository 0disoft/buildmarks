import { copyFile, lstat, open, rename, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { randomUUID } from "node:crypto";
import { basename, dirname, join, resolve } from "node:path";

export function resolveRequiredPath(path: string, label: string): string {
  const normalizedPath = path.trim();
  if (normalizedPath === "") {
    throw new Error(`${label} is required.`);
  }

  return resolve(normalizedPath);
}

export async function tryWriteTextFile(path: string, content: string): Promise<string | undefined> {
  try {
    await writeTextFileAtomically(path, content);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : "unknown file write failure";
  }
}

export async function writeTextFileAtomically(path: string, content: string): Promise<void> {
  const temporaryPath = join(dirname(path), `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`);
  let handle: Awaited<ReturnType<typeof open>> | undefined;

  try {
    handle = await open(temporaryPath, "wx");
    await handle.writeFile(content, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporaryPath, path);
  } catch (error) {
    await handle?.close().catch(() => undefined);
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export class OutputSetRollbackError extends Error {
  constructor(cause: unknown, failures: readonly string[]) {
    super(`Output replacement failed: ${cause instanceof Error ? cause.message : "unknown failure"}; recovery was incomplete: ${failures.join("; ")}`, { cause });
    this.name = "OutputSetRollbackError";
  }
}

/** Stage a single-writer output set before publishing; restore it on caught failures. */
export async function writeTextFilesAsSet(
  outputs: readonly { path: string; content: string }[],
  replace: typeof rename = rename
): Promise<void> {
  const paths = outputs.map((output) => resolve(output.path));
  if (new Set(paths).size !== paths.length) throw new Error("Output destinations must be distinct.");
  const entries = outputs.map((output, index) => {
    const path = paths[index];
    if (path === undefined) throw new Error("Missing output destination.");
    const prefix = join(dirname(path), `.${basename(path)}.${process.pid}.${randomUUID()}`);
    return { ...output, path, temporaryPath: `${prefix}.tmp`, backupPath: `${prefix}.bak`, existed: false, published: false, retainBackup: false };
  });
  try {
    for (const entry of entries) {
      try {
        const info = await lstat(entry.path);
        if (!info.isFile()) throw new Error("Output destination must be a regular file.");
        entry.existed = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      if (entry.existed) await copyFile(entry.path, entry.backupPath, constants.COPYFILE_EXCL);
      await writeTextFileAtomically(entry.temporaryPath, entry.content);
    }
    for (const entry of entries) {
      await replace(entry.temporaryPath, entry.path);
      entry.published = true;
    }
  } catch (error) {
    const failures: string[] = [];
    for (const entry of [...entries].reverse()) {
      if (!entry.published) continue;
      try {
        if (entry.existed) await rename(entry.backupPath, entry.path);
        else await rm(entry.path);
      } catch (recoveryError) {
        entry.retainBackup = true;
        failures.push(`${entry.path}: ${recoveryError instanceof Error ? recoveryError.message : "unknown recovery failure"}; backup: ${entry.backupPath}`);
      }
    }
    if (failures.length > 0) throw new OutputSetRollbackError(error, failures);
    throw error;
  } finally {
    for (const entry of entries) {
      await rm(entry.temporaryPath, { force: true }).catch(() => undefined);
      if (!entry.retainBackup) await rm(entry.backupPath, { force: true }).catch(() => undefined);
    }
  }
}

export async function tryWriteTextFilesAsSet(outputs: readonly { path: string; content: string }[]): Promise<string | undefined> {
  try {
    await writeTextFilesAsSet(outputs);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : "unknown output set write failure";
  }
}

export function appendWriteFailure(message: string, label: string, writeError: string | undefined): string {
  return writeError === undefined ? message : `${message} ${label} write failed: ${writeError}`;
}
