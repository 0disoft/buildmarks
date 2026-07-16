import { access, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { buildGitHubCollectorPolicyFromCli, parseCommonGitHubCliOptions } from "./options";
import { appendWriteFailure, resolveRequiredPath, tryWriteTextFile, writeTextFileAtomically } from "./write-output";
import { privateLocalPublicCommitWarning } from "../shared/private-local-warning";
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
  preservedExisting?: boolean;
  error?: string;
}

export async function renderGitHubCardFile(
  username: string,
  outputPath: string,
  options: RenderGitHubCardFileOptions = {}
): Promise<RenderGitHubCardFileResult> {
  const normalizedUsername = resolveRequiredGitHubUsername(username);
  const resolvedOutputPath = resolveRequiredPath(outputPath, "Output SVG path");

  await mkdir(dirname(resolvedOutputPath), { recursive: true });

  try {
    const collected = options.privateLocal === true
      ? await collectOwnerSuppliedGitHubProfile(normalizedUsername, options)
      : await collectPublicGitHubProfile(normalizedUsername, options);
    const profile = normalizePublicGitHubProfile(collected);
    const scoringOptions = options.policy === undefined
      ? {}
      : { maxRepositories: options.policy.limits.maxRepositoriesScoredPerProfile };
    const report = scoreUserProfile(profile, scoringOptions);
    if (report.evidenceStatus === "insufficient") {
      const message = insufficientEvidenceMessage(profile);
      if (await pathExists(resolvedOutputPath)) {
        return {
          ok: false,
          username: profile.username,
          outputPath: resolvedOutputPath,
          fallback: false,
          preservedExisting: true,
          error: message
        };
      }

      const writeError = await tryWriteTextFile(
        resolvedOutputPath,
        renderFallbackCard("Not enough complete repository data to calculate a reliable score")
      );
      return {
        ok: false,
        username: profile.username,
        outputPath: resolvedOutputPath,
        fallback: true,
        error: appendWriteFailure(message, "Fallback SVG", writeError)
      };
    }
    const svg = renderUserSignalCard(report, options);

    await writeTextFileAtomically(resolvedOutputPath, svg);

    return {
      ok: true,
      username: profile.username,
      outputPath: resolvedOutputPath,
      fallback: false
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown GitHub render failure";
    const svg = renderFallbackCard("Buildmarks couldn't refresh this GitHub report right now");
    const writeError = await tryWriteTextFile(resolvedOutputPath, svg);

    return {
      ok: false,
      username: normalizedUsername,
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
      "Usage: bun src/cli/render-github-card.ts <github-username> <output.svg> [--token <token>] [--private-local] [--max-repositories-scanned <n>] [--max-repositories-scored <n>] [--activity-window-days <n>] [--max-api-requests <n>]"
    );
    process.exitCode = 2;
    return;
  }

  const result = await renderGitHubCardFile(parsed.username, parsed.outputPath, {
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

function insufficientEvidenceMessage(profile: ReturnType<typeof normalizePublicGitHubProfile>): string {
  const attempted = profile.repositoryCollectionAttemptCount ?? profile.repositories.length;
  const failed = profile.repositoryCollectionFailureCount ?? 0;
  const truncated = profile.repositories.filter((repository) => repository.codebaseShape?.treeTruncated === true).length;
  const summaries = profile.repositoryCollectionFailures ?? [];
  const detail = summaries.length === 0
    ? "no safe failure details were recorded"
    : summaries
      .map((failure) =>
        `${failure.code}/${failure.operation}${failure.status === undefined ? "" : `/status-${failure.status}`}=${failure.count}`
      )
      .join(", ");

  return `Not enough complete repository data: attempted=${attempted}, failed=${failed}, truncated=${truncated}; ${detail}.`;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
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
    }
  | { ok: false; message: string } {
  const common = parseCommonGitHubCliOptions(args);
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

  return { ok: true, username, outputPath, ...options };
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
