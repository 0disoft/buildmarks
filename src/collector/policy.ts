export interface GitHubCollectorPolicy {
  publicOnly: boolean;
  allowPrivateRepositories: boolean;
  allowUnauthenticatedLocalDemo: boolean;
  requiredTokenScopes: readonly string[];
  cache: {
    profileReportTtlSeconds: number;
    repositoryFileSignalsTtlSeconds: number;
  };
  limits: {
    maxRepositoriesScannedPerProfile: number;
    maxRepositoriesScoredPerProfile: number;
    repositoryActivityWindowDays: number;
    maxConcurrentRepositoryCollections: number;
  };
}

export interface GitHubCollectorPolicyValidation {
  ok: boolean;
  errors: string[];
}

export type GitHubCollectorPolicyMode = "public-only" | "private-local";

export interface GitHubCollectorPolicyValidationOptions {
  mode?: GitHubCollectorPolicyMode;
}

export const defaultGitHubCollectorPolicy = {
  publicOnly: true,
  allowPrivateRepositories: false,
  allowUnauthenticatedLocalDemo: true,
  requiredTokenScopes: [],
  cache: {
    profileReportTtlSeconds: 6 * 60 * 60,
    repositoryFileSignalsTtlSeconds: 24 * 60 * 60
  },
  limits: {
    maxRepositoriesScannedPerProfile: 30,
    maxRepositoriesScoredPerProfile: 12,
    repositoryActivityWindowDays: 365,
    maxConcurrentRepositoryCollections: 3
  }
} satisfies GitHubCollectorPolicy;

export const privateLocalGitHubCollectorPolicy = {
  ...defaultGitHubCollectorPolicy,
  publicOnly: false,
  allowPrivateRepositories: true
} satisfies GitHubCollectorPolicy;

const maxRepositoriesScannedLimit = 100;
const maxRepositoriesScoredLimit = 24;
const repositoryActivityWindowDaysLimit = 3650;
const maxConcurrentRepositoryCollectionsLimit = 8;

const privateRepositoryScopes = new Set([
  "repo",
  "repo:status",
  "repo_deployment",
  "repo:invite",
  "security_events",
  "read:org",
  "write:org",
  "admin:org"
]);

export function validateGitHubCollectorPolicy(
  policy: GitHubCollectorPolicy,
  options: GitHubCollectorPolicyValidationOptions = {}
): GitHubCollectorPolicyValidation {
  const errors: string[] = [];
  const mode = options.mode ?? "public-only";

  if (mode === "public-only") {
    if (!policy.publicOnly) {
      errors.push("GitHub collector policy must remain public-only.");
    }

    if (policy.allowPrivateRepositories) {
      errors.push("GitHub collector policy must not allow private repositories.");
    }
  } else {
    if (policy.publicOnly) {
      errors.push("Private-local GitHub collector policy must not be public-only.");
    }

    if (!policy.allowPrivateRepositories) {
      errors.push("Private-local GitHub collector policy must allow private repositories.");
    }
  }

  for (const scope of policy.requiredTokenScopes) {
    if (privateRepositoryScopes.has(scope)) {
      errors.push(`GitHub collector policy must not require private scope \`${scope}\`.`);
    }
  }

  if (!isPositiveInteger(policy.cache.profileReportTtlSeconds)) {
    errors.push("Profile report cache TTL must be a positive integer.");
  }

  if (!isPositiveInteger(policy.cache.repositoryFileSignalsTtlSeconds)) {
    errors.push("Repository file-signals cache TTL must be a positive integer.");
  }

  if (!isPositiveInteger(policy.limits.maxRepositoriesScannedPerProfile)) {
    errors.push("Max repositories scanned per profile must be a positive integer.");
  } else if (policy.limits.maxRepositoriesScannedPerProfile > maxRepositoriesScannedLimit) {
    errors.push(`Max repositories scanned per profile must be less than or equal to ${maxRepositoriesScannedLimit}.`);
  }

  if (!isPositiveInteger(policy.limits.maxRepositoriesScoredPerProfile)) {
    errors.push("Max repositories scored per profile must be a positive integer.");
  } else if (policy.limits.maxRepositoriesScoredPerProfile > maxRepositoriesScoredLimit) {
    errors.push(`Max repositories scored per profile must be less than or equal to ${maxRepositoriesScoredLimit}.`);
  }

  if (!isPositiveInteger(policy.limits.repositoryActivityWindowDays)) {
    errors.push("Repository activity window days must be a positive integer.");
  } else if (policy.limits.repositoryActivityWindowDays > repositoryActivityWindowDaysLimit) {
    errors.push(`Repository activity window days must be less than or equal to ${repositoryActivityWindowDaysLimit}.`);
  }

  if (!isPositiveInteger(policy.limits.maxConcurrentRepositoryCollections)) {
    errors.push("Max concurrent repository collections must be a positive integer.");
  } else if (policy.limits.maxConcurrentRepositoryCollections > maxConcurrentRepositoryCollectionsLimit) {
    errors.push(
      `Max concurrent repository collections must be less than or equal to ${maxConcurrentRepositoryCollectionsLimit}.`
    );
  }

  if (
    policy.limits.maxRepositoriesScannedPerProfile <
    policy.limits.maxRepositoriesScoredPerProfile
  ) {
    errors.push("Max repositories scanned per profile must be greater than or equal to max repositories scored.");
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}
