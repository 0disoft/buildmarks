import { collectOwnerSuppliedGitHubProfile, collectPublicGitHubProfile, type CollectPublicGitHubProfileOptions } from "../collector/github-client.js";
import { normalizePublicGitHubProfile } from "../collector/normalize-public-profile.js";
import { throwIfCancelled } from "../shared/cancellation.js";
import { hasExistingOutput } from "./collection-outcome.js";
import type { RenderFileOptions } from "./file-system.js";
import { appendWriteFailure, OutputSetRollbackError } from "./write-output.js";

export const githubRefreshFailureMessage = "Buildmarks couldn't refresh this GitHub report right now";

export async function collectGitHubRenderInput(
  username: string,
  options: CollectPublicGitHubProfileOptions & { privateLocal?: boolean }
) {
  const collected = options.privateLocal === true
    ? await collectOwnerSuppliedGitHubProfile(username, options)
    : await collectPublicGitHubProfile(username, options);
  const profile = normalizePublicGitHubProfile(collected);
  throwIfCancelled(options.signal);
  const scoringOptions = options.policy === undefined
    ? {}
    : { maxRepositories: options.policy.limits.maxRepositoriesScoredPerProfile };
  return { profile, scoringOptions };
}

interface GitHubOutputRecovery {
  paths: readonly string[];
  unknownErrorMessage: string;
  fallbackLabel: string;
  writeFallback(message: string): Promise<string | undefined>;
}

type GitHubOutputFailure =
  | { fallback: false; preservedExisting: boolean; error: string }
  | { fallback: true; error: string };

export async function recoverGitHubOutput(
  error: unknown, recovery: GitHubOutputRecovery, options: RenderFileOptions
): Promise<GitHubOutputFailure> {
  if (!(error instanceof OutputSetRollbackError)) throwIfCancelled(options.signal);
  const message = error instanceof Error ? error.message : recovery.unknownErrorMessage;
  if (await hasExistingOutput(recovery.paths, options)) {
    return { fallback: false, preservedExisting: !(error instanceof OutputSetRollbackError), error: message };
  }
  const writeError = await recovery.writeFallback(message);
  return { fallback: true, error: appendWriteFailure(message, recovery.fallbackLabel, writeError) };
}

export function fallbackReportOutputs(username: string, error: string, htmlPath: string, jsonPath: string) {
  const report = { ok: false, username, error, message: githubRefreshFailureMessage };
  return [
    { path: htmlPath, content: fallbackReportHtml },
    { path: jsonPath, content: `${JSON.stringify(report, null, 2)}\n` }
  ];
}

const fallbackReportHtml = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Buildmarks GitHub report unavailable</title></head>
<body>
  <main>
    <h1>Buildmarks GitHub report unavailable</h1>
    <p>No score is shown. Buildmarks is not a developer ranking.</p>
  </main>
</body>
</html>`;
