import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { buildGitHubCollectorPolicyFromCli, parseCommonGitHubCliOptions } from "./options";
import { appendWriteFailure, resolveRequiredPath, tryWriteTextFile } from "./write-output";
import {
  collectOwnerSuppliedGitHubProfile,
  collectPublicGitHubProfile,
  createStaticReport,
  normalizePublicGitHubProfile,
  renderFallbackCard,
  renderStaticReportHtml,
  renderUserSignalCard,
  type CollectPublicGitHubProfileOptions
} from "../index";

export interface RenderGitHubArtifactsOptions extends CollectPublicGitHubProfileOptions {
  privateLocal?: boolean;
}

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
  const normalizedUsername = resolveRequiredGitHubUsername(username);
  const resolvedSvgPath = resolveRequiredPath(svgOutputPath, "Output SVG path");
  const resolvedReportDirectory = resolveRequiredPath(reportOutputDirectory, "Output report directory");
  const htmlPath = join(resolvedReportDirectory, "buildmarks-report.html");
  const jsonPath = join(resolvedReportDirectory, "buildmarks-report.json");

  await mkdir(dirname(resolvedSvgPath), { recursive: true });
  await mkdir(resolvedReportDirectory, { recursive: true });

  try {
    const collected = options.privateLocal === true
      ? await collectOwnerSuppliedGitHubProfile(normalizedUsername, options)
      : await collectPublicGitHubProfile(normalizedUsername, options);
    const profile = normalizePublicGitHubProfile(collected);
    const scoringOptions = options.policy === undefined
      ? {}
      : { maxRepositories: options.policy.limits.maxRepositoriesScoredPerProfile };
    const staticReport = createStaticReport(profile, scoringOptions);
    const reportHref = toSvgRelativeHref(resolvedSvgPath, htmlPath);

    await writeFile(resolvedSvgPath, renderUserSignalCard(staticReport.profile, { reportHref }), "utf8");
    await writeFile(htmlPath, renderStaticReportHtml(staticReport), "utf8");
    await writeFile(jsonPath, `${JSON.stringify(staticReport, null, 2)}\n`, "utf8");

    return {
      ok: true,
      username: staticReport.profile.username,
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
        tryWriteTextFile(resolvedSvgPath, renderFallbackCard("Buildmarks GitHub report is temporarily unavailable")),
        tryWriteTextFile(htmlPath, fallbackHtml),
        tryWriteTextFile(jsonPath, `${JSON.stringify(fallbackReport, null, 2)}\n`)
      ])
    ).filter((failure): failure is string => failure !== undefined);

    return {
      ok: false,
      username: normalizedUsername,
      svgPath: resolvedSvgPath,
      reportDirectory: resolvedReportDirectory,
      htmlPath,
      jsonPath,
      fallback: true,
      error: appendWriteFailure(message, "Fallback artifact", fallbackWriteFailures.join("; ") || undefined)
    };
  }
}

function resolveRequiredGitHubUsername(username: string): string {
  const normalizedUsername = username.trim();
  if (normalizedUsername === "") {
    throw new Error("GitHub username is required.");
  }

  return normalizedUsername;
}

async function main(args: readonly string[]): Promise<void> {
  const parsed = parseArgs(args);
  if (parsed.ok === false) {
    console.error(parsed.message);
    console.error(
      "Usage: bun src/cli/render-github-artifacts.ts <github-username> <output.svg> <report-output-directory> [--token <token>] [--private-local] [--max-repositories-scanned <n>] [--max-repositories-scored <n>] [--activity-window-days <n>]"
    );
    process.exitCode = 2;
    return;
  }

  const result = await renderGitHubArtifacts(parsed.username, parsed.svgOutputPath, parsed.reportOutputDirectory, {
    privateLocal: parsed.privateLocal,
    ...(parsed.token === undefined ? {} : { token: parsed.token }),
    policy: buildGitHubCollectorPolicyFromCli(parsed)
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
      privateLocal: boolean;
    }
  | { ok: false; message: string } {
  const common = parseCommonGitHubCliOptions(args);
  if (common.ok === false) {
    return common;
  }

  const { positional, ...options } = common.value;
  const [username, svgOutputPath, reportOutputDirectory, ...extra] = positional;
  if (username === undefined || username.trim() === "") {
    return { ok: false, message: "GitHub username is required." };
  }
  if (svgOutputPath === undefined || svgOutputPath.trim() === "") {
    return { ok: false, message: "Output SVG path is required." };
  }
  if (reportOutputDirectory === undefined || reportOutputDirectory.trim() === "") {
    return { ok: false, message: "Output report directory is required." };
  }
  if (extra.length > 0) {
    return { ok: false, message: `Unexpected positional argument: ${extra[0]}` };
  }

  return { ok: true, username, svgOutputPath, reportOutputDirectory, ...options };
}

function toSvgRelativeHref(svgPath: string, reportHtmlPath: string): string {
  const relativePath = relative(dirname(svgPath), reportHtmlPath).replaceAll("\\", "/");
  const href = relativePath.startsWith(".") ? relativePath : `./${relativePath}`;

  return encodeRelativePathHref(href);
}

function encodeRelativePathHref(href: string): string {
  return href
    .split("/")
    .map((segment) => segment === "." || segment === ".." ? segment : encodeURIComponent(segment))
    .join("/");
}

if (import.meta.main) {
  await main(process.argv.slice(2));
}
