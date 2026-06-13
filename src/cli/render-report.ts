import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createStaticReport, renderStaticReportHtml } from "../index";
import { parseProfileInput } from "./render-card";
import { appendWriteFailure, tryWriteTextFile } from "./write-output";

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
  outputDirectory: string
): Promise<RenderReportFileResult> {
  const resolvedInputPath = resolve(inputPath);
  const resolvedOutputDirectory = resolve(outputDirectory);
  const htmlPath = join(resolvedOutputDirectory, "buildmarks-report.html");
  const jsonPath = join(resolvedOutputDirectory, "buildmarks-report.json");

  await mkdir(resolvedOutputDirectory, { recursive: true });

  try {
    const rawInput = await readFile(resolvedInputPath, "utf8");
    const profile = parseProfileInput(JSON.parse(rawInput));
    const report = createStaticReport(profile);
    const html = renderStaticReportHtml(report);

    await writeFile(htmlPath, html, "utf8");
    await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    return {
      ok: true,
      inputPath: resolvedInputPath,
      outputDirectory: resolvedOutputDirectory,
      htmlPath,
      jsonPath
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown report render failure";
    const fallbackReport = {
      ok: false,
      error: message,
      message: "Buildmarks report is temporarily unavailable"
    };
    const fallbackHtml = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Buildmarks report unavailable</title></head>
<body>
  <main>
    <h1>Buildmarks report unavailable</h1>
    <p>Public GitHub signals only. Not a developer ranking.</p>
  </main>
</body>
</html>`;

    const fallbackWriteFailures = (
      await Promise.all([
        tryWriteTextFile(htmlPath, fallbackHtml),
        tryWriteTextFile(jsonPath, `${JSON.stringify(fallbackReport, null, 2)}\n`)
      ])
    ).filter((failure): failure is string => failure !== undefined);

    return {
      ok: false,
      inputPath: resolvedInputPath,
      outputDirectory: resolvedOutputDirectory,
      htmlPath,
      jsonPath,
      error: appendWriteFailure(message, "Fallback report", fallbackWriteFailures.join("; ") || undefined)
    };
  }
}

async function main(args: readonly string[]): Promise<void> {
  const [inputPath, outputDirectory] = args;

  if (inputPath === undefined || outputDirectory === undefined) {
    console.error("Usage: bun src/cli/render-report.ts <profile.json> <output-directory>");
    process.exitCode = 2;
    return;
  }

  const result = await renderReportFiles(inputPath, outputDirectory);

  if (!result.ok) {
    console.error(`Buildmarks wrote fallback report: ${result.error ?? "unknown report render failure"}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Buildmarks report written: ${result.htmlPath}`);
  console.log(`Buildmarks JSON written: ${result.jsonPath}`);
}

if (import.meta.main) {
  await main(process.argv.slice(2));
}
