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
  };
}

export interface GitHubCollectorPolicyValidation {
  ok: boolean;
  errors: string[];
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
    maxRepositoriesScoredPerProfile: 8,
    repositoryActivityWindowDays: 365
  }
} satisfies GitHubCollectorPolicy;

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
  policy: GitHubCollectorPolicy
): GitHubCollectorPolicyValidation {
  const errors: string[] = [];

  if (!policy.publicOnly) {
    errors.push("GitHub collector policy must remain public-only.");
  }

  if (policy.allowPrivateRepositories) {
    errors.push("GitHub collector policy must not allow private repositories.");
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
  }

  if (!isPositiveInteger(policy.limits.maxRepositoriesScoredPerProfile)) {
    errors.push("Max repositories scored per profile must be a positive integer.");
  }

  if (!isPositiveInteger(policy.limits.repositoryActivityWindowDays)) {
    errors.push("Repository activity window days must be a positive integer.");
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
