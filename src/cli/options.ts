import {
  defaultGitHubCollectorPolicy,
  privateLocalGitHubCollectorPolicy,
  validateGitHubCollectorPolicy,
  type GitHubCollectorPolicy
} from "../collector/policy";
import { isMissingOptionValue, isOptionLikeArgument, unknownOptionMessage } from "./args";

export const githubCliDefaultLimits = defaultGitHubCollectorPolicy.limits;

export interface CommonGitHubCliOptions {
  token?: string;
  maxRepositoriesScanned: number;
  maxRepositoriesScored: number;
  activityWindowDays: number;
  privateLocal: boolean;
}

export interface ParsedCommonGitHubCliOptions extends CommonGitHubCliOptions {
  positional: string[];
}

export function parseCommonGitHubCliOptions(
  args: readonly string[]
): { ok: true; value: ParsedCommonGitHubCliOptions } | { ok: false; message: string } {
  const positional: string[] = [];
  let token: string | undefined;
  let maxRepositoriesScanned = githubCliDefaultLimits.maxRepositoriesScannedPerProfile;
  let maxRepositoriesScored = githubCliDefaultLimits.maxRepositoriesScoredPerProfile;
  let activityWindowDays = githubCliDefaultLimits.repositoryActivityWindowDays;
  let privateLocal = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === undefined) {
      continue;
    }

    if (arg === "--token") {
      const value = args[index + 1];
      if (isMissingOptionValue(value)) {
        return { ok: false, message: "Missing value for --token." };
      }
      token = value!.trim();
      index += 1;
      continue;
    }

    if (arg === "--private-local") {
      privateLocal = true;
      continue;
    }

    if (arg === "--max-repositories-scanned") {
      const value = parsePositiveDecimalIntegerOption(arg, args[index + 1]);
      if (typeof value === "string") {
        return { ok: false, message: value };
      }
      maxRepositoriesScanned = value;
      index += 1;
      continue;
    }

    if (arg === "--max-repositories-scored") {
      const value = parsePositiveDecimalIntegerOption(arg, args[index + 1]);
      if (typeof value === "string") {
        return { ok: false, message: value };
      }
      maxRepositoriesScored = value;
      index += 1;
      continue;
    }

    if (arg === "--activity-window-days") {
      const value = parsePositiveDecimalIntegerOption(arg, args[index + 1]);
      if (typeof value === "string") {
        return { ok: false, message: value };
      }
      activityWindowDays = value;
      index += 1;
      continue;
    }

    if (isOptionLikeArgument(arg)) {
      return { ok: false, message: unknownOptionMessage(arg) };
    }

    positional.push(arg);
  }

  const policy = buildGitHubCollectorPolicyFromCli({
    privateLocal,
    maxRepositoriesScanned,
    maxRepositoriesScored,
    activityWindowDays
  });
  const validation = validateGitHubCollectorPolicy(policy, {
    mode: privateLocal ? "private-local" : "public-only"
  });
  if (!validation.ok) {
    return { ok: false, message: validation.errors.join(" ") };
  }

  return {
    ok: true,
    value: {
      positional,
      maxRepositoriesScanned,
      maxRepositoriesScored,
      activityWindowDays,
      privateLocal,
      ...(token === undefined ? {} : { token })
    }
  };
}

export function parsePositiveDecimalIntegerOption(name: string, rawValue: string | undefined): number | string {
  if (isMissingOptionValue(rawValue)) {
    return `Missing value for ${name}.`;
  }

  const trimmed = rawValue!.trim();
  if (!/^[1-9][0-9]*$/.test(trimmed)) {
    return `${name} must be a positive base-10 integer.`;
  }

  const value = Number(trimmed);
  if (!Number.isSafeInteger(value)) {
    return `${name} must be a safe positive integer.`;
  }

  return value;
}

export function buildGitHubCollectorPolicyFromCli(
  options: {
    privateLocal: boolean;
    maxRepositoriesScanned: number;
    maxRepositoriesScored: number;
    activityWindowDays: number;
  }
): GitHubCollectorPolicy {
  const basePolicy = options.privateLocal
    ? privateLocalGitHubCollectorPolicy
    : defaultGitHubCollectorPolicy;

  return {
    ...basePolicy,
    limits: {
      maxRepositoriesScannedPerProfile: options.maxRepositoriesScanned,
      maxRepositoriesScoredPerProfile: options.maxRepositoriesScored,
      repositoryActivityWindowDays: options.activityWindowDays,
      maxConcurrentRepositoryCollections: basePolicy.limits.maxConcurrentRepositoryCollections
    }
  };
}
