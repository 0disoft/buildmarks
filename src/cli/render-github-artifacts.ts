import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import {
  collectPublicGitHubProfile,
  createStaticReport,
  defaultGitHubCollectorPolicy,
  normalizePublicGitHubProfile,
  renderFallbackCard,
  renderStaticReportHtml,
  renderUserSignalCard,
  scoreUserProfile,
  type CollectPublicGitHubProfileOptions
} from "../index";

export interface RenderGitHubArtifactsOptions extends CollectPublicGitHubProfileOptions {}

export interface RenderGitHubArtifactsResult {
  ok: boolean;
  username: string;
  svgPath: string;
  reportDirectory: string;
  htmlPath: string;
  jsonPath: string;
  fallback: boolean;
  error?: string;
}

export async function renderGitHubArtifacts(
  username: string,
  svgOutputPath: string,
  reportOutputDirectory: string,
  options: RenderGitHubArtifactsOptions = {}
): Promise<RenderGitHubArtifactsResult> {
  const resolvedSvgPath = resolve(svgOutputPath);
  const resolvedReportDirectory = resolve(reportOutputDirectory);
  const htmlPath = join(resolvedReportDirectory, "buildmarks-report.html");
  const jsonPath = join(resolvedReportDirectory, "buildmarks-report.json");

  await mkdir(dirname(resolvedSvgPath), { recursive: true });
  await mkdir(resolvedReportDirectory, { recursive: true });

  try {
    const collected = await collectPublicGitHubProfile(username, options);
    const profile = normalizePublicGitHubProfile(collected);
    const userReport = scoreUserProfile(profile);
    const staticReport = createStaticReport(profile);
    const reportHref = toSvgRelativeHref(resolvedSvgPath, htmlPath);

    await writeFile(resolvedSvgPath, renderUserSignalCard(userReport, { reportHref }), "utf8");
    await writeFile(htmlPath, renderStaticReportHtml(staticReport), "utf8");
    await writeFile(jsonPath, `${JSON.stringify(staticReport, null, 2)}\n`, "utf8");

    return {
      ok: true,
      username,
      svgPath: resolvedSvgPath,
      reportDirectory: resolvedReportDirectory,
      htmlPath,
      jsonPath,
      fallback: false
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown GitHub artifact render failure";
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

    await writeFile(resolvedSvgPath, renderFallbackCard("Buildmarks GitHub report is temporarily unavailable"), "utf8");
    await writeFile(htmlPath, fallbackHtml, "utf8");
    await writeFile(jsonPath, `${JSON.stringify(fallbackReport, null, 2)}\n`, "utf8");

    return {
      ok: false,
      username,
      svgPath: resolvedSvgPath,
      reportDirectory: resolvedReportDirectory,
      htmlPath,
      jsonPath,
      fallback: true,
      error: message
    };
  }
}

async function main(args: readonly string[]): Promise<void> {
  const parsed = parseArgs(args);
  if (parsed.ok === false) {
    console.error(parsed.message);
    console.error(
      "Usage: bun src/cli/render-github-artifacts.ts <github-username> <output.svg> <report-output-directory> [--token <token>] [--max-repositories-scanned <n>] [--max-repositories-scored <n>] [--activity-window-days <n>]"
    );
    process.exitCode = 2;
    return;
  }

  const result = await renderGitHubArtifacts(parsed.username, parsed.svgOutputPath, parsed.reportOutputDirectory, {
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
    console.error(`Buildmarks wrote fallback artifacts: ${result.error ?? "unknown artifact render failure"}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Buildmarks GitHub SVG written: ${result.svgPath}`);
  console.log(`Buildmarks GitHub report written: ${result.htmlPath}`);
  console.log(`Buildmarks GitHub JSON written: ${result.jsonPath}`);
}

function parseArgs(args: readonly string[]):
  | {
      ok: true;
      username: string;
      svgOutputPath: string;
      reportOutputDirectory: string;
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

  const [username, svgOutputPath, reportOutputDirectory] = positional;
  if (username === undefined || username.trim() === "") {
    return { ok: false, message: "GitHub username is required." };
  }
  if (svgOutputPath === undefined || svgOutputPath.trim() === "") {
    return { ok: false, message: "Output SVG path is required." };
  }
  if (reportOutputDirectory === undefined || reportOutputDirectory.trim() === "") {
    return { ok: false, message: "Output report directory is required." };
  }

  return token === undefined
    ? {
        ok: true,
        username,
        svgOutputPath,
        reportOutputDirectory,
        maxRepositoriesScanned,
        maxRepositoriesScored,
        activityWindowDays
      }
    : {
        ok: true,
        username,
        svgOutputPath,
        reportOutputDirectory,
        token,
        maxRepositoriesScanned,
        maxRepositoriesScored,
        activityWindowDays
      };
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

function toSvgRelativeHref(svgPath: string, reportHtmlPath: string): string {
  const relativePath = relative(dirname(svgPath), reportHtmlPath).replaceAll("\\", "/");
  const href = relativePath.startsWith(".") ? relativePath : `./${relativePath}`;

  return encodeURI(href);
}

if (import.meta.main) {
  await main(process.argv.slice(2));
}
