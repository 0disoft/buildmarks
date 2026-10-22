import { isOutputSafetyError } from "./output-errors.js";
import { readProfileSource, resolveFileSystem } from "./file-system";
import { throwIfCancelled } from "../shared/cancellation";
import { dirname } from "node:path";
import { isOptionLikeArgument, unknownOptionMessage } from "./args";
import { parseCardLayoutOptions } from "./card-options";
import { assertInputNotReplaced, runLocalRenderCli } from "./input-output";
import { isMainModule } from "./main";
import { appendWriteFailure, resolveRequiredPath, tryWriteTextFile, writeTextFileAtomically } from "./write-output";
import { parseProfileInput } from "./profile-input";
import type { LocalRenderOptions } from "./local-render-options";
export { parseProfileInput } from "./profile-input";
import {
  renderFallbackCard,
  renderUserSignalCard,
  scoreUserProfile,
  type RenderCardOptions
} from "../index";

export interface RenderCardFileOptions extends LocalRenderOptions {}

export interface RenderCardFileResult {
  ok: boolean;
  inputPath: string;
  outputPath: string;
  fallback: boolean;
  error?: string;
}

export async function renderCardFile(
  inputPath: string,
  outputPath: string,
  options: RenderCardFileOptions = {}
): Promise<RenderCardFileResult> {
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
    const report = scoreUserProfile(profile, options);
    const svg = renderUserSignalCard(report, options);

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
    const message = error instanceof Error ? error.message : "unknown render failure";
    const svg = renderFallbackCard("Buildmarks couldn't generate this report right now", options);
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
    console.error("Usage: bun src/cli/render-card.ts <profile.json> <output.svg> [--layout compact|detailed]");
    process.exitCode = 2;
    return;
  }

  const result = await renderCardFile(parsed.inputPath, parsed.outputPath, { layout: parsed.layout });

  if (!result.ok) {
    console.error(`Buildmarks wrote fallback SVG: ${result.error ?? "unknown render failure"}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Buildmarks SVG written: ${result.outputPath}`);
}

function parseArgs(args: readonly string[]):
  | { ok: true; inputPath: string; outputPath: string; layout: "compact" | "detailed" }
  | { ok: false; message: string } {
  const positional: string[] = [];
  const card = parseCardLayoutOptions(args);
  if (!card.ok) return card;
  args = card.args;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === undefined) {
      continue;
    }

    if (isOptionLikeArgument(arg)) {
      return { ok: false, message: unknownOptionMessage(arg) };
    }

    positional.push(arg);
  }

  const [inputPath, outputPath, ...extra] = positional;
  if (inputPath === undefined || inputPath.trim() === "") {
    return { ok: false, message: "Profile JSON path is required." };
  }
  if (outputPath === undefined || outputPath.trim() === "") {
    return { ok: false, message: "Output SVG path is required." };
  }
  if (extra.length > 0) {
    return { ok: false, message: `Unexpected positional argument: ${extra[0]}` };
  }

  return { ok: true, inputPath, outputPath, layout: card.layout };
}

if (isMainModule(import.meta.url)) {
  await runLocalRenderCli(main, process.argv.slice(2));
}
