import { describe, expect, test } from "bun:test";
import fixture from "../fixtures/example-public-profile.json";
import { createStaticReport, renderUserSignalCard, scoreRepository, scoreUserProfile } from "../src";
import { parseProfileInput } from "../src/cli/profile-input";
import { resolveEvaluationTime } from "../src/shared/evaluation-time";

const now = new Date("2026-05-28T00:00:00.000Z");
const base = { ...fixture.repositories[0]!, repositoryKind: "library" as const, repositoryKindSource: "declared" as const };
const day = 86_400_000;

describe("evaluation time", () => {
  test("replays saved snapshots and applies explicit evaluation time to the whole report", () => {
    const saved = createStaticReport(fixture);
    expect(saved).toEqual(createStaticReport(fixture, { now }));
    expect(saved.profile.generatedAt).toBe(saved.gaps.generatedAt);
    const laterTime = new Date("2027-05-28T00:00:00Z");
    const later = createStaticReport(fixture, { now: laterTime });
    expect(later.profile.generatedAt).toBe(laterTime.toISOString());
    expect(later.gaps.generatedAt).toBe(laterTime.toISOString());
    expect(later.profile.overall).not.toBe(saved.profile.overall);
  });

  test("snapshots a mutable Date and rejects invalid explicit times", () => {
    const source = new Date(now);
    const captured = resolveEvaluationTime(source);
    source.setTime(0);
    expect(captured.toISOString()).toBe(now.toISOString());
    expect(() => scoreUserProfile(fixture, { now: new Date(NaN) })).toThrow("Evaluation time");
    for (const value of ["invalid", "", 123, null]) {
      expect(() => parseProfileInput({ ...fixture, generatedAt: value })).toThrow("generatedAt");
    }
  });

  for (const offset of [-1, 0, 1]) {
    test(`recent and established history at 180 days ${offset}ms`, () => {
      const timestamp = new Date(now.getTime() - 180 * day + offset).toISOString();
      const report = scoreRepository({ ...base, pushedAt: timestamp, createdAt: timestamp }, { now });
      const criteria = report.dimensions.consistency.assessment.criteria;
      expect(criteria.find(item => item.criterionId === "consistency.recent")?.observed).toBe(offset >= 0);
      expect(criteria.find(item => item.criterionId === "consistency.history")?.observed).toBe(offset <= 0);
    });
  }

  test("renders an unknown date without inventing a current generation date", () => {
    const report = scoreUserProfile(fixture, { now });
    expect(renderUserSignalCard({ ...report, generatedAt: "invalid" })).toContain("Date unavailable");
  });
});
