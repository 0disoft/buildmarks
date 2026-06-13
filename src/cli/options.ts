import {
  defaultGitHubCollectorPolicy,
  privateLocalGitHubCollectorPolicy,
  type GitHubCollectorPolicy
} from "../collector/policy";

export const githubCliDefaultLimits = defaultGitHubCollectorPolicy.limits;

export function parsePositiveDecimalIntegerOption(name: string, rawValue: string | undefined): number | string {
  if (rawValue === undefined || rawValue.trim() === "") {
    return `Missing value for ${name}.`;
  }

  const trimmed = rawValue.trim();
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
