import { throwIfCancelled } from "../shared/cancellation";
import { resolveFileSystem, type RenderFileOptions } from "./file-system";
import { isMainModule } from "./main";
import { join } from "node:path";
import { buildGitHubCollectorPolicyFromCli, parseCommonGitHubCliOptions } from "./options";
import { resolveRequiredPath, tryWriteTextFilesAsSet, writeTextFilesAsSet } from "./write-output";
import { privateLocalPublicCommitWarning } from "../shared/private-local-warning";
import { assertSufficientEvidence } from "./collection-outcome";
import {
  createStaticReport,
  renderStaticReportHtml,
  type CollectPublicGitHubProfileOptions
} from "../index";

import { collectGitHubRenderInput, fallbackReportOutputs, recoverGitHubOutput } from "./github-render-runtime.js";

export interface RenderGitHubReportFilesOptions extends CollectPublicGitHubProfileOptions, RenderFileOptions {
  privateLocal?: boolean;
}

export interface RenderGitHubReportFilesResult {
  ok: boolean;
  username: string;
  outputDirectory: string;
  htmlPath: string;
  jsonPath: string;
  preservedExisting?: boolean;
  error?: string;
}

export async function renderGitHubReportFiles(
  username: string,
  outputDirectory: string,
  options: RenderGitHubReportFilesOptions = {}
): Promise<RenderGitHubReportFilesResult> {
  throwIfCancelled(options.signal);
  const fs = resolveFileSystem(options.fileSystem);
  const normalizedUsername = resolveRequiredGitHubUsername(username);
  const resolvedOutputDirectory = resolveRequiredPath(outputDirectory, "Output report directory");
  const htmlPath = join(resolvedOutputDirectory, "buildmarks-report.html");
  const jsonPath = join(resolvedOutputDirectory, "buildmarks-report.json");

  throwIfCancelled(options.signal);
  await fs.mkdir(resolvedOutputDirectory, { recursive: true });

  const destinations = { outputDirectory: resolvedOutputDirectory, htmlPath, jsonPath };
  try {
    const { profile, scoringOptions } = await collectGitHubRenderInput(normalizedUsername, options);
    const report = createStaticReport(profile, scoringOptions);
    assertSufficientEvidence(profile, report.profile);
    await writeTextFilesAsSet([
      { path: htmlPath, content: renderStaticReportHtml(report) },
      { path: jsonPath, content: `${JSON.stringify(report, null, 2)}\n` }
    ], undefined, options);
    return { ok: true, username: report.profile.username, ...destinations };
  } catch (error) {
    const { fallback, ...failure } = await recoverGitHubOutput(error, {
      paths: [htmlPath, jsonPath],
      unknownErrorMessage: "unknown GitHub report render failure",
      fallbackLabel: "Fallback report",
      writeFallback: (message, lockedOptions) => tryWriteTextFilesAsSet(
        fallbackReportOutputs(normalizedUsername, message, htmlPath, jsonPath), lockedOptions
      )
    }, options);
    return { ok: false, username: normalizedUsername, ...destinations, ...failure };
  }
}

async function main(args: readonly string[]): Promise<void> {
  const parsed = parseArgs(args);
  if (parsed.ok === false) {
    console.error(parsed.message);
    console.error(
      "Usage: bun src/cli/render-github-report.ts <github-username> <output-directory> [--token <token>] [--private-local] [--max-repositories-scanned <n>] [--max-repositories-scored <n>] [--activity-window-days <n>] [--max-api-requests <n>]"
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
    const outcome = result.preservedExisting === true ? "Buildmarks preserved the existing GitHub report"
      : result.preservedExisting === false ? "Buildmarks output recovery was incomplete" : "Buildmarks attempted fallback GitHub report";
    console.error(`${outcome}: ${result.error ?? "unknown report render failure"}`);
    process.exitCode = 1;
    return;
  }

  if (parsed.privateLocal) {
    console.error(`Buildmarks private-local warning: ${privateLocalPublicCommitWarning}`);
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
      maxApiRequests: number;
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


if (isMainModule(import.meta.url)) {
  await main(process.argv.slice(2));
}
