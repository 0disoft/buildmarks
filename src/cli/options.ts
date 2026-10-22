import {
  defaultGitHubCollectorPolicy,
  copyGitHubCollectorPolicy,
  privateLocalGitHubCollectorPolicy,
  validateGitHubCollectorPolicy,
  type GitHubCollectorPolicy
} from "../collector/policy";
import { isMissingOptionValue, isOptionLikeArgument, unknownOptionMessage } from "./args";

export const githubCliDefaultLimits = { ...defaultGitHubCollectorPolicy.limits };

export interface CommonGitHubCliOptions {
  token?: string;
  maxRepositoriesScanned: number;
  maxRepositoriesScored: number;
  activityWindowDays: number;
  maxApiRequests: number;
  privateLocal: boolean;
}

export interface ParsedCommonGitHubCliOptions extends CommonGitHubCliOptions {
  positional: string[];
}

type ParsedGitHubCliResult =
  | { ok: true; value: ParsedCommonGitHubCliOptions }
  | { ok: false; message: string };

type NumericGitHubOption = Exclude<keyof CommonGitHubCliOptions, "token" | "privateLocal">;
const numericGitHubOptions = new Map<string, NumericGitHubOption>([
  ["--max-repositories-scanned", "maxRepositoriesScanned"],
  ["--max-repositories-scored", "maxRepositoriesScored"],
  ["--activity-window-days", "activityWindowDays"],
  ["--max-api-requests", "maxApiRequests"]
]);

export function parseCommonGitHubCliOptions(args: readonly string[]): ParsedGitHubCliResult {
  const parsed = parseGitHubArguments(args);
  if (!parsed.ok) return parsed;
  const policy = buildGitHubCollectorPolicyFromCli(parsed.value);
  const validation = validateGitHubCollectorPolicy(policy, {
    mode: parsed.value.privateLocal ? "private-local" : "public-only"
  });
  if (!validation.ok) return { ok: false, message: validation.errors.join(" ") };
  return parsed;
}

function defaultGitHubArguments(): ParsedCommonGitHubCliOptions {
  return {
    positional: [], privateLocal: false,
    maxRepositoriesScanned: githubCliDefaultLimits.maxRepositoriesScannedPerProfile,
    maxRepositoriesScored: githubCliDefaultLimits.maxRepositoriesScoredPerProfile,
    activityWindowDays: githubCliDefaultLimits.repositoryActivityWindowDays,
    maxApiRequests: githubCliDefaultLimits.maxApiRequestsPerProfile
  };
}

function parseGitHubArguments(args: readonly string[]): ParsedGitHubCliResult {
  const options = defaultGitHubArguments();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === undefined) continue;
    if (arg === "--token") {
      const value = args[index + 1];
      if (isMissingOptionValue(value)) return { ok: false, message: "Missing value for --token." };
      options.token = value!.trim();
      index += 1;
      continue;
    }
    if (arg === "--private-local") {
      options.privateLocal = true;
      continue;
    }
    const key = numericGitHubOptions.get(arg);
    if (key !== undefined) {
      const value = parsePositiveDecimalIntegerOption(arg, args[index + 1]);
      if (typeof value === "string") return { ok: false, message: value };
      options[key] = value;
      index += 1;
      continue;
    }
    if (isOptionLikeArgument(arg)) return { ok: false, message: unknownOptionMessage(arg) };
    options.positional.push(arg);
  }
  return { ok: true, value: options };
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
    maxApiRequests: number;
  }
): GitHubCollectorPolicy {
  const basePolicy = options.privateLocal
    ? privateLocalGitHubCollectorPolicy
    : defaultGitHubCollectorPolicy;

  return {
    ...copyGitHubCollectorPolicy(basePolicy),
    limits: {
      maxRepositoriesScannedPerProfile: options.maxRepositoriesScanned,
      maxRepositoriesScoredPerProfile: options.maxRepositoriesScored,
      repositoryActivityWindowDays: options.activityWindowDays,
      maxConcurrentRepositoryCollections: basePolicy.limits.maxConcurrentRepositoryCollections,
      maxApiRequestsPerProfile: options.maxApiRequests
    }
  };
}
