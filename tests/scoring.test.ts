import { describe, expect, test } from "bun:test";
import fixture from "../fixtures/example-public-profile.json";
import { scoreUserProfile } from "../src";
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
});
