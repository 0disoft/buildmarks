import { realpath, stat } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

export class InputOutputCollisionError extends Error {
  constructor(outputPath: string) {
    super(`Output path would replace profile input: ${outputPath}. Choose a different output path.`);
    this.name = "InputOutputCollisionError";
  }
}

/** Validate all destinations before creating directories or publishing fallback output. */
export async function assertInputNotReplaced(inputPath: string, outputPaths: readonly string[]): Promise<void> {
  const input = resolve(inputPath);
  const inputIdentity = await canonicalPath(input);
  const inputFile = await fileIdentity(input);
  for (const path of outputPaths) {
    const output = resolve(path);
    if (output === input || await canonicalPath(output) === inputIdentity) {
      throw new InputOutputCollisionError(output);
    }
    const outputFile = await fileIdentity(output);
    if (inputFile && outputFile && inputFile.ino !== 0n && inputFile.dev === outputFile.dev && inputFile.ino === outputFile.ino) {
      throw new InputOutputCollisionError(output);
    }
  }
}

async function canonicalPath(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch (error) {
    if (!isMissingPath(error)) throw error;
    const parent = dirname(path);
    if (parent === path) return path;
    return resolve(await canonicalPath(parent), basename(path));
  }
}

async function fileIdentity(path: string) {
  try {
    return await stat(path, { bigint: true });
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
