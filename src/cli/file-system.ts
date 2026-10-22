import { access, copyFile, lstat, mkdir, open, readFile, realpath, rename, rm, stat } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { runAbortable, throwIfCancelled } from "../shared/cancellation.js";

export interface OutputFileHandle {
  writeFile(content: string, encoding: "utf8"): Promise<unknown>;
  sync(): Promise<void>;
  close(): Promise<void>;
}

export interface OutputFileSystem {
  realpath(path: string): Promise<string>;
  open(path: string, flags: "wx"): Promise<OutputFileHandle>;
  copyFile(source: string, destination: string, mode: number): Promise<void>;
  lstat(path: string): Promise<{ isFile(): boolean }>;
  rename(source: string, destination: string): Promise<void>;
  rm(path: string, options?: { force?: boolean }): Promise<void>;
}

export interface RenderFileSystem extends OutputFileSystem {
  readFile(path: string, encoding: "utf8", signal?: AbortSignal): Promise<string>;
  mkdir(path: string, options: { recursive: true }): Promise<unknown>;
  stat(path: string, options: { bigint: true }): Promise<{ ino: bigint; dev: bigint }>;
  access(path: string): Promise<void>;
}

export interface WriteOutputOptions {
  signal?: AbortSignal;
  randomId?: () => string;
  fileSystem?: Partial<OutputFileSystem>;
}

export interface RenderFileOptions extends WriteOutputOptions {
  fileSystem?: Partial<RenderFileSystem>;
}

const defaultFileSystem: RenderFileSystem = {
  open, copyFile, lstat, rename, rm, mkdir, realpath, stat, access,
  readFile: (path, encoding, signal) => readFile(path, { encoding, ...(signal === undefined ? {} : { signal }) })
};

export function resolveFileSystem(overrides: Partial<RenderFileSystem> = {}): RenderFileSystem {
  return { ...defaultFileSystem, ...overrides };
}

export async function canonicalFilePath(path: string, fs: OutputFileSystem): Promise<string> {
  try {
    return await fs.realpath(path);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT" && code !== "ENOTDIR") throw error;
    const parent = dirname(path);
    if (parent === path) return path;
    return resolve(await canonicalFilePath(parent, fs), basename(path));
  }
}

export async function readProfileSource(path: string, options: RenderFileOptions): Promise<string> {
  throwIfCancelled(options.signal);
  const read = () => resolveFileSystem(options.fileSystem).readFile(path, "utf8", options.signal);
  return options.signal === undefined ? read() : runAbortable(read, options.signal);
}
