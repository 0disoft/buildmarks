import { resolve } from "node:path";
import { canonicalFilePath, resolveFileSystem, type RenderFileOptions, type RenderFileSystem } from "./file-system.js";
import { throwIfCancelled } from "../shared/cancellation.js";

export class InputOutputCollisionError extends Error {
  constructor(outputPath: string) {
    super(`Output path would replace profile input: ${outputPath}. Choose a different output path.`);
    this.name = "InputOutputCollisionError";
  }
}

/** Validate all destinations before creating directories or publishing fallback output. */
export async function assertInputNotReplaced(inputPath: string, outputPaths: readonly string[], options: RenderFileOptions = {}): Promise<void> {
  throwIfCancelled(options.signal);
  const fs = resolveFileSystem(options.fileSystem);
  const input = resolve(inputPath);
  const inputIdentity = await canonicalFilePath(input, fs);
  const inputFile = await fileIdentity(input, fs);
  for (const path of outputPaths) {
    throwIfCancelled(options.signal);
    const output = resolve(path);
    if (output === input || await canonicalFilePath(output, fs) === inputIdentity) {
      throw new InputOutputCollisionError(output);
    }
    const outputFile = await fileIdentity(output, fs);
    if (inputFile && outputFile && inputFile.ino !== 0n && inputFile.dev === outputFile.dev && inputFile.ino === outputFile.ino) {
      throw new InputOutputCollisionError(output);
    }
  }
}

async function fileIdentity(path: string, fs: RenderFileSystem) {
  try {
    return await fs.stat(path, { bigint: true });
  } catch (error) {
    if (!isMissingPath(error)) throw error;
    return undefined;
  }
}

function isMissingPath(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === "ENOENT" || code === "ENOTDIR";
}

export async function runLocalRenderCli(main: (args: readonly string[]) => Promise<void>, args: readonly string[]): Promise<void> {
  try {
    await main(args);
  } catch (error) {
    if (!(error instanceof InputOutputCollisionError)) throw error;
    console.error(error.message);
    process.exitCode = 2;
  }
}
