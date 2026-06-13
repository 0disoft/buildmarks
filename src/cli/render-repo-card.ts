import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  renderFallbackCard,
  renderRepositorySignalCard,
  scoreRepository,
  type RepositoryInput
} from "../index";
import { parseProfileInput } from "./render-card";
import { appendWriteFailure, tryWriteTextFile } from "./write-output";

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
  const resolvedInputPath = resolve(inputPath);
  const resolvedOutputPath = resolve(outputPath);

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
  const [inputPath, repositoryRef, outputPath] = args;

  if (inputPath === undefined || repositoryRef === undefined || outputPath === undefined) {
    console.error("Usage: bun src/cli/render-repo-card.ts <profile.json> <repo|owner/repo> <output.svg>");
    process.exitCode = 2;
    return;
  }

  const result = await renderRepoCardFile(inputPath, repositoryRef, outputPath);

  if (!result.ok) {
    console.error(`Buildmarks wrote fallback SVG: ${result.error ?? "unknown repository render failure"}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Buildmarks repository SVG written: ${result.outputPath}`);
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
