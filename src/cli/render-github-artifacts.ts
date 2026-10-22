import { withOutputLocks } from "./output-lock.js";
import { throwIfCancelled } from "../shared/cancellation";
import { resolveFileSystem, type RenderFileOptions } from "./file-system";
import { isMainModule } from "./main";
import { dirname, join } from "node:path";
import { parseCardLayoutOptions } from "./card-options";
import { buildGitHubCollectorPolicyFromCli, parseCommonGitHubCliOptions } from "./options";
import { resolveRequiredPath, tryWriteTextFilesAsSet, writeTextFilesAsSet } from "./write-output";
import { privateLocalPublicCommitWarning } from "../shared/private-local-warning";
import { assertSufficientEvidence } from "./collection-outcome";
import {
  createStaticReport,
  renderFallbackCard,
  renderStaticReportHtml,
  renderUserSignalCard,
  type CollectPublicGitHubProfileOptions,
  type RenderCardOptions
} from "../index";

import { collectGitHubRenderInput, fallbackReportOutputs, githubRefreshFailureMessage, recoverGitHubOutput } from "./github-render-runtime.js";

export interface RenderGitHubArtifactsOptions extends CollectPublicGitHubProfileOptions, RenderFileOptions, RenderCardOptions {
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
  preservedExisting?: boolean;
  error?: string;
}

export async function renderGitHubArtifacts(
  username: string,
  svgOutputPath: string,
  reportOutputDirectory: string,
  options: RenderGitHubArtifactsOptions = {}
): Promise<RenderGitHubArtifactsResult> {
  throwIfCancelled(options.signal);
  const fs = resolveFileSystem(options.fileSystem);
  const normalizedUsername = resolveRequiredGitHubUsername(username);
  const resolvedSvgPath = resolveRequiredPath(svgOutputPath, "Output SVG path");
  const resolvedReportDirectory = resolveRequiredPath(reportOutputDirectory, "Output report directory");
  const htmlPath = join(resolvedReportDirectory, "buildmarks-report.html");
  const jsonPath = join(resolvedReportDirectory, "buildmarks-report.json");

  throwIfCancelled(options.signal);
  await fs.mkdir(dirname(resolvedSvgPath), { recursive: true });
  throwIfCancelled(options.signal);
  await fs.mkdir(resolvedReportDirectory, { recursive: true });

  const destinations = { svgPath: resolvedSvgPath, reportDirectory: resolvedReportDirectory, htmlPath, jsonPath };
  return withOutputLocks([resolvedSvgPath, htmlPath, jsonPath], options, async lockedOptions => {
    try {
      const { profile, scoringOptions } = await collectGitHubRenderInput(normalizedUsername, lockedOptions);
      const report = createStaticReport(profile, scoringOptions);
      assertSufficientEvidence(profile, report.profile);
      await writeTextFilesAsSet([
        { path: resolvedSvgPath, content: renderUserSignalCard(report.profile, lockedOptions) },
        { path: htmlPath, content: renderStaticReportHtml(report) },
        { path: jsonPath, content: `${JSON.stringify(report, null, 2)}\n` }
      ], undefined, lockedOptions);
      return { ok: true, username: report.profile.username, ...destinations, fallback: false };
    } catch (error) {
      const failure = await recoverGitHubOutput(error, {
        paths: [resolvedSvgPath, htmlPath, jsonPath],
        unknownErrorMessage: "unknown GitHub artifact render failure",
        fallbackLabel: "Fallback artifact",
        writeFallback: (message, recoveryOptions) => tryWriteTextFilesAsSet([
          { path: resolvedSvgPath, content: renderFallbackCard(githubRefreshFailureMessage, lockedOptions) },
          ...fallbackReportOutputs(normalizedUsername, message, htmlPath, jsonPath)
        ], recoveryOptions)
      }, lockedOptions);
      return { ok: false, username: normalizedUsername, ...destinations, ...failure };
    }
  });
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
      "Usage: bun src/cli/render-github-artifacts.ts <github-username> <output.svg> <report-output-directory> [--layout compact|detailed] [--token <token>] [--private-local] [--max-repositories-scanned <n>] [--max-repositories-scored <n>] [--activity-window-days <n>] [--max-api-requests <n>]"
    );
    process.exitCode = 2;
    return;
  }

  const result = await renderGitHubArtifacts(parsed.username, parsed.svgOutputPath, parsed.reportOutputDirectory, {
    layout: parsed.layout,
    privateLocal: parsed.privateLocal,
    ...(parsed.token === undefined ? {} : { token: parsed.token }),
    policy: buildGitHubCollectorPolicyFromCli(parsed)
  });

  if (!result.ok) {
    const outcome = result.preservedExisting === true ? "Buildmarks preserved existing artifacts"
      : result.fallback ? "Buildmarks attempted fallback artifacts" : "Buildmarks output recovery was incomplete";
    console.error(`${outcome}: ${result.error ?? "unknown artifact render failure"}`);
    process.exitCode = 1;
    return;
  }

  if (parsed.privateLocal) {
    console.error(`Buildmarks private-local warning: ${privateLocalPublicCommitWarning}`);
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
      maxApiRequests: number;
      privateLocal: boolean;
      layout: "compact" | "detailed";
    }
  | { ok: false; message: string } {
  const card = parseCardLayoutOptions(args);
  if (!card.ok) return card;
  const common = parseCommonGitHubCliOptions(card.args);
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

  return { ok: true, username, svgOutputPath, reportOutputDirectory, ...options, layout: card.layout };
}

if (isMainModule(import.meta.url)) {
  await main(process.argv.slice(2));
}
