import { withOutputLocks } from "./output-lock.js";
import { throwIfCancelled } from "../shared/cancellation";
import { isOutputSafetyError } from "./output-errors.js";
import { resolveFileSystem, type RenderFileOptions } from "./file-system";
import { isMainModule } from "./main";
import { dirname } from "node:path";
import { parseCardLayoutOptions } from "./card-options";
import { buildGitHubCollectorPolicyFromCli, parseCommonGitHubCliOptions } from "./options";
import { resolveRequiredPath, tryWriteTextFile, writeTextFileAtomically } from "./write-output";
import { privateLocalPublicCommitWarning } from "../shared/private-local-warning";
import { InsufficientEvidenceError } from "./collection-outcome";
import {
  renderFallbackCard,
  renderUserSignalCard,
  scoreUserProfile,
  type CollectPublicGitHubProfileOptions,
  type RenderCardOptions
} from "../index";

import { collectGitHubRenderInput, githubRefreshFailureMessage, recoverGitHubOutput } from "./github-render-runtime.js";

export interface RenderGitHubCardFileOptions extends CollectPublicGitHubProfileOptions, RenderFileOptions, RenderCardOptions {
  privateLocal?: boolean;
}

export interface RenderGitHubCardFileResult {
  ok: boolean;
  username: string;
  outputPath: string;
  fallback: boolean;
  preservedExisting?: boolean;
  error?: string;
}

export async function renderGitHubCardFile(
  username: string,
  outputPath: string,
  options: RenderGitHubCardFileOptions = {}
): Promise<RenderGitHubCardFileResult> {
  throwIfCancelled(options.signal);
  const fs = resolveFileSystem(options.fileSystem);
  const normalizedUsername = resolveRequiredGitHubUsername(username);
  const resolvedOutputPath = resolveRequiredPath(outputPath, "Output SVG path");

  throwIfCancelled(options.signal);
  await fs.mkdir(dirname(resolvedOutputPath), { recursive: true });

  return withOutputLocks([resolvedOutputPath], options, async lockedOptions => {
    try {
      const { profile, scoringOptions } = await collectGitHubRenderInput(normalizedUsername, lockedOptions);
      const report = scoreUserProfile(profile, scoringOptions);
      if (report.evidenceStatus === "insufficient") {
        const failure = await recoverGitHubCard(
          new InsufficientEvidenceError(profile), resolvedOutputPath,
          "Not enough complete repository data to calculate a reliable score", lockedOptions
        );
        return { ok: false, username: profile.username, outputPath: resolvedOutputPath, ...failure };
      }
      await writeTextFileAtomically(resolvedOutputPath, renderUserSignalCard(report, lockedOptions), lockedOptions);
      return { ok: true, username: profile.username, outputPath: resolvedOutputPath, fallback: false };
    } catch (error) {
      if (isOutputSafetyError(error)) throw error;
      throwIfCancelled(lockedOptions.signal);
      const failure = await recoverGitHubCard(error, resolvedOutputPath, githubRefreshFailureMessage, lockedOptions);
      return { ok: false, username: normalizedUsername, outputPath: resolvedOutputPath, ...failure };
    }
  });
}

function recoverGitHubCard(error: unknown, path: string, fallbackMessage: string, options: RenderGitHubCardFileOptions) {
  return recoverGitHubOutput(error, {
    paths: [path],
    unknownErrorMessage: "unknown GitHub render failure",
    fallbackLabel: "Fallback SVG",
    writeFallback: (_message, lockedOptions) => tryWriteTextFile(path, renderFallbackCard(fallbackMessage, options), lockedOptions)
  }, options);
}

async function main(args: readonly string[]): Promise<void> {
  const parsed = parseArgs(args);
  if (parsed.ok === false) {
    console.error(parsed.message);
    console.error(
      "Usage: bun src/cli/render-github-card.ts <github-username> <output.svg> [--layout compact|detailed] [--token <token>] [--private-local] [--max-repositories-scanned <n>] [--max-repositories-scored <n>] [--activity-window-days <n>] [--max-api-requests <n>]"
    );
    process.exitCode = 2;
    return;
  }

  const result = await renderGitHubCardFile(parsed.username, parsed.outputPath, {
    layout: parsed.layout,
    privateLocal: parsed.privateLocal,
    ...(parsed.token === undefined ? {} : { token: parsed.token }),
    policy: buildGitHubCollectorPolicyFromCli(parsed)
  });

  if (!result.ok) {
    const outcome = result.preservedExisting === true
      ? "Buildmarks preserved the existing SVG"
      : "Buildmarks wrote a fallback SVG";
    console.error(`${outcome}: ${result.error ?? "unknown GitHub render failure"}`);
    process.exitCode = 1;
    return;
  }

  if (parsed.privateLocal) {
    console.error(`Buildmarks private-local warning: ${privateLocalPublicCommitWarning}`);
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
  const [username, outputPath, ...extra] = positional;
  if (username === undefined || username.trim() === "") {
    return { ok: false, message: "GitHub username is required." };
  }
  if (outputPath === undefined || outputPath.trim() === "") {
    return { ok: false, message: "Output SVG path is required." };
  }
  if (extra.length > 0) {
    return { ok: false, message: `Unexpected positional argument: ${extra[0]}` };
  }

  return { ok: true, username, outputPath, ...options, layout: card.layout };
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
