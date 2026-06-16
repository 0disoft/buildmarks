import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { buildGitHubCollectorPolicyFromCli, parseCommonGitHubCliOptions } from "./options";
import { appendWriteFailure, tryWriteTextFile } from "./write-output";
import {
  collectOwnerSuppliedGitHubProfile,
  collectPublicGitHubProfile,
  normalizePublicGitHubProfile,
  renderFallbackCard,
  renderUserSignalCard,
  scoreUserProfile,
  type CollectPublicGitHubProfileOptions,
  type RenderCardOptions
} from "../index";

export interface RenderGitHubCardFileOptions extends CollectPublicGitHubProfileOptions, RenderCardOptions {
  privateLocal?: boolean;
}

export interface RenderGitHubCardFileResult {
  ok: boolean;
  username: string;
  outputPath: string;
  fallback: boolean;
  error?: string;
}

export async function renderGitHubCardFile(
  username: string,
  outputPath: string,
  options: RenderGitHubCardFileOptions = {}
): Promise<RenderGitHubCardFileResult> {
  const resolvedOutputPath = resolve(outputPath);

  await mkdir(dirname(resolvedOutputPath), { recursive: true });

  try {
    const collected = options.privateLocal === true
      ? await collectOwnerSuppliedGitHubProfile(username, options)
      : await collectPublicGitHubProfile(username, options);
    const profile = normalizePublicGitHubProfile(collected);
    const scoringOptions = options.policy === undefined
      ? {}
      : { maxRepositories: options.policy.limits.maxRepositoriesScoredPerProfile };
    const report = scoreUserProfile(profile, scoringOptions);
    const svg = renderUserSignalCard(report, options);

    await writeFile(resolvedOutputPath, svg, "utf8");

    return {
      ok: true,
      username,
      outputPath: resolvedOutputPath,
      fallback: false
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown GitHub render failure";
    const svg = renderFallbackCard("Buildmarks GitHub report is temporarily unavailable");
    const writeError = await tryWriteTextFile(resolvedOutputPath, svg);

    return {
      ok: false,
      username,
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
    console.error(
      "Usage: bun src/cli/render-github-card.ts <github-username> <output.svg> [--token <token>] [--private-local] [--report-href <href>] [--max-repositories-scanned <n>] [--max-repositories-scored <n>] [--activity-window-days <n>]"
    );
    process.exitCode = 2;
    return;
  }

  const result = await renderGitHubCardFile(parsed.username, parsed.outputPath, {
    token: parsed.token,
    privateLocal: parsed.privateLocal,
    reportHref: parsed.reportHref,
    policy: buildGitHubCollectorPolicyFromCli(parsed)
  });

  if (!result.ok) {
    console.error(`Buildmarks wrote fallback SVG: ${result.error ?? "unknown GitHub render failure"}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Buildmarks GitHub SVG written: ${result.outputPath}`);
}

function parseArgs(args: readonly string[]):
  | {
      ok: true;
      username: string;
      outputPath: string;
      token?: string;
      maxRepositoriesScanned: number;
      maxRepositoriesScored: number;
      activityWindowDays: number;
      reportHref?: string;
      privateLocal: boolean;
    }
  | { ok: false; message: string } {
  const common = parseCommonGitHubCliOptions(args, { allowReportHref: true });
  if (common.ok === false) {
    return common;
  }

  const { positional, ...options } = common.value;
  const [username, outputPath] = positional;
  if (username === undefined || username.trim() === "") {
    return { ok: false, message: "GitHub username is required." };
  }
  if (outputPath === undefined || outputPath.trim() === "") {
    return { ok: false, message: "Output SVG path is required." };
  }

  return { ok: true, username, outputPath, ...options };
}

if (import.meta.main) {
  await main(process.argv.slice(2));
}
