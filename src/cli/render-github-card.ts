import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  collectOwnerSuppliedGitHubProfile,
  collectPublicGitHubProfile,
  defaultGitHubCollectorPolicy,
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
    const report = scoreUserProfile(profile);
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

    await writeFile(resolvedOutputPath, svg, "utf8");

    return {
      ok: false,
      username,
      outputPath: resolvedOutputPath,
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
      "Usage: bun src/cli/render-github-card.ts <github-username> <output.svg> [--token <token>] [--private-local] [--report-href <href>] [--max-repositories-scanned <n>] [--max-repositories-scored <n>] [--activity-window-days <n>]"
    );
    process.exitCode = 2;
    return;
  }

  const result = await renderGitHubCardFile(parsed.username, parsed.outputPath, {
    token: parsed.token,
    privateLocal: parsed.privateLocal,
    reportHref: parsed.reportHref,
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
  const positional: string[] = [];
  let token: string | undefined;
  let maxRepositoriesScanned = defaultGitHubCollectorPolicy.limits.maxRepositoriesScannedPerProfile;
  let maxRepositoriesScored = defaultGitHubCollectorPolicy.limits.maxRepositoriesScoredPerProfile;
  let activityWindowDays = defaultGitHubCollectorPolicy.limits.repositoryActivityWindowDays;
  let reportHref: string | undefined;
  let privateLocal = false;

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

    if (arg === "--private-local") {
      privateLocal = true;
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

    if (arg === "--report-href") {
      const value = args[index + 1];
      if (value === undefined || value.trim() === "") {
        return { ok: false, message: "Missing value for --report-href." };
      }
      reportHref = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--")) {
      return { ok: false, message: `Unknown option: ${arg}` };
    }

    positional.push(arg);
  }

  const [username, outputPath] = positional;
  if (username === undefined || username.trim() === "") {
    return { ok: false, message: "GitHub username is required." };
  }
  if (outputPath === undefined || outputPath.trim() === "") {
    return { ok: false, message: "Output SVG path is required." };
  }

  return token === undefined
    ? reportHref === undefined
      ? { ok: true, username, outputPath, maxRepositoriesScanned, maxRepositoriesScored, activityWindowDays, privateLocal }
      : { ok: true, username, outputPath, reportHref, maxRepositoriesScanned, maxRepositoriesScored, activityWindowDays, privateLocal }
    : reportHref === undefined
      ? { ok: true, username, outputPath, token, maxRepositoriesScanned, maxRepositoriesScored, activityWindowDays, privateLocal }
      : { ok: true, username, outputPath, token, reportHref, maxRepositoriesScanned, maxRepositoriesScored, activityWindowDays, privateLocal };
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
