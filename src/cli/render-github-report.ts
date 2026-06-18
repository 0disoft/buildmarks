import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildGitHubCollectorPolicyFromCli, parseCommonGitHubCliOptions } from "./options";
import { appendWriteFailure, resolveRequiredPath, tryWriteTextFile } from "./write-output";
import {
  collectOwnerSuppliedGitHubProfile,
  collectPublicGitHubProfile,
  createStaticReport,
  normalizePublicGitHubProfile,
  renderStaticReportHtml,
  type CollectPublicGitHubProfileOptions
} from "../index";

export interface RenderGitHubReportFilesOptions extends CollectPublicGitHubProfileOptions {
  privateLocal?: boolean;
}

export interface RenderGitHubReportFilesResult {
  ok: boolean;
  username: string;
  outputDirectory: string;
  htmlPath: string;
  jsonPath: string;
  error?: string;
}

export async function renderGitHubReportFiles(
  username: string,
  outputDirectory: string,
  options: RenderGitHubReportFilesOptions = {}
): Promise<RenderGitHubReportFilesResult> {
  const normalizedUsername = resolveRequiredGitHubUsername(username);
  const resolvedOutputDirectory = resolveRequiredPath(outputDirectory, "Output report directory");
  const htmlPath = join(resolvedOutputDirectory, "buildmarks-report.html");
  const jsonPath = join(resolvedOutputDirectory, "buildmarks-report.json");

  await mkdir(resolvedOutputDirectory, { recursive: true });

  try {
    const collected = options.privateLocal === true
      ? await collectOwnerSuppliedGitHubProfile(normalizedUsername, options)
      : await collectPublicGitHubProfile(normalizedUsername, options);
    const profile = normalizePublicGitHubProfile(collected);
    const scoringOptions = options.policy === undefined
      ? {}
      : { maxRepositories: options.policy.limits.maxRepositoriesScoredPerProfile };
    const report = createStaticReport(profile, scoringOptions);
    const html = renderStaticReportHtml(report);

    await writeFile(htmlPath, html, "utf8");
    await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    return {
      ok: true,
      username: report.profile.username,
      outputDirectory: resolvedOutputDirectory,
      htmlPath,
      jsonPath
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown GitHub report render failure";
    const fallbackReport = {
      ok: false,
      username: normalizedUsername,
      error: message,
      message: "Buildmarks GitHub report is temporarily unavailable"
    };
    const fallbackHtml = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Buildmarks GitHub report unavailable</title></head>
<body>
  <main>
    <h1>Buildmarks GitHub report unavailable</h1>
    <p>No signal score is shown. Not a developer ranking.</p>
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
      username: normalizedUsername,
      outputDirectory: resolvedOutputDirectory,
      htmlPath,
      jsonPath,
      error: appendWriteFailure(message, "Fallback report", fallbackWriteFailures.join("; ") || undefined)
    };
  }
}

async function main(args: readonly string[]): Promise<void> {
  const parsed = parseArgs(args);
  if (parsed.ok === false) {
    console.error(parsed.message);
    console.error(
      "Usage: bun src/cli/render-github-report.ts <github-username> <output-directory> [--token <token>] [--private-local] [--max-repositories-scanned <n>] [--max-repositories-scored <n>] [--activity-window-days <n>]"
    );
    process.exitCode = 2;
    return;
  }

  const result = await renderGitHubReportFiles(parsed.username, parsed.outputDirectory, {
    privateLocal: parsed.privateLocal,
    ...(parsed.token === undefined ? {} : { token: parsed.token }),
    policy: buildGitHubCollectorPolicyFromCli(parsed)
  });

  if (!result.ok) {
    console.error(`Buildmarks wrote fallback GitHub report: ${result.error ?? "unknown report render failure"}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Buildmarks GitHub report written: ${result.htmlPath}`);
  console.log(`Buildmarks GitHub JSON written: ${result.jsonPath}`);
}

function parseArgs(args: readonly string[]):
  | {
      ok: true;
      username: string;
      outputDirectory: string;
      token?: string;
      maxRepositoriesScanned: number;
      maxRepositoriesScored: number;
      activityWindowDays: number;
      privateLocal: boolean;
    }
  | { ok: false; message: string } {
  const common = parseCommonGitHubCliOptions(args);
  if (common.ok === false) {
    return common;
  }

  const { positional, ...options } = common.value;
  const [username, outputDirectory, ...extra] = positional;
  if (username === undefined || username.trim() === "") {
    return { ok: false, message: "GitHub username is required." };
  }
  if (outputDirectory === undefined || outputDirectory.trim() === "") {
    return { ok: false, message: "Output report directory is required." };
  }
  if (extra.length > 0) {
    return { ok: false, message: `Unexpected positional argument: ${extra[0]}` };
  }

  return { ok: true, username, outputDirectory, ...options };
}

function resolveRequiredGitHubUsername(username: string): string {
  const normalizedUsername = username.trim();
  if (normalizedUsername === "") {
    throw new Error("GitHub username is required.");
  }

  return normalizedUsername;
}


if (import.meta.main) {
  await main(process.argv.slice(2));
}
