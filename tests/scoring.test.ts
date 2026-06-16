import { describe, expect, test } from "bun:test";
import fixture from "../fixtures/example-public-profile.json";
import {
  analyzeSignalGaps,
  classifySignalType,
  repositoryOverallWeights,
  scoreRepository,
  scoreUserProfile,
  signalDimensions,
  signalTypes
} from "../src";
import type { ProfileInput, SignalDimension } from "../src";

const now = new Date("2026-05-28T00:00:00.000Z");

describe("profile scoring", () => {
  test("keeps repository overall weights explicit and normalized", () => {
    const totalWeight = signalDimensions.reduce((total, dimension) => total + repositoryOverallWeights[dimension], 0);

    expect(Object.keys(repositoryOverallWeights).sort()).toEqual([...signalDimensions].sort());
    expect(totalWeight).toBeCloseTo(1, 6);
  });

  test("classifies every documented profile signal type", () => {
    expect(signalTypes).toEqual([
      "Maintainer-Builder",
      "Collaborator",
      "Builder",
      "High-Adoption Project",
      "Independent Builder",
      "General Signal Profile"
    ]);
    expect(classifySignalType(dimensionScores({ maintainability: 80, shipping: 70 }))).toBe("Maintainer-Builder");
    expect(classifySignalType(dimensionScores({ collaboration: 80 }))).toBe("Collaborator");
    expect(classifySignalType(dimensionScores({ completeness: 80, shipping: 65 }))).toBe("Builder");
    expect(classifySignalType(dimensionScores({ externalValidation: 80 }))).toBe("High-Adoption Project");
    expect(classifySignalType(dimensionScores({ completeness: 70, collaboration: 20 }))).toBe("Independent Builder");
    expect(classifySignalType(dimensionScores({ completeness: 40 }))).toBe("General Signal Profile");
  });

  test("scores public engineering signals and excludes archived repositories", () => {
    const report = scoreUserProfile(fixture as ProfileInput, { now });

    expect(report.username).toBe("example-builder");
    expect(report.topRepos.map((repo) => repo.name)).not.toContain("archived-widget");
    expect(report.overall).toBeGreaterThan(40);
    expect(report.dimensions.maintainability).toBeGreaterThan(report.dimensions.collaboration);
    expect(report.evidence.length).toBeGreaterThan(0);
    expect(report.limitations).toContain("Forked and archived repositories are excluded by default.");
  });

  test("honors the requested repository summary limit", () => {
    const report = scoreUserProfile(fixture as ProfileInput, { now, maxRepositories: 1 });

    expect(report.topRepos).toHaveLength(1);
    expect(report.topRepos[0]?.name).toBe("usable-toolkit");
    expect(report.limitations).toContain("Only the highest-signal 1 eligible repositories are summarized in this card.");
  });

  test("does not depend on raw commit count, streaks, followers, or language percentages", () => {
    const baseline = scoreUserProfile(fixture as ProfileInput, { now });
    const vanityFixture = {
      ...fixture,
      repositories: fixture.repositories.map((repository) => ({
        ...repository,
        rawCommitCount: 50000,
        contributionStreakDays: 365,
        followerCount: 100000,
        languagePercentages: {
          TypeScript: 99,
          Shell: 1
        }
      }))
    };
    const report = scoreUserProfile(vanityFixture as ProfileInput, { now });

    expect(report.overall).toBe(baseline.overall);
    expect(report.dimensions).toEqual(baseline.dimensions);
    expect(report.signalType).toBe(baseline.signalType);
  });

  test("uses codebase shape as a small maintainability signal without reading lines", () => {
    const sourceRepository = (fixture as ProfileInput).repositories[0]!;
    const withoutShape = scoreUserProfile(
      {
        username: "shape-baseline",
        repositories: [
          {
            ...sourceRepository,
            codebaseShape: {
              sourceFileCount: 0,
              testFileCount: 0,
              exampleFileCount: 0,
              medianSourceFileBytes: 0,
              p90SourceFileBytes: 0,
              oversizedSourceFileCount: 0,
              testToSourceRatio: 0
            }
          }
        ]
      },
      { now }
    );
    const withShape = scoreUserProfile(
      {
        username: "shape-aware",
        repositories: [
          {
            ...sourceRepository,
            codebaseShape: {
              sourceFileCount: 24,
              testFileCount: 4,
              exampleFileCount: 2,
              medianSourceFileBytes: 3200,
              p90SourceFileBytes: 12000,
              oversizedSourceFileCount: 0,
              testToSourceRatio: 0.167
            }
          }
        ]
      },
      { now }
    );

    expect(withShape.dimensions.maintainability).toBeGreaterThan(withoutShape.dimensions.maintainability);
    expect(withShape.evidence.some((item) => item.label === "Compact source file shape")).toBe(true);
    expect(withShape.evidence.some((item) => item.label.includes("line"))).toBe(false);
  });

  test("does not reward tiny or oversized codebase shape samples", () => {
    const sourceRepository = (fixture as ProfileInput).repositories[0]!;
    const tinyShape = scoreUserProfile(
      {
        username: "tiny-shape",
        repositories: [
          {
            ...sourceRepository,
            codebaseShape: {
              sourceFileCount: 2,
              testFileCount: 1,
              exampleFileCount: 1,
              medianSourceFileBytes: 1200,
              p90SourceFileBytes: 1400,
              oversizedSourceFileCount: 0,
              testToSourceRatio: 0.5
            }
          }
        ]
      },
      { now }
    );
    const oversizedShape = scoreUserProfile(
      {
        username: "oversized-shape",
        repositories: [
          {
            ...sourceRepository,
            codebaseShape: {
              sourceFileCount: 24,
              testFileCount: 4,
              exampleFileCount: 1,
              medianSourceFileBytes: 14000,
              p90SourceFileBytes: 80000,
              oversizedSourceFileCount: 10,
              testToSourceRatio: 0.167
            }
          }
        ]
      },
      { now }
    );

    expect(tinyShape.evidence.some((item) => item.label === "Compact source file shape")).toBe(false);
    expect(oversizedShape.evidence.some((item) => item.label === "Compact source file shape")).toBe(false);
  });

  test("keeps external validation finite when numeric inputs are not finite", () => {
    const sourceRepository = (fixture as ProfileInput).repositories[0]!;
    const poisoned = {
      ...(fixture as ProfileInput),
      repositories: [
        {
          ...sourceRepository,
          stars: Number.NaN,
          forks: Number.POSITIVE_INFINITY,
          issueResponseCount: Number.NEGATIVE_INFINITY
        }
      ]
    } as ProfileInput;

    const report = scoreUserProfile(poisoned, { now });

    expect(Number.isFinite(report.overall)).toBe(true);
    expect(Number.isFinite(report.dimensions.externalValidation)).toBe(true);
    expect(report.dimensions.externalValidation).toBeGreaterThanOrEqual(0);
    expect(report.dimensions.externalValidation).toBeLessThanOrEqual(100);
  });

  test("caps normalized influence from one dominant repository", () => {
    const sourceRepository = (fixture as ProfileInput).repositories[0]!;
    const dominantRepository = {
      ...sourceRepository,
      name: "dominant-public-repo",
      stars: 100_000,
      forks: 10_000,
      issueResponseCount: 100,
      pullRequestReviewCount: 100,
      externalContributorCount: 100
    };
    const quietPeer = {
      ...sourceRepository,
      stars: 0,
      forks: 0,
      issueResponseCount: 0,
      pullRequestReviewCount: 0,
      externalContributorCount: 0
    };
    const report = scoreUserProfile(
      {
        username: "cap-check",
        repositories: [
          dominantRepository,
          { ...quietPeer, name: "quiet-peer-one" },
          { ...quietPeer, name: "quiet-peer-two" }
        ]
      },
      { now }
    );

    expect(scoreRepository(dominantRepository, { now }).dimensions.externalValidation.score).toBe(100);
    expect(scoreRepository(quietPeer, { now }).dimensions.externalValidation.score).toBe(0);
    expect(report.dimensions.externalValidation).toBeLessThanOrEqual(36);
  });

  test("does not score public adoption against private-local profiles", () => {
    const report = scoreUserProfile(
      {
        ...(fixture as ProfileInput),
        signalVisibility: {
          scope: "public-and-owner-supplied-private",
          privateRepositoriesIncluded: true,
          privateRepositoryNamesRedacted: true,
          independentlyVerifiable: false,
          cardLabel: "Public + Private Signals",
          reportVisibility: "private-local"
        }
      },
      { now }
    );
    const scoredDimensions = [
      report.dimensions.maintainability,
      report.dimensions.completeness,
      report.dimensions.collaboration,
      report.dimensions.shipping,
      report.dimensions.consistency
    ];
    const expectedOverall = Math.round(
      scoredDimensions.reduce((total, score) => total + score, 0) / scoredDimensions.length
    );

    expect(report.unavailableDimensions).toContain("externalValidation");
    expect(report.overall).toBe(expectedOverall);
    expect(report.limitations).toContain(
      "Public adoption is shown as N/A because private repository adoption is not publicly verifiable."
    );
  });

  test("carries repository activity window into report limitations", () => {
    const report = scoreUserProfile(
      {
        ...(fixture as ProfileInput),
        activityWindowDays: 180
      },
      { now }
    );

    expect(report.activityWindowDays).toBe(180);
    expect(report.limitations).toContain("Repositories are filtered to activity within the last 180 days.");
  });

  test("discloses when GitHub truncates repository file trees", () => {
    const sourceRepository = (fixture as ProfileInput).repositories[0]!;
    const report = scoreUserProfile(
      {
        username: "truncated-tree-profile",
        repositories: [
          {
            ...sourceRepository,
            codebaseShape: {
              ...(sourceRepository.codebaseShape!),
              treeTruncated: true
            }
          }
        ]
      },
      { now }
    );

    expect(report.limitations).toContain(
      "Some GitHub repository file trees were truncated, so file-based signals may be incomplete."
    );
  });

  test("discloses omitted repositories when GitHub detail collection partially fails", () => {
    const report = scoreUserProfile(
      {
        ...(fixture as ProfileInput),
        repositoryCollectionFailureCount: 2
      },
      { now }
    );

    expect(report.limitations).toContain(
      "2 repositories could not be collected from GitHub and were omitted from this report."
    );
  });

  test("treats public collaboration as context for independent-builder profiles", () => {
    const sourceRepository = (fixture as ProfileInput).repositories[0]!;
    const report = scoreUserProfile(
      {
        username: "solo-builder",
        repositories: [
          {
            ...sourceRepository,
            hasContributing: false,
            hasCodeOfConduct: false,
            hasReleases: false,
            pushedAt: "2025-01-01T00:00:00.000Z",
            issueResponseCount: 0,
            pullRequestReviewCount: 0,
            externalContributorCount: 0
          }
        ]
      },
      { now }
    );
    const scoredDimensions = [
      report.dimensions.maintainability,
      report.dimensions.completeness,
      report.dimensions.shipping,
      report.dimensions.consistency,
      report.dimensions.externalValidation
    ];
    const expectedOverall = Math.round(
      scoredDimensions.reduce((total, score) => total + score, 0) / scoredDimensions.length
    );

    expect(report.signalType).toBe("Independent Builder");
    expect(report.dimensions.collaboration).toBeLessThan(40);
    expect(report.overall).toBe(expectedOverall);
    expect(report.limitations).toContain(
      "Public collaboration is treated as context for independent-builder profiles."
    );
  });

  test("finds public signal gaps without treating them as a ranking", () => {
    const report = analyzeSignalGaps(fixture as ProfileInput, { now });

    expect(report.username).toBe("example-builder");
    expect(report.gaps.length).toBeGreaterThan(0);
    expect(report.gaps.some((gap) => gap.repository === "small-experiment")).toBe(true);
    expect(report.limitations).toContain("These are improvement hints, not a developer ranking.");
  });
});

function dimensionScores(overrides: Partial<Record<SignalDimension, number>>): Record<SignalDimension, number> {
  return {
    maintainability: 0,
    completeness: 0,
    collaboration: 0,
    shipping: 0,
    consistency: 0,
    externalValidation: 0,
    ...overrides
  };
}
