import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { analyzeSignalGaps, renderFallbackCard, renderSignalGapsCard } from "../index";
import { isOptionLikeArgument, unknownOptionMessage } from "./args";
import { parseProfileInput } from "./render-card";
import { appendWriteFailure, resolveRequiredPath, tryWriteTextFile } from "./write-output";

export interface RenderGapsCardFileResult {
  ok: boolean;
  inputPath: string;
  outputPath: string;
  fallback: boolean;
  error?: string;
}

export async function renderGapsCardFile(
  inputPath: string,
  outputPath: string
): Promise<RenderGapsCardFileResult> {
  const resolvedInputPath = resolveRequiredPath(inputPath, "Profile JSON path");
  const resolvedOutputPath = resolveRequiredPath(outputPath, "Output SVG path");

  await mkdir(dirname(resolvedOutputPath), { recursive: true });

  try {
    const rawInput = await readFile(resolvedInputPath, "utf8");
    const profile = parseProfileInput(JSON.parse(rawInput));
    const report = analyzeSignalGaps(profile);
    const svg = renderSignalGapsCard(report);

    await writeFile(resolvedOutputPath, svg, "utf8");

    return {
      ok: true,
      inputPath: resolvedInputPath,
      outputPath: resolvedOutputPath,
      fallback: false
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown gaps render failure";
    const svg = renderFallbackCard("Buildmarks signal gaps report is temporarily unavailable");
    const writeError = await tryWriteTextFile(resolvedOutputPath, svg);

    return {
      ok: false,
      inputPath: resolvedInputPath,
      outputPath: resolvedOutputPath,
      fallback: true,
      error: appendWriteFailure(message, "Fallback SVG", writeError)
    };
  }
}

async function main(args: readonly string[]): Promise<void> {
  const parsed = parseArgs(args);
  if (parsed.ok === false) {
    console.error(parsed.message);
    console.error("Usage: bun src/cli/render-gaps-card.ts <profile.json> <output.svg>");
    process.exitCode = 2;
    return;
  }

  const result = await renderGapsCardFile(parsed.inputPath, parsed.outputPath);

  if (!result.ok) {
    console.error(`Buildmarks wrote fallback SVG: ${result.error ?? "unknown gaps render failure"}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Buildmarks gaps SVG written: ${result.outputPath}`);
}

function parseArgs(args: readonly string[]):
  | { ok: true; inputPath: string; outputPath: string }
  | { ok: false; message: string } {
  const [inputPath, outputPath, ...extra] = args;

  if (inputPath === undefined || inputPath.trim() === "") {
    return { ok: false, message: "Profile JSON path is required." };
  }
  if (outputPath === undefined || outputPath.trim() === "") {
    return { ok: false, message: "Output SVG path is required." };
  }
  if (isOptionLikeArgument(inputPath)) {
    return { ok: false, message: unknownOptionMessage(inputPath) };
  }
  if (isOptionLikeArgument(outputPath)) {
    return { ok: false, message: unknownOptionMessage(outputPath) };
  }
  if (extra.length > 0) {
    return { ok: false, message: `Unexpected positional argument: ${extra[0]}` };
  }

  return { ok: true, inputPath, outputPath };
}

if (import.meta.main) {
  await main(process.argv.slice(2));
}
