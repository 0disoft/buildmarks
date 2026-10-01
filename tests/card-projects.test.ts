import { describe, expect, test } from "bun:test";
import fixture from "../fixtures/example-public-profile.json";
import { privateLocalSignalVisibility, scoreUserProfile, type ProfileInput, type RepoSignal } from "../src";
import { selectCardProjects } from "../src/renderer/card-projects";

const report = scoreUserProfile(fixture as ProfileInput, { now: new Date("2026-05-28") });
const source = (() => {
  const repository = report.topRepos[0];
  if (repository === undefined) throw new Error("Fixture needs a scored repository.");
  return repository;
})();
function repository(name: string, ids: string[], kind: "library" | "documentation" = "library"): RepoSignal {
  return { ...source, name, owner: "example", repositoryKind: { kind, source: "declared", confidence: "high" },
    evidenceLedger: ids.map((criterionId) => ({ level: "positive", source: "file", label: "Localized text", criterionId })) };
}

describe("compact card project selection", () => {
  test("prefers type-relevant evidence instead of the highest overall score", () => {
    const documented = { ...repository("docs", ["usability.docs-usage", "completeness.license"]), overall: 99 };
    const maintained = { ...repository("tested", ["maintainability.tests-ci", "maintainability.release-notes"]), overall: 40 };
    expect(selectCardProjects([documented, maintained], "Maintainer-Builder")[0]?.name).toBe("example/tested");
    expect(selectCardProjects([documented, maintained], "Well-Documented Project")[0]?.name).toBe("example/docs");
  });
  test("prefers a different project kind second and keeps at most three facts", () => {
    const repos = [repository("a", ["maintainability.tests-ci", "maintainability.release-notes"]),
      repository("b", ["maintainability.tests-ci"]), repository("c", ["usability.docs-usage"], "documentation")];
    const selected = selectCardProjects(repos, "Maintainer-Builder");
    expect(selected.map((project) => project.name)).toEqual(["example/a", "example/c"]);
    expect(selected.flatMap((project) => project.facts)).toEqual(["Release + changelog", "Tests + workflow", "Usage + docs"]);
    expect(selectCardProjects([...repos].reverse(), "Maintainer-Builder")).toEqual(selected);
  });
  test("deduplicates repeated criteria, categories and repositories without mutating the report", () => {
    const repo = repository("a", ["maintainability.tests-ci", "maintainability.tests", "maintainability.tests-ci", "completeness.license"]);
    const before = JSON.stringify(repo);
    const selected = selectCardProjects([repo, repo], "Maintainer-Builder");
    expect(selected).toHaveLength(1);
    expect(selected[0]?.facts).toEqual(["Tests + workflow", "License found"]);
    expect(JSON.stringify(repo)).toBe(before);
  });
  test("does not invent facts from unknown IDs, negative evidence or unavailable assessments", () => {
    const unknown = repository("unknown", ["new.unknown"]);
    const negative = repository("negative", ["maintainability.tests-ci"]);
    negative.evidenceLedger = (negative.evidenceLedger ?? []).map((item) => ({ ...item, level: "negative" }));
    const unavailable = repository("unavailable", ["maintainability.tests-ci"]);
    if (unavailable.assessment === undefined) throw new Error("Fixture needs an assessment.");
    unavailable.assessment = { ...unavailable.assessment, score: null, applicability: "unavailable" };
    expect(selectCardProjects([unknown, negative, unavailable], "Builder")).toEqual([]);
    expect(selectCardProjects([], "Builder")).toEqual([]);
  });
  test("hides private identifiers even in owner-supplied reports", () => {
    const privateRepo = { ...repository("secret-product", ["maintainability.tests-ci"]), owner: "secret-owner", signalVisibility: privateLocalSignalVisibility };
    const selected = selectCardProjects([privateRepo], "Maintainer-Builder");
    expect(selected).toEqual([{ name: "Private project 1", private: true, facts: ["Tests + workflow"] }]);
    expect(JSON.stringify(selected)).not.toContain("secret");
  });
});
