import { describe, expect, test } from "bun:test";
import fixture from "../fixtures/example-public-profile.json";
import {
  analyzeSignalGaps,
  classifySignalType,
  privateLocalSignalVisibility,
  publicOnlySignalVisibility,
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
      "Productized Builder",
      "Builder",
      "Steady Shipper",
      "Well-Documented Project",
      "General Signal Profile"
    ]);
    expect(classifySignalType(dimensionScores({ maintainability: 80, stewardship: 70, shipping: 70 }))).toBe("Maintainer-Builder");
    expect(classifySignalType(dimensionScores({ usability: 80, shipping: 70 }))).toBe("Productized Builder");
    expect(classifySignalType(dimensionScores({ completeness: 80, shipping: 65 }))).toBe("Builder");
    expect(classifySignalType(dimensionScores({ consistency: 80, shipping: 65 }))).toBe("Steady Shipper");
    expect(classifySignalType(dimensionScores({ usability: 80 }))).toBe("Well-Documented Project");
    expect(classifySignalType(dimensionScores({ completeness: 40 }))).toBe("General Signal Profile");
  });

  test("scores public engineering signals and excludes archived repositories", () => {
    const report = scoreUserProfile(fixture as ProfileInput, { now });

    expect(report.username).toBe("example-builder");
    expect(report.topRepos.map((repo) => repo.name)).not.toContain("archived-widget");
    expect(report.overall).toBeGreaterThan(40);
    expect(report.dimensions.maintainability).toBeGreaterThan(report.dimensions.stewardship);
    expect(report.evidence.length).toBeGreaterThan(0);
    expect(report.limitations).toContain("Forked and archived repositories are excluded by default.");
  });

  test("honors the requested repository summary limit", () => {
    const report = scoreUserProfile(fixture as ProfileInput, { now, maxRepositories: 1 });

    expect(report.topRepos).toHaveLength(1);
    expect(report.topRepos[0]?.name).toBe("usable-toolkit");
    expect(report.limitations).toContain("Only the highest-signal 1 eligible repositories are summarized in this card.");
  });

  test("discloses when no eligible repositories can be scored", () => {
    const report = scoreUserProfile(
      {
        username: "empty-profile",
        repositories: []
      },
      { now }
    );

    expect(report.overall).toBe(0);
    expect(report.topRepos).toEqual([]);
    expect(report.limitations).toContain("No eligible repositories were available to score.");
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

  test("does not treat future repository timestamps as recent activity", () => {
    const sourceRepository = (fixture as ProfileInput).repositories[0]!;
    const present = scoreRepository(
      {
        ...sourceRepository,
        pushedAt: now.toISOString()
      },
      { now }
    );
    const future = scoreRepository(
      {
        ...sourceRepository,
        pushedAt: "2026-06-28T00:00:00.000Z"
      },
      { now }
    );

    expect(present.dimensions.maintainability.evidence.some((item) => item.label === "Recent maintenance activity")).toBe(true);
    expect(future.dimensions.maintainability.evidence.some((item) => item.label === "Recent maintenance activity")).toBe(false);
    expect(future.dimensions.shipping.evidence.some((item) => item.label === "Recent shipping or maintenance activity")).toBe(false);
    expect(future.dimensions.consistency.evidence.some((item) => item.label === "Repository has recent public activity")).toBe(false);
  });

  test("keeps profile scores finite when numeric popularity inputs are not finite", () => {
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
    signalDimensions.forEach((dimension) => {
      expect(Number.isFinite(report.dimensions[dimension])).toBe(true);
      expect(report.dimensions[dimension]).toBeGreaterThanOrEqual(0);
      expect(report.dimensions[dimension]).toBeLessThanOrEqual(100);
    });
  });

  test("does not reward invalid codebase shape numbers from direct scoring input", () => {
    const sourceRepository = (fixture as ProfileInput).repositories[0]!;
    const report = scoreRepository(
      {
        ...sourceRepository,
        hasTests: false,
        codebaseShape: {
          sourceFileCount: Number.POSITIVE_INFINITY,
          testFileCount: Number.POSITIVE_INFINITY,
          exampleFileCount: Number.POSITIVE_INFINITY,
          medianSourceFileBytes: 1,
          p90SourceFileBytes: 1,
          oversizedSourceFileCount: Number.NEGATIVE_INFINITY,
          testToSourceRatio: Number.POSITIVE_INFINITY
        }
      },
      { now }
    );

    expect(report.evidence.some((item) => item.label === "Test file surface found")).toBe(false);
    expect(report.evidence.some((item) => item.label === "Compact source file shape")).toBe(false);
    expect(report.evidence.some((item) => item.label === "Example or fixture surface found")).toBe(false);
    expect(Number.isFinite(report.dimensions.maintainability.score)).toBe(true);
    expect(report.dimensions.maintainability.score).toBeGreaterThanOrEqual(0);
    expect(report.dimensions.maintainability.score).toBeLessThanOrEqual(100);
  });

  test("does not reward non-boolean or non-string-date direct scoring inputs", () => {
    const sourceRepository = (fixture as ProfileInput).repositories[0]!;
    const { codebaseShape: _codebaseShape, ...sourceRepositoryWithoutShape } = sourceRepository;
    const report = scoreRepository(
      {
        ...sourceRepositoryWithoutShape,
        createdAt: 0 as unknown as string,
        pushedAt: true as unknown as string,
        hasReadme: "true" as unknown as boolean,
        hasLicense: "true" as unknown as boolean,
        hasUsageGuide: "true" as unknown as boolean,
        hasCi: "true" as unknown as boolean,
        hasTests: 1 as unknown as boolean,
        hasChangelog: "true" as unknown as boolean,
        hasContributing: "true" as unknown as boolean,
        hasCodeOfConduct: "true" as unknown as boolean,
        hasSecurityPolicy: "true" as unknown as boolean,
        hasReleases: "true" as unknown as boolean,
        hasDemoOrDocs: "true" as unknown as boolean,
        hasPackageArtifact: "true" as unknown as boolean
      },
      { now }
    );

    signalDimensions.forEach((dimension) => {
      expect(report.dimensions[dimension].score).toBe(0);
      expect(report.dimensions[dimension].evidence).toEqual([]);
    });
    expect(report.evidence).toEqual([]);
  });

  test("does not include repositories with invalid eligibility booleans in profile scoring", () => {
    const sourceRepository = (fixture as ProfileInput).repositories[0]!;
    const report = scoreUserProfile(
      {
        username: "invalid-eligibility",
        repositories: [{
          ...sourceRepository,
          isFork: "false" as unknown as boolean,
          isArchived: false
        }]
      },
      { now }
    );

    expect(report.topRepos).toEqual([]);
    expect(report.overall).toBe(0);
    expect(report.limitations).toContain("No eligible repositories were available to score.");
  });

  test("does not let popularity and deferred public activity create a front-card dimension", () => {
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
    const dominantScore = scoreRepository(dominantRepository, { now });
    const quietScore = scoreRepository(quietPeer, { now });

    expect(signalDimensions).not.toContain("externalValidation" as SignalDimension);
    signalDimensions.forEach((dimension) => {
      expect(dominantScore.dimensions[dimension].score).toBe(quietScore.dimensions[dimension].score);
    });
    expect(dominantScore.weight).toBe(quietScore.weight);
  });

  test("uses the same always-measurable dimensions for private-local profiles", () => {
    const sourceRepository = (fixture as ProfileInput).repositories[0]!;
    const { url: _url, ...sourceRepositoryWithoutUrl } = sourceRepository;
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
        },
        repositories: [{
          ...sourceRepositoryWithoutUrl,
          name: "Private repository 1",
          visibility: "private",
          redactedName: true
        }]
      },
      { now }
    );
    const scoredDimensions = signalDimensions.map((dimension) => report.dimensions[dimension]);
    const expectedOverall = Math.round(
      scoredDimensions.reduce((total, score) => total + score, 0) / scoredDimensions.length
    );

    expect(report.unavailableDimensions).toBeUndefined();
    expect(report.overall).toBe(expectedOverall);
    expect(report.limitations).toContain(
      "Private-local cards use the same file, release, maintenance, and stewardship dimensions as public-only cards."
    );
  });

  test("rejects private repository scoring without private-local disclosure", () => {
    const sourceRepository = (fixture as ProfileInput).repositories[0]!;
    const { url: _url, ...sourceRepositoryWithoutUrl } = sourceRepository;
    const privateRepository = {
      ...sourceRepositoryWithoutUrl,
      owner: "secret-client-org",
      name: "Private repository 1",
      visibility: "private" as const,
      redactedName: true
    };

    expect(() => scoreUserProfile({
      username: "private-without-disclosure",
      repositories: [privateRepository]
    }, { now })).toThrow("private-local signal visibility");
    expect(() => scoreUserProfile({
      username: "redacted-without-private-visibility",
      repositories: [{
        ...sourceRepositoryWithoutUrl,
        name: "Private repository 1",
        redactedName: true
      }]
    }, { now })).toThrow("visibility to private");
    expect(scoreUserProfile({
      username: "private-with-disclosure",
      signalVisibility: privateLocalSignalVisibility,
      repositories: [privateRepository]
    }, { now }).dimensions.stewardship).toBeGreaterThan(0);
    expect(() => scoreUserProfile({
      username: "private-claim-without-private-input",
      signalVisibility: privateLocalSignalVisibility,
      repositories: [sourceRepositoryWithoutUrl]
    }, { now })).toThrow("at least one private repository");
    expect(() => scoreUserProfile({
      username: "private-with-incomplete-disclosure",
      signalVisibility: {
        ...privateLocalSignalVisibility,
        privateRepositoryNamesRedacted: false
      },
      repositories: [privateRepository]
    }, { now })).toThrow("Private-local signalVisibility fields are inconsistent");
    expect(() => scoreUserProfile({
      username: "public-with-inconsistent-disclosure",
      signalVisibility: {
        ...publicOnlySignalVisibility,
        independentlyVerifiable: false
      },
      repositories: [sourceRepositoryWithoutUrl]
    }, { now })).toThrow("Public-only signalVisibility fields are inconsistent");
  });

  test("redacts private repository owners from scored output", () => {
    const sourceRepository = (fixture as ProfileInput).repositories[0]!;
    const { url: _url, ...sourceRepositoryWithoutUrl } = sourceRepository;
    const privateRepository = {
      ...sourceRepositoryWithoutUrl,
      owner: "secret-client-org",
      name: "Private repository 1",
      visibility: "private" as const,
      redactedName: true
    };
    const repositoryScore = scoreRepository(privateRepository, { now });
    const profileScore = scoreUserProfile({
      username: "owner-profile",
      signalVisibility: privateLocalSignalVisibility,
      repositories: [privateRepository]
    }, { now });

    expect(repositoryScore.owner).toBe("Private owner");
    expect(repositoryScore.signalVisibility?.privateRepositoriesIncluded).toBe(true);
    expect(profileScore.topRepos[0]?.owner).toBe("Private owner");
    expect(JSON.stringify(profileScore)).not.toContain("secret-client-org");
    expect(() => scoreRepository({
      ...privateRepository,
      name: "secret-toolkit"
    }, { now })).toThrow("must use redacted repository names");
    expect(() => scoreRepository({
      ...privateRepository,
      url: "https://github.com/secret-client-org/secret-toolkit"
    }, { now })).toThrow("must omit repository URLs");
    expect(() => scoreRepository({
      ...sourceRepositoryWithoutUrl,
      name: "Private repository 1",
      redactedName: true
    }, { now })).toThrow("visibility to private");
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

  test("does not add context-only collaboration penalties for solo-looking profiles", () => {
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
    const scoredDimensions = signalDimensions.map((dimension) => report.dimensions[dimension]);
    const expectedOverall = Math.round(
      scoredDimensions.reduce((total, score) => total + score, 0) / scoredDimensions.length
    );

    expect(signalDimensions).not.toContain("collaboration" as SignalDimension);
    expect(report.overall).toBe(expectedOverall);
    expect(report.limitations).not.toContain("Public collaboration is treated as context for independent-builder profiles.");
  });

  test("finds public signal gaps without treating them as a ranking", () => {
    const report = analyzeSignalGaps(fixture as ProfileInput, { now });

    expect(report.username).toBe("example-builder");
    expect(report.gaps.length).toBeGreaterThan(0);
    expect(report.gaps.some((gap) => gap.repository === "small-experiment")).toBe(true);
    expect(report.limitations).toContain("These are improvement hints, not a developer ranking.");
  });

  test("does not let invalid codebase shape numbers hide public signal gaps", () => {
    const sourceRepository = (fixture as ProfileInput).repositories[0]!;
    const report = analyzeSignalGaps(
      {
        username: "invalid-shape-gaps",
        repositories: [
          {
            ...sourceRepository,
            codebaseShape: {
              ...sourceRepository.codebaseShape!,
              exampleFileCount: Number.POSITIVE_INFINITY
            }
          }
        ]
      },
      { now }
    );
    const usabilityGap = report.gaps.find((gap) => gap.dimension === "usability");

    expect(usabilityGap?.missing).toContain("example or fixture files");
  });

  test("does not let non-boolean direct gap inputs hide missing signals", () => {
    const sourceRepository = (fixture as ProfileInput).repositories[0]!;
    const { codebaseShape: _codebaseShape, ...sourceRepositoryWithoutShape } = sourceRepository;
    const report = analyzeSignalGaps(
      {
        username: "invalid-gap-signals",
        repositories: [{
          ...sourceRepositoryWithoutShape,
          hasReadme: "true" as unknown as boolean,
          hasLicense: "true" as unknown as boolean,
          hasUsageGuide: "true" as unknown as boolean,
          hasCi: "true" as unknown as boolean,
          hasTests: "true" as unknown as boolean,
          hasChangelog: "true" as unknown as boolean,
          hasContributing: "true" as unknown as boolean,
          hasCodeOfConduct: "true" as unknown as boolean,
          hasSecurityPolicy: "true" as unknown as boolean,
          hasReleases: "true" as unknown as boolean,
          hasDemoOrDocs: "true" as unknown as boolean,
          hasPackageArtifact: "true" as unknown as boolean
        }]
      },
      { now }
    );
    const missing = report.gaps.flatMap((gap) => gap.missing);

    expect(missing).toContain("README");
    expect(missing).toContain("tests");
    expect(missing).toContain("release or tag");
    expect(missing).toContain("contribution guide");
  });

  test("rejects private repository gaps without matching private-local disclosure", () => {
    const sourceRepository = (fixture as ProfileInput).repositories[0]!;
    const { url: _url, ...sourceRepositoryWithoutUrl } = sourceRepository;
    const privateRepository = {
      ...sourceRepositoryWithoutUrl,
      name: "Private repository 1",
      visibility: "private" as const,
      redactedName: true
    };

    expect(() => analyzeSignalGaps({
      username: "private-gaps-without-disclosure",
      repositories: [privateRepository]
    }, { now })).toThrow("private-local signal visibility");
    expect(() => analyzeSignalGaps({
      username: "private-gaps-claim-without-private-input",
      signalVisibility: privateLocalSignalVisibility,
      repositories: [sourceRepositoryWithoutUrl]
    }, { now })).toThrow("at least one private repository");
    expect(() => analyzeSignalGaps({
      username: "private-gaps-with-incomplete-disclosure",
      signalVisibility: {
        ...privateLocalSignalVisibility,
        reportVisibility: "public-safe"
      },
      repositories: [privateRepository]
    }, { now })).toThrow("Private-local signalVisibility fields are inconsistent");
  });
});

function dimensionScores(overrides: Partial<Record<SignalDimension, number>>): Record<SignalDimension, number> {
  return {
    maintainability: 0,
    completeness: 0,
    usability: 0,
    shipping: 0,
    consistency: 0,
    stewardship: 0,
    ...overrides
  };
}
