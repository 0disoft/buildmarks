import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  collectPublicGitHubProfile,
  createStaticReport,
  defaultGitHubCollectorPolicy,
  normalizePublicGitHubProfile,
  renderStaticReportHtml,
  type CollectPublicGitHubProfileOptions
} from "../index";

export interface RenderGitHubReportFilesOptions extends CollectPublicGitHubProfileOptions {}

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
  const resolvedOutputDirectory = resolve(outputDirectory);
  const htmlPath = join(resolvedOutputDirectory, "buildmarks-report.html");
  const jsonPath = join(resolvedOutputDirectory, "buildmarks-report.json");

  await mkdir(resolvedOutputDirectory, { recursive: true });

  try {
    const collected = await collectPublicGitHubProfile(username, options);
    const profile = normalizePublicGitHubProfile(collected);
    const report = createStaticReport(profile);
    const html = renderStaticReportHtml(report);

    await writeFile(htmlPath, html, "utf8");
    await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    return {
      ok: true,
      username,
      outputDirectory: resolvedOutputDirectory,
      htmlPath,
      jsonPath
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown GitHub report render failure";
    const fallbackReport = {
      ok: false,
      username,
      error: message,
      message: "Buildmarks GitHub report is temporarily unavailable"
    };
    const fallbackHtml = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Buildmarks GitHub report unavailable</title></head>
<body>
  <main>
    <h1>Buildmarks GitHub report unavailable</h1>
    <p>Public GitHub signals only. Not a developer ranking.</p>
  </main>
</body>
</html>`;

    await writeFile(htmlPath, fallbackHtml, "utf8");
    await writeFile(jsonPath, `${JSON.stringify(fallbackReport, null, 2)}\n`, "utf8");

    return {
      ok: false,
      username,
      outputDirectory: resolvedOutputDirectory,
      htmlPath,
      jsonPath,
      error: message
    };
  }
}

async function main(args: readonly string[]): Promise<void> {
  const parsed = parseArgs(args);
  if (parsed.ok === false) {
    console.error(parsed.message);
    console.error(
      "Usage: bun src/cli/render-github-report.ts <github-username> <output-directory> [--token <token>] [--max-repositories-scanned <n>] [--max-repositories-scored <n>] [--activity-window-days <n>]"
    );
    process.exitCode = 2;
    return;
  }

  const result = await renderGitHubReportFiles(parsed.username, parsed.outputDirectory, {
    token: parsed.token,
    policy: {
      ...defaultGitHubCollectorPolicy,
      limits: {
        maxRepositoriesScannedPerProfile: parsed.maxRepositoriesScanned,
        maxRepositoriesScoredPerProfile: parsed.maxRepositoriesScored,
        repositoryActivityWindowDays: parsed.activityWindowDays
      }
    }
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
    }
  | { ok: false; message: string } {
  const positional: string[] = [];
  let token: string | undefined;
  let maxRepositoriesScanned = defaultGitHubCollectorPolicy.limits.maxRepositoriesScannedPerProfile;
  let maxRepositoriesScored = defaultGitHubCollectorPolicy.limits.maxRepositoriesScoredPerProfile;
  let activityWindowDays = defaultGitHubCollectorPolicy.limits.repositoryActivityWindowDays;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === undefined) {
      continue;
    }

    if (arg === "--token") {
      const value = args[index + 1];
      if (value === undefined || value.trim() === "") {
        return { ok: false, message: "Missing value for --token." };
      }
      token = value;
      index += 1;
      continue;
    }

    if (arg === "--max-repositories-scanned") {
      const value = parsePositiveIntegerOption(arg, args[index + 1]);
      if (typeof value === "string") {
        return { ok: false, message: value };
      }
      maxRepositoriesScanned = value;
      index += 1;
      continue;
    }

    if (arg === "--max-repositories-scored") {
      const value = parsePositiveIntegerOption(arg, args[index + 1]);
      if (typeof value === "string") {
        return { ok: false, message: value };
      }
      maxRepositoriesScored = value;
      index += 1;
      continue;
    }

    if (arg === "--activity-window-days") {
      const value = parsePositiveIntegerOption(arg, args[index + 1]);
      if (typeof value === "string") {
        return { ok: false, message: value };
      }
      activityWindowDays = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--")) {
      return { ok: false, message: `Unknown option: ${arg}` };
    }

    positional.push(arg);
  }

  const [username, outputDirectory] = positional;
  if (username === undefined || username.trim() === "") {
    return { ok: false, message: "GitHub username is required." };
  }
  if (outputDirectory === undefined || outputDirectory.trim() === "") {
    return { ok: false, message: "Output report directory is required." };
  }

  return token === undefined
    ? { ok: true, username, outputDirectory, maxRepositoriesScanned, maxRepositoriesScored, activityWindowDays }
    : { ok: true, username, outputDirectory, token, maxRepositoriesScanned, maxRepositoriesScored, activityWindowDays };
}

function parsePositiveIntegerOption(name: string, rawValue: string | undefined): number | string {
  if (rawValue === undefined || rawValue.trim() === "") {
    return `Missing value for ${name}.`;
  }

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    return `${name} must be a positive integer.`;
  }

  return value;
}

if (import.meta.main) {
  await main(process.argv.slice(2));
}
