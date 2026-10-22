import { readProfileSource, resolveFileSystem } from "./file-system";
import { throwIfCancelled } from "../shared/cancellation";
import { join } from "node:path";
import { createStaticReport, renderStaticReportHtml } from "../index";
import { isOptionLikeArgument, unknownOptionMessage } from "./args";
import { assertInputNotReplaced, runLocalRenderCli } from "./input-output";
import { parseProfileInput } from "./profile-input";
import type { LocalRenderOptions } from "./local-render-options";
import { isMainModule } from "./main";
import { appendWriteFailure, OutputSetRollbackError, resolveRequiredPath, tryWriteTextFilesAsSet, writeTextFilesAsSet } from "./write-output";

export interface RenderReportFileResult {
  ok: boolean;
  inputPath: string;
  outputDirectory: string;
  htmlPath: string;
  jsonPath: string;
  error?: string;
}

export async function renderReportFiles(
  inputPath: string,
  outputDirectory: string,
  options: LocalRenderOptions = {}
): Promise<RenderReportFileResult> {
  throwIfCancelled(options.signal);
  const fs = resolveFileSystem(options.fileSystem);
  const resolvedInputPath = resolveRequiredPath(inputPath, "Profile JSON path");
  const resolvedOutputDirectory = resolveRequiredPath(outputDirectory, "Output report directory");
  const htmlPath = join(resolvedOutputDirectory, "buildmarks-report.html");
  const jsonPath = join(resolvedOutputDirectory, "buildmarks-report.json");
  await assertInputNotReplaced(resolvedInputPath, [htmlPath, jsonPath], options);

  throwIfCancelled(options.signal);
  await fs.mkdir(resolvedOutputDirectory, { recursive: true });

  try {
    const rawInput = await readProfileSource(resolvedInputPath, options);
    throwIfCancelled(options.signal);
    const profile = parseProfileInput(JSON.parse(rawInput));
    const report = createStaticReport(profile, options);
    const html = renderStaticReportHtml(report);

    await writeTextFilesAsSet([
      { path: htmlPath, content: html },
      { path: jsonPath, content: `${JSON.stringify(report, null, 2)}\n` }
    ], undefined, options);

    return {
      ok: true,
      inputPath: resolvedInputPath,
      outputDirectory: resolvedOutputDirectory,
      htmlPath,
      jsonPath
    };
  } catch (error) {
    if (!(error instanceof OutputSetRollbackError)) throwIfCancelled(options.signal);
    const message = error instanceof Error ? error.message : "unknown report render failure";
    if (error instanceof OutputSetRollbackError) {
      return { ok: false, inputPath: resolvedInputPath, outputDirectory: resolvedOutputDirectory, htmlPath, jsonPath, error: message };
    }
    const fallbackReport = {
      ok: false,
      error: message,
      message: "Buildmarks couldn't generate this report right now"
    };
    const fallbackHtml = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Buildmarks report unavailable</title></head>
<body>
  <main>
    <h1>Buildmarks report unavailable</h1>
    <p>No score is shown. Buildmarks is not a developer ranking.</p>
  </main>
</body>
</html>`;

    const fallbackWriteFailure = await tryWriteTextFilesAsSet([
      { path: htmlPath, content: fallbackHtml },
      { path: jsonPath, content: `${JSON.stringify(fallbackReport, null, 2)}\n` }
    ], options);

    return {
      ok: false,
      inputPath: resolvedInputPath,
      outputDirectory: resolvedOutputDirectory,
      htmlPath,
      jsonPath,
      error: appendWriteFailure(message, "Fallback report", fallbackWriteFailure)
    };
  }
}

async function main(args: readonly string[]): Promise<void> {
  const parsed = parseArgs(args);
  if (parsed.ok === false) {
    console.error(parsed.message);
    console.error("Usage: bun src/cli/render-report.ts <profile.json> <output-directory>");
    process.exitCode = 2;
    return;
  }

  const result = await renderReportFiles(parsed.inputPath, parsed.outputDirectory);

  if (!result.ok) {
    console.error(`Buildmarks report generation failed: ${result.error ?? "unknown report render failure"}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Buildmarks report written: ${result.htmlPath}`);
  console.log(`Buildmarks JSON written: ${result.jsonPath}`);
}

function parseArgs(args: readonly string[]):
  | { ok: true; inputPath: string; outputDirectory: string }
  | { ok: false; message: string } {
  const [inputPath, outputDirectory, ...extra] = args;

  if (inputPath === undefined || inputPath.trim() === "") {
    return { ok: false, message: "Profile JSON path is required." };
  }
  if (outputDirectory === undefined || outputDirectory.trim() === "") {
    return { ok: false, message: "Output report directory is required." };
  }
  if (isOptionLikeArgument(inputPath)) {
    return { ok: false, message: unknownOptionMessage(inputPath) };
  }
  if (isOptionLikeArgument(outputDirectory)) {
    return { ok: false, message: unknownOptionMessage(outputDirectory) };
  }
  if (extra.length > 0) {
    return { ok: false, message: `Unexpected positional argument: ${extra[0]}` };
  }

  return { ok: true, inputPath, outputDirectory };
}

if (isMainModule(import.meta.url)) {
  await runLocalRenderCli(main, process.argv.slice(2));
}
