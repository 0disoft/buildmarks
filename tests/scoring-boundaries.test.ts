import { describe, expect, test } from "bun:test";
import fixture from "../fixtures/example-public-profile.json";
import { aggregateScoreAssessments } from "../src/scoring/assessment";
import { analyzeSignalGaps, scoreRepository, scoreUserProfile, type ProfileInput, type ScoreAssessment } from "../src";
import { parseProfileInput } from "../src/cli/profile-input";

const now = new Date("2026-05-28T00:00:00Z");
const base = { ...fixture.repositories[0]!, repositoryKind: "library" as const, repositoryKindSource: "declared" as const };

describe("scoring boundaries", () => {
  for (const [observed, score, confidence] of [
    [4996, null, "low"], [5000, 80, "low"], [5004, 80, "low"],
    [5996, 80, "low"], [6000, 80, "medium"], [6004, 80, "medium"],
    [8496, 80, "medium"], [8500, 80, "high"], [8504, 80, "high"]
  ] as const) {
    test(`compares unrounded coverage ${observed}/10000`, () => {
      const input: ScoreAssessment = { score: 80, confidence: "high", applicability: "applicable", coverage: { observed, expected: 10000, ratio: observed / 10000 } };
      expect(aggregateScoreAssessments([input])).toMatchObject({ score, confidence, coverage: { ratio: observed / 10000 } });
    });
  }

  for (const field of ["sourceFileCount", "medianSourceFileBytes", "p90SourceFileBytes", "oversizedSourceFileCount"] as const) {
    for (const value of [NaN, Infinity, -1]) {
      test(`does not reward a single invalid shape field ${field}=${value}`, () => {
        const report = scoreRepository({ ...base, codebaseShape: { ...base.codebaseShape, [field]: value } }, { now });
        const criterion = report.dimensions.maintainability.assessment.criteria.find(item => item.criterionId === "maintainability.compact-shape");
        expect(criterion).toMatchObject({ observed: null, pointsAwarded: 0 });
      });
    }
  }
  for (const [field, values, expected] of [
    ["sourceFileCount", [3, 4, 5], [false, true, true]],
    ["medianSourceFileBytes", [7999, 8000, 8001], [true, true, false]],
    ["p90SourceFileBytes", [31999, 32000, 32001], [true, true, false]],
    ["oversizedSourceFileCount", [0, 1, 2], [true, true, false]]
  ] as const) {
    test(`compact source boundary for ${field}`, () => {
      values.forEach((value, index) => {
        const report = scoreRepository({ ...base, codebaseShape: { ...base.codebaseShape, sourceFileCount: 10, medianSourceFileBytes: 1000, p90SourceFileBytes: 10000, oversizedSourceFileCount: 0, [field]: value } }, { now });
        expect(report.dimensions.maintainability.assessment.criteria.find(item => item.criterionId === "maintainability.compact-shape")?.observed).toBe(expected[index]);
      });
    });
  }

  test("rejects inconsistent collection counts in JSON and direct callers", () => {
    for (const attempted of [0, 2, 100, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      const input = { username: "probe", repositories: [base], repositoryCollectionAttemptCount: attempted };
      expect(() => parseProfileInput(input)).toThrow("repositoryCollectionAttemptCount");
      expect(() => scoreUserProfile(input, { now })).toThrow("repositoryCollectionAttemptCount");
    }
  });

  test("validates test counts independently and compares their unrounded ratio", () => {
    for (const [sourceFileCount, testFileCount, testToSourceRatio, observed] of [
      [100, 1, 0.01, false], [100, 2, 0.02, true],
      [13, 1, 0.077, false], [12, 1, 0.083, true],
      [25, 2, 0.08, true], [100, 1, 0.8, null],
      [100, NaN, 0.1, null], [100, 1, NaN, null], [0, 1, 0, null]
    ] as const) {
      const report = scoreRepository({ ...base, codebaseShape: { ...base.codebaseShape, sourceFileCount, testFileCount, testToSourceRatio } }, { now });
      expect(report.dimensions.maintainability.assessment.criteria.find(item => item.criterionId === "maintainability.test-surface")?.observed).toBe(observed);
    }
  });

  test("rejects impossible file size summaries and unknown example counts", () => {
    for (const change of [{ medianSourceFileBytes: 10000, p90SourceFileBytes: 1000 }, { oversizedSourceFileCount: base.codebaseShape.sourceFileCount + 1 }]) {
      const report = scoreRepository({ ...base, codebaseShape: { ...base.codebaseShape, ...change } }, { now });
      expect(report.dimensions.maintainability.assessment.criteria.find(item => item.criterionId === "maintainability.compact-shape")?.observed).toBeNull();
    }
    const report = scoreRepository({ ...base, codebaseShape: { ...base.codebaseShape, exampleFileCount: NaN } }, { now });
    expect(report.dimensions.maintainability.assessment.criteria.find(item => item.criterionId === "maintainability.examples")?.observed).toBeNull();
  });

  test("counts failed and truncated repositories together at the unavailable boundary", () => {
    const input = { username: "probe", repositories: [{ ...base, name: "complete" }, { ...base, name: "truncated", codebaseShape: { ...base.codebaseShape, treeTruncated: true } }, { ...base, name: "complete-2" }], repositoryCollectionFailureCount: 1, repositoryCollectionAttemptCount: 4 };
    const report = scoreUserProfile(input, { now });
    expect(report.selection.checkedRatio).toBe(0.5);
    expect(report.evidenceStatus).toBe("insufficient");
  });

  for (const failed of [49, 50, 51]) {
    test(`collection availability with ${failed}% unavailable`, () => {
      const repositories = Array.from({ length: 100 - failed }, (_, index) => ({ ...base, name: `repo-${index}` }));
      const report = scoreUserProfile({ username: "probe", repositories, repositoryCollectionAttemptCount: 100, repositoryCollectionFailureCount: failed }, { now });
      expect(report.evidenceStatus).toBe(failed >= 50 ? "insufficient" : "partial");
    });
  }

  test("selects gap repositories by owner and name", () => {
    const input: ProfileInput = { username: "probe", repositories: [{ ...base, owner: "alice", name: "same", hasCi: false }, { ...base, owner: "bob", name: "same", hasCi: false }] };
    for (const repositories of [input.repositories, [...input.repositories].reverse()]) {
      const gaps = analyzeSignalGaps({ ...input, repositories }, { now, maxRepositories: 1 });
      expect(gaps.gaps.filter(item => item.dimension === "maintainability")).toHaveLength(1);
    }
  });
});
