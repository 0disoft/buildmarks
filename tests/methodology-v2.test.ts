import { describe, expect, test } from "bun:test";
import fixture from "../fixtures/example-public-profile.json";
import {
  createStaticReport,
  detectRepositoryKindFromPaths,
  methodologyCriteria,
  presenceOnlyScoreCap,
  scoreRepository,
  scoreUserProfile,
  scoringMethodologyVersion,
  type ProfileInput,
  type RepositoryInput
} from "../src";

const now = new Date("2026-05-28T00:00:00.000Z");
const sourceRepository = (fixture as ProfileInput).repositories[0]!;

describe("scoring methodology v2", () => {
  test("keeps report format and scoring method versions separate", () => {
    const report = createStaticReport(fixture as ProfileInput, { now });

    expect(report.version).toBe(1);
    expect(report.schemaVersion).toBe("buildmarks-report/v1");
    expect(report.methodologyVersion).toBe(scoringMethodologyVersion);
    expect(report.profile.methodologyVersion).toBe(scoringMethodologyVersion);
  });

  test("marks checks that do not fit a documentation repository as not applicable", () => {
    const documentation = scoreRepository({
      ...sourceRepository,
      repositoryKind: "documentation",
      repositoryKindSource: "declared"
    }, { now });

    expect(documentation.repositoryKind).toEqual({
      kind: "documentation",
      source: "declared",
      confidence: "high"
    });
    expect(documentation.dimensions.shipping.assessment.applicability).toBe("not-applicable");
    expect(documentation.dimensions.shipping.assessment.score).toBeNull();
    expect(documentation.overall).toBeGreaterThan(0);
  });

  test("treats unavailable observations as lower coverage instead of a failed check", () => {
    const complete = scoreRepository(sourceRepository, { now });
    const partial = scoreRepository({
      ...sourceRepository,
      unavailableObservations: ["securityPolicy", "contributing", "codeOfConduct"]
    }, { now });

    expect(partial.dimensions.stewardship.assessment.coverage.ratio)
      .toBeLessThan(complete.dimensions.stewardship.assessment.coverage.ratio);
    expect(partial.dimensions.stewardship.assessment.criteria
      .filter((criterion) => criterion.applicability === "unavailable")
      .every((criterion) => criterion.pointsAwarded === 0 && criterion.pointsAvailable === 0))
      .toBe(true);
  });

  test("caps checklist decoration until independent project details line up", () => {
    const presenceOnly = scoreRepository(repositoryWith({
      hasLicense: true,
      hasSecurityPolicy: true,
      hasCodeOfConduct: true,
      hasChangelog: true
    }), { now });
    const corroborated = scoreRepository(repositoryWith({
      hasLicense: true,
      hasSecurityPolicy: true,
      hasCodeOfConduct: true,
      hasChangelog: true,
      hasContributing: true
    }), { now });

    expect(presenceOnly.dimensions.stewardship.assessment.presenceOnlyCapApplied).toBe(true);
    expect(presenceOnly.dimensions.stewardship.score).toBe(presenceOnlyScoreCap);
    expect(corroborated.dimensions.stewardship.assessment.presenceOnlyCapApplied).toBe(false);
    expect(corroborated.dimensions.stewardship.score).toBeGreaterThan(presenceOnlyScoreCap);
  });

  test("does not award README corroboration when the README itself is absent", () => {
    const scored = scoreRepository(repositoryWith({
      hasReadme: false,
      hasUsageGuide: true,
      hasDemoOrDocs: true
    }), { now });
    const criterion = scored.dimensions.completeness.assessment.criteria.find(
      (item) => item.criterionId === "completeness.readme-usage"
    );

    expect(criterion).toMatchObject({ observed: false, pointsAwarded: 0, evidenceIds: [] });
    expect(scored.evidenceLedger.some(
      (item) => item.criterionId === "completeness.readme-usage"
    )).toBe(false);
  });

  test("uses every reviewed repository for the profile calculation regardless of display limit", () => {
    const profile: ProfileInput = {
      username: "representative-profile",
      repositories: [
        repositoryWith({ name: "library", repositoryKind: "library", hasTests: true, hasCi: true }),
        repositoryWith({ name: "docs", repositoryKind: "documentation", hasPackageArtifact: false }),
        repositoryWith({ name: "experiment", repositoryKind: "experiment", hasPackageArtifact: false, hasReleases: false })
      ]
    };
    const oneCardRepository = scoreUserProfile(profile, { now, maxRepositories: 1 });
    const threeCardRepositories = scoreUserProfile(profile, { now, maxRepositories: 3 });

    expect(oneCardRepository.topRepos).toHaveLength(1);
    expect(threeCardRepositories.topRepos).toHaveLength(3);
    expect(oneCardRepository.overall).toBe(threeCardRepositories.overall);
    expect(oneCardRepository.dimensions).toEqual(threeCardRepositories.dimensions);
    expect(oneCardRepository.selection.evaluatedCount).toBe(3);
  });

  test("keeps representative selection stable when the input order changes", () => {
    const repositories = [
      repositoryWith({ name: "z-library", repositoryKind: "library" }),
      repositoryWith({ name: "a-docs", repositoryKind: "documentation" }),
      repositoryWith({ name: "m-cli", repositoryKind: "cli" })
    ];
    const forward = scoreUserProfile({ username: "stable", repositories }, { now, maxRepositories: 2 });
    const reversed = scoreUserProfile({ username: "stable", repositories: [...repositories].reverse() }, { now, maxRepositories: 2 });

    expect(forward.topRepos.map((repository) => repository.name))
      .toEqual(reversed.topRepos.map((repository) => repository.name));
    expect(forward.overall).toBe(reversed.overall);
  });

  test("links every awarded criterion to an inspectable detail", () => {
    const scored = scoreRepository(sourceRepository, { now });
    const detailIds = new Set(scored.evidenceLedger.map((item) => item.id));
    const awarded = Object.values(scored.dimensions)
      .flatMap((dimension) => dimension.assessment.criteria)
      .filter((criterion) => criterion.pointsAwarded > 0);

    expect(awarded.length).toBeGreaterThan(0);
    expect(awarded.every((criterion) =>
      criterion.evidenceIds.length === 1 && detailIds.has(criterion.evidenceIds[0])
    )).toBe(true);
    expect(methodologyCriteria.every((criterion) => criterion.id.includes("."))).toBe(true);
  });

  test("detects strong repository shapes without guessing when the paths are ambiguous", () => {
    expect(detectRepositoryKindFromPaths(
      ["package.json", "packages/a/package.json", "packages/b/package.json"],
      { sourceFileCount: 30, hasReadme: true, hasDemoOrDocs: false }
    ).kind).toBe("monorepo");
    expect(detectRepositoryKindFromPaths(
      ["README.md", "notes/idea.txt"],
      { sourceFileCount: 0, hasReadme: true, hasDemoOrDocs: false }
    )).toEqual({ kind: "general", source: "fallback", confidence: "low" });
  });
});

function repositoryWith(overrides: Partial<RepositoryInput>): RepositoryInput {
  return {
    ...sourceRepository,
    owner: "example-builder",
    name: "methodology-fixture",
    repositoryKind: "general",
    repositoryKindSource: "declared",
    hasReadme: false,
    hasLicense: false,
    hasUsageGuide: false,
    hasCi: false,
    hasTests: false,
    hasChangelog: false,
    hasContributing: false,
    hasCodeOfConduct: false,
    hasSecurityPolicy: false,
    hasReleases: false,
    hasDemoOrDocs: false,
    hasPackageArtifact: false,
    codebaseShape: {
      sourceFileCount: 8,
      testFileCount: 0,
      exampleFileCount: 0,
      medianSourceFileBytes: 3_000,
      p90SourceFileBytes: 9_000,
      oversizedSourceFileCount: 0,
      testToSourceRatio: 0
    },
    ...overrides
  };
}
