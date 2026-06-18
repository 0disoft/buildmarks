import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  renderFallbackCard,
  renderRepositorySignalCard,
  scoreRepository,
  type RepositoryInput
} from "../index";
import { isOptionLikeArgument, unknownOptionMessage } from "./args";
import { parseProfileInput } from "./render-card";
import { appendWriteFailure, resolveRequiredPath, tryWriteTextFile } from "./write-output";

export interface RenderRepoCardFileResult {
  ok: boolean;
  inputPath: string;
  outputPath: string;
  repository: string;
  fallback: boolean;
  error?: string;
}

export async function renderRepoCardFile(
  inputPath: string,
  repositoryRef: string,
  outputPath: string
): Promise<RenderRepoCardFileResult> {
  const resolvedInputPath = resolveRequiredPath(inputPath, "Profile JSON path");
  const resolvedOutputPath = resolveRequiredPath(outputPath, "Output SVG path");

  await mkdir(dirname(resolvedOutputPath), { recursive: true });

  try {
    const rawInput = await readFile(resolvedInputPath, "utf8");
    const profile = parseProfileInput(JSON.parse(rawInput));
    const repository = findRepository(profile.repositories, repositoryRef);
    if (repository === null) {
      throw new Error(`repository ${repositoryRef} was not found in profile input`);
    }

    const report = scoreRepository(repository);
    const svg = renderRepositorySignalCard(report);

    await writeFile(resolvedOutputPath, svg, "utf8");

    return {
      ok: true,
      inputPath: resolvedInputPath,
      outputPath: resolvedOutputPath,
      repository: repositoryRef,
      fallback: false
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown repository render failure";
    const svg = renderFallbackCard("Buildmarks repository signal report is temporarily unavailable");
    const writeError = await tryWriteTextFile(resolvedOutputPath, svg);

    return {
      ok: false,
      inputPath: resolvedInputPath,
      outputPath: resolvedOutputPath,
      repository: repositoryRef,
      fallback: true,
      error: appendWriteFailure(message, "Fallback SVG", writeError)
    };
  }
}

async function main(args: readonly string[]): Promise<void> {
  const parsed = parseArgs(args);
  if (parsed.ok === false) {
    console.error(parsed.message);
    console.error("Usage: bun src/cli/render-repo-card.ts <profile.json> <repo|owner/repo> <output.svg>");
    process.exitCode = 2;
    return;
  }

  const result = await renderRepoCardFile(parsed.inputPath, parsed.repositoryRef, parsed.outputPath);

  if (!result.ok) {
    console.error(`Buildmarks wrote fallback SVG: ${result.error ?? "unknown repository render failure"}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Buildmarks repository SVG written: ${result.outputPath}`);
}

function parseArgs(args: readonly string[]):
  | { ok: true; inputPath: string; repositoryRef: string; outputPath: string }
  | { ok: false; message: string } {
  const [inputPath, repositoryRef, outputPath, ...extra] = args;

  if (inputPath === undefined || inputPath.trim() === "") {
    return { ok: false, message: "Profile JSON path is required." };
  }
  if (repositoryRef === undefined || repositoryRef.trim() === "") {
    return { ok: false, message: "Repository reference is required." };
  }
  if (outputPath === undefined || outputPath.trim() === "") {
    return { ok: false, message: "Output SVG path is required." };
  }
  if (isOptionLikeArgument(inputPath)) {
    return { ok: false, message: unknownOptionMessage(inputPath) };
  }
  if (isOptionLikeArgument(repositoryRef)) {
    return { ok: false, message: unknownOptionMessage(repositoryRef) };
  }
  if (isOptionLikeArgument(outputPath)) {
    return { ok: false, message: unknownOptionMessage(outputPath) };
  }
  if (extra.length > 0) {
    return { ok: false, message: `Unexpected positional argument: ${extra[0]}` };
  }

  return { ok: true, inputPath, repositoryRef, outputPath };
}

function findRepository(repositories: readonly RepositoryInput[], repositoryRef: string): RepositoryInput | null {
  const normalizedRef = repositoryRef.trim().toLowerCase();
  if (normalizedRef === "") {
    return null;
  }

  return repositories.find((repository) => {
    const name = repository.name.toLowerCase();
    const fullName = `${repository.owner}/${repository.name}`.toLowerCase();
    return normalizedRef === name || normalizedRef === fullName;
  }) ?? null;
}

if (import.meta.main) {
  await main(process.argv.slice(2));
}
