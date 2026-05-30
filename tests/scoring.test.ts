import { describe, expect, test } from "bun:test";
import fixture from "../fixtures/example-public-profile.json";
import { analyzeSignalGaps, scoreUserProfile } from "../src";
import type { ProfileInput } from "../src";

const now = new Date("2026-05-28T00:00:00.000Z");

describe("profile scoring", () => {
  test("scores public engineering signals and excludes archived repositories", () => {
    const report = scoreUserProfile(fixture as ProfileInput, { now });

    expect(report.username).toBe("example-builder");
    expect(report.topRepos.map((repo) => repo.name)).not.toContain("archived-widget");
    expect(report.overall).toBeGreaterThan(40);
    expect(report.dimensions.maintainability).toBeGreaterThan(report.dimensions.collaboration);
    expect(report.evidence.length).toBeGreaterThan(0);
    expect(report.limitations).toContain("Forked and archived repositories are excluded by default.");
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

  test("finds public signal gaps without treating them as a ranking", () => {
    const report = analyzeSignalGaps(fixture as ProfileInput, { now });

    expect(report.username).toBe("example-builder");
    expect(report.gaps.length).toBeGreaterThan(0);
    expect(report.gaps.some((gap) => gap.repository === "small-experiment")).toBe(true);
    expect(report.limitations).toContain("These are improvement hints, not a developer ranking.");
  });
});
