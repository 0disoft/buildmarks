import { describe, expect, test } from "bun:test";
import {
  defaultGitHubCollectorPolicy,
  privateLocalGitHubCollectorPolicy,
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
    expect(defaultGitHubCollectorPolicy.limits.repositoryActivityWindowDays).toBe(365);
    expect(defaultGitHubCollectorPolicy.limits.maxConcurrentRepositoryCollections).toBeGreaterThan(0);
    expect(defaultGitHubCollectorPolicy.limits.maxRepositoriesScannedPerProfile).toBeGreaterThanOrEqual(
      defaultGitHubCollectorPolicy.limits.maxRepositoriesScoredPerProfile
    );
  });

  test("allows private-local collection only under the private-local policy mode", () => {
    const validation = validateGitHubCollectorPolicy(privateLocalGitHubCollectorPolicy, { mode: "private-local" });
    const publicModeValidation = validateGitHubCollectorPolicy(privateLocalGitHubCollectorPolicy);
    const privateModeDefaultValidation = validateGitHubCollectorPolicy(defaultGitHubCollectorPolicy, {
      mode: "private-local"
    });

    expect(privateLocalGitHubCollectorPolicy.publicOnly).toBe(false);
    expect(privateLocalGitHubCollectorPolicy.allowPrivateRepositories).toBe(true);
    expect(validation).toEqual({ ok: true, errors: [] });
    expect(publicModeValidation.errors).toContain("GitHub collector policy must remain public-only.");
    expect(publicModeValidation.errors).toContain("GitHub collector policy must not allow private repositories.");
    expect(privateModeDefaultValidation.errors).toContain(
      "Private-local GitHub collector policy must not be public-only."
    );
    expect(privateModeDefaultValidation.errors).toContain(
      "Private-local GitHub collector policy must allow private repositories."
    );
  });

  test("rejects private repository scopes and private collection", () => {
    const policy: GitHubCollectorPolicy = {
      ...defaultGitHubCollectorPolicy,
      publicOnly: false,
      allowPrivateRepositories: true,
      requiredTokenScopes: [" Repo "]
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
        maxRepositoriesScoredPerProfile: 12,
        repositoryActivityWindowDays: 0,
        maxConcurrentRepositoryCollections: 0
      }
    };

    const validation = validateGitHubCollectorPolicy(policy);

    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain("Profile report cache TTL must be a positive integer.");
    expect(validation.errors).toContain("Repository file-signals cache TTL must be a positive integer.");
    expect(validation.errors).toContain(
      "Max repositories scanned per profile must be greater than or equal to max repositories scored."
    );
    expect(validation.errors).toContain("Repository activity window days must be a positive integer.");
    expect(validation.errors).toContain("Max concurrent repository collections must be a positive integer.");
  });

  test("rejects repository and concurrency limits above the bounded live collector budget", () => {
    const policy: GitHubCollectorPolicy = {
      ...defaultGitHubCollectorPolicy,
      limits: {
        maxRepositoriesScannedPerProfile: 101,
        maxRepositoriesScoredPerProfile: 25,
        repositoryActivityWindowDays: 3651,
        maxConcurrentRepositoryCollections: 9
      }
    };

    const validation = validateGitHubCollectorPolicy(policy);

    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain("Max repositories scanned per profile must be less than or equal to 100.");
    expect(validation.errors).toContain("Max repositories scored per profile must be less than or equal to 24.");
    expect(validation.errors).toContain("Repository activity window days must be less than or equal to 3650.");
    expect(validation.errors).toContain("Max concurrent repository collections must be less than or equal to 8.");
  });
});
