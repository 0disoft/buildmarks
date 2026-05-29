import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { analyzeSignalGaps, renderFallbackCard, renderSignalGapsCard } from "../index";
import { parseProfileInput } from "./render-card";

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
  const resolvedInputPath = resolve(inputPath);
  const resolvedOutputPath = resolve(outputPath);

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

    await writeFile(resolvedOutputPath, svg, "utf8");

    return {
      ok: false,
      inputPath: resolvedInputPath,
      outputPath: resolvedOutputPath,
      fallback: true,
      error: message
    };
  }
}

async function main(args: readonly string[]): Promise<void> {
  const [inputPath, outputPath] = args;

  if (inputPath === undefined || outputPath === undefined) {
    console.error("Usage: bun src/cli/render-gaps-card.ts <profile.json> <output.svg>");
    process.exitCode = 2;
    return;
  }

  const result = await renderGapsCardFile(inputPath, outputPath);

  if (!result.ok) {
    console.error(`Buildmarks wrote fallback SVG: ${result.error ?? "unknown gaps render failure"}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Buildmarks gaps SVG written: ${result.outputPath}`);
}

if (import.meta.main) {
  await main(process.argv.slice(2));
}
