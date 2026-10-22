import { isOutputSafetyError } from "./output-errors.js";
import { readProfileSource, resolveFileSystem } from "./file-system";
import { throwIfCancelled } from "../shared/cancellation";
import { dirname } from "node:path";
import { analyzeSignalGaps, renderFallbackCard, renderSignalGapsCard } from "../index";
import { isOptionLikeArgument, unknownOptionMessage } from "./args";
import { assertInputNotReplaced, runLocalRenderCli } from "./input-output";
import { parseProfileInput } from "./profile-input";
import type { LocalRenderOptions } from "./local-render-options";
import { isMainModule } from "./main";
import { appendWriteFailure, resolveRequiredPath, tryWriteTextFile, writeTextFileAtomically } from "./write-output";

export interface RenderGapsCardFileResult {
  ok: boolean;
  inputPath: string;
  outputPath: string;
  fallback: boolean;
  error?: string;
}

export async function renderGapsCardFile(
  inputPath: string,
  outputPath: string,
  options: LocalRenderOptions = {}
): Promise<RenderGapsCardFileResult> {
  throwIfCancelled(options.signal);
  const fs = resolveFileSystem(options.fileSystem);
  const resolvedInputPath = resolveRequiredPath(inputPath, "Profile JSON path");
  const resolvedOutputPath = resolveRequiredPath(outputPath, "Output SVG path");
  await assertInputNotReplaced(resolvedInputPath, [resolvedOutputPath], options);

  throwIfCancelled(options.signal);
  await fs.mkdir(dirname(resolvedOutputPath), { recursive: true });

  try {
    const rawInput = await readProfileSource(resolvedInputPath, options);
    throwIfCancelled(options.signal);
    const profile = parseProfileInput(JSON.parse(rawInput));
    const report = analyzeSignalGaps(profile, options);
    const svg = renderSignalGapsCard(report, options);

    await writeTextFileAtomically(resolvedOutputPath, svg, options);

    return {
      ok: true,
      inputPath: resolvedInputPath,
      outputPath: resolvedOutputPath,
      fallback: false
    };
  } catch (error) {
    if (isOutputSafetyError(error)) throw error;
    throwIfCancelled(options.signal);
    const message = error instanceof Error ? error.message : "unknown gaps render failure";
    const svg = renderFallbackCard("Buildmarks couldn't generate project suggestions right now");
    const writeError = await tryWriteTextFile(resolvedOutputPath, svg, options);

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

if (isMainModule(import.meta.url)) {
  await runLocalRenderCli(main, process.argv.slice(2));
}
