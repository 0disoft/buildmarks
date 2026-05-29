import { describe, expect, test } from "bun:test";
import {
  defaultGitHubCollectorPolicy,
  validateGitHubCollectorPolicy,
  type GitHubCollectorPolicy
} from "../src";

describe("GitHub collector operations policy", () => {
  test("defaults to public-only collection with no private token scope", () => {
    const validation = validateGitHubCollectorPolicy(defaultGitHubCollectorPolicy);

    expect(defaultGitHubCollectorPolicy.publicOnly).toBe(true);
    expect(defaultGitHubCollectorPolicy.allowPrivateRepositories).toBe(false);
    expect(defaultGitHubCollectorPolicy.requiredTokenScopes).toEqual([]);
    expect(validation).toEqual({ ok: true, errors: [] });
  });

  test("uses positive cache TTLs and repository limits", () => {
    expect(defaultGitHubCollectorPolicy.cache.profileReportTtlSeconds).toBeGreaterThan(0);
    expect(defaultGitHubCollectorPolicy.cache.repositoryFileSignalsTtlSeconds).toBeGreaterThan(0);
    expect(defaultGitHubCollectorPolicy.limits.maxRepositoriesScannedPerProfile).toBeGreaterThan(0);
    expect(defaultGitHubCollectorPolicy.limits.maxRepositoriesScoredPerProfile).toBeGreaterThan(0);
    expect(defaultGitHubCollectorPolicy.limits.maxRepositoriesScannedPerProfile).toBeGreaterThanOrEqual(
      defaultGitHubCollectorPolicy.limits.maxRepositoriesScoredPerProfile
    );
  });

  test("rejects private repository scopes and private collection", () => {
    const policy: GitHubCollectorPolicy = {
      ...defaultGitHubCollectorPolicy,
      publicOnly: false,
      allowPrivateRepositories: true,
      requiredTokenScopes: ["repo"]
    };

    const validation = validateGitHubCollectorPolicy(policy);

    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain("GitHub collector policy must remain public-only.");
    expect(validation.errors).toContain("GitHub collector policy must not allow private repositories.");
    expect(validation.errors).toContain("GitHub collector policy must not require private scope `repo`.");
  });

  test("rejects invalid cache and repository limits", () => {
    const policy: GitHubCollectorPolicy = {
      ...defaultGitHubCollectorPolicy,
      cache: {
        profileReportTtlSeconds: 0,
        repositoryFileSignalsTtlSeconds: -1
      },
      limits: {
        maxRepositoriesScannedPerProfile: 4,
        maxRepositoriesScoredPerProfile: 8
      }
    };

    const validation = validateGitHubCollectorPolicy(policy);

    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain("Profile report cache TTL must be a positive integer.");
    expect(validation.errors).toContain("Repository file-signals cache TTL must be a positive integer.");
    expect(validation.errors).toContain(
      "Max repositories scanned per profile must be greater than or equal to max repositories scored."
    );
  });
});
