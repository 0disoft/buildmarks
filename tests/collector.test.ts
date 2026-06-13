import { describe, expect, test } from "bun:test";
import fixture from "../fixtures/collected-public-profile.json";
import { normalizePublicGitHubProfile, scoreUserProfile } from "../src";
import type { CollectedGitHubProfile } from "../src";

const now = new Date("2026-05-28T00:00:00.000Z");

describe("public GitHub collector contract", () => {
  test("normalizes collected public profile data into scoring input", () => {
    const profile = normalizePublicGitHubProfile(fixture as CollectedGitHubProfile);
    const usableToolkit = profile.repositories.find((repository) => repository.name === "usable-toolkit");

    expect(profile.username).toBe("example-builder");
    expect(profile.generatedAt).toBe("2026-05-28T00:00:00.000Z");
    expect(profile.activityWindowDays).toBe(365);
    expect(
      normalizePublicGitHubProfile({
        ...(fixture as CollectedGitHubProfile),
        repositoryCollectionFailureCount: 2
      }).repositoryCollectionFailureCount
    ).toBe(2);
    expect(usableToolkit).toMatchObject({
      owner: "example-builder",
      name: "usable-toolkit",
      isFork: false,
      isArchived: false,
      hasReadme: true,
      hasUsageGuide: true,
      hasCi: true,
      hasTests: true,
      hasReleases: true,
      codebaseShape: {
        sourceFileCount: 42,
        testFileCount: 8,
        exampleFileCount: 3,
        medianSourceFileBytes: 3600,
        p90SourceFileBytes: 14000,
        oversizedSourceFileCount: 1,
        testToSourceRatio: 0.19
      },
      issueResponseCount: 14,
      pullRequestReviewCount: 6,
      externalContributorCount: 5
    });
  });

  test("preserves fork and archive flags so scoring can exclude those repositories", () => {
    const profile = normalizePublicGitHubProfile(fixture as CollectedGitHubProfile);
    const report = scoreUserProfile(profile, { now });

    expect(profile.repositories.find((repository) => repository.name === "forked-library")?.isFork).toBe(true);
    expect(profile.repositories.find((repository) => repository.name === "archived-widget")?.isArchived).toBe(true);
    expect(report.topRepos.map((repository) => repository.name)).toEqual(["usable-toolkit"]);
    expect(report.limitations).toContain("Forked and archived repositories are excluded by default.");
  });

  test("keeps vanity-only metrics out of the collector fixture", () => {
    const serialized = JSON.stringify(fixture);

    expect(serialized).not.toContain("rawCommitCount");
    expect(serialized).not.toContain("contributionStreak");
    expect(serialized).not.toContain("follower");
    expect(serialized).not.toContain("languagePercent");
    expect(serialized).not.toContain("seniority");
  });
});
