import { describe, expect, test } from "bun:test";
import fixture from "../fixtures/example-public-profile.json";
import { analyzeSignalGaps, createStaticReport, privateLocalSignalVisibility, scoreUserProfile, type ProfileInput } from "../src";
import { summarizeCodebaseShape } from "../src/collector/repository-tree-signals";

const now = new Date("2026-05-28T00:00:00Z");
const base = { ...fixture.repositories[0]!, hasCi: false, hasReadme: false };
const { url: _url, ...privateBase } = base;
const profiles: ProfileInput[] = [
  fixture as ProfileInput,
  { username: "probe", repositories: [
    { ...base, owner: "alice", name: "same", repositoryKind: "library" },
    { ...base, owner: "bob", name: "same", repositoryKind: "documentation", hasLicense: false },
    { ...base, owner: "alice", name: "SAME", repositoryKind: "cli", hasTests: false },
    { ...base, name: "incomplete", codebaseShape: { ...base.codebaseShape, treeTruncated: true } }
  ] },
  { username: "private-probe", signalVisibility: privateLocalSignalVisibility, repositories: [
    { ...privateBase, name: "Private repository 1", owner: "Private owner", visibility: "private", redactedName: true, stars: 0, forks: 0 },
    { ...base, name: "public" }
  ] },
  { username: "empty", repositories: [] }
];

describe("report computation reuse", () => {
  for (const [index, profile] of profiles.entries()) {
    for (const maxRepositories of [undefined, 1, 2, 10]) {
      test(`matches standalone gap selection for profile ${index}, limit ${maxRepositories}`, () => {
        const options = { now, ...(maxRepositories === undefined ? {} : { maxRepositories }) };
        const before = JSON.stringify(profile);
        const report = createStaticReport(profile, options);
        expect(report.profile).toEqual(scoreUserProfile(profile, options));
        expect(report.gaps).toEqual(analyzeSignalGaps(profile, options));
        expect(JSON.stringify(profile)).toBe(before);
      });
    }
  }

  test("does not run a second full assessment to select report gaps", () => {
    let reads = 0;
    const profile: ProfileInput = { username: "probe", repositories: Array.from({ length: 8 }, (_, index) => ({
      ...base, name: `repo-${index}`, get hasCi() { reads++; return false; }
    })) };
    scoreUserProfile(profile, { now, maxRepositories: 1 });
    const scoreReads = reads; reads = 0;
    createStaticReport(profile, { now, maxRepositories: 1 });
    expect(scoreReads).toBeGreaterThan(profile.repositories.length);
    expect(reads).toBeLessThanOrEqual(scoreReads + profile.repositories.length);
  });

  for (const sizes of [[], [5], [4, 1, 3, 2], [10, 0, 10, 5, 1]]) {
    test(`preserves exact percentile interpolation and tree order for ${sizes.length} files`, () => {
      const entries = Object.freeze(sizes.map((size, index) => Object.freeze({ path: `src/file${index}.ts`, type: "blob", size })));
      const sorted = [...sizes].sort((left, right) => left - right);
      const percentile = (p: number) => {
        if (sorted.length === 0) return 0;
        const rank = (sorted.length - 1) * p;
        const lower = sorted[Math.floor(rank)]!, upper = sorted[Math.ceil(rank)]!;
        return Math.round(lower + (upper - lower) * (rank - Math.floor(rank)));
      };
      const result = summarizeCodebaseShape(entries);
      expect(result.medianSourceFileBytes).toBe(percentile(0.5));
      expect(result.p90SourceFileBytes).toBe(percentile(0.9));
      expect(entries.map(entry => entry.size)).toEqual(sizes);
    });
  }
});
