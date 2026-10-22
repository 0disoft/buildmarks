import { describe, expect, test } from "bun:test";
import { collectPublicGitHubProfile, collectOwnerSuppliedGitHubProfile, defaultGitHubCollectorPolicy,
  normalizePublicGitHubProfile, createStaticReport, renderStaticReportHtml } from "../src";
import { parseProfileInput } from "../src/cli/profile-input";

const now = new Date("2026-10-23T00:00:00Z");

function collection(count: number, budget: number, concurrency = 3, privateLocal = false) {
  const repositories = Array.from({ length: count }, (_, index) => ({
    name: `repo-${index}`, owner: { login: "probe" }, private: privateLocal, fork: false, archived: false,
    stargazers_count: 0, forks_count: 0, created_at: "2025-01-01T00:00:00Z",
    pushed_at: now.toISOString(), default_branch: "main", html_url: `https://github.com/probe/repo-${index}`
  }));
  const paths: string[] = [];
  const options = {
    now, token: "mock", policy: {
      ...defaultGitHubCollectorPolicy, publicOnly: !privateLocal, allowPrivateRepositories: privateLocal,
      limits: { ...defaultGitHubCollectorPolicy.limits, maxRepositoriesScannedPerProfile: count,
        maxRepositoriesScoredPerProfile: Math.min(count, 12), maxApiRequestsPerProfile: budget,
        maxConcurrentRepositoryCollections: concurrency }
    },
    fetcher: async (url: string) => {
      const path = new URL(url).pathname;
      paths.push(path);
      if (path === "/user") return Response.json({ login: "probe" });
      if (path.endsWith("/repos")) return Response.json(repositories);
      if (path.endsWith("/community/profile")) return Response.json({ files: {} });
      if (path.endsWith("/readme")) return new Response("Usage: example");
      if (path.includes("/git/trees/")) return Response.json({ tree: [
        { path: "package.json", type: "blob", size: 100 },
        { path: "index.ts", type: "blob", size: 100 }
      ] });
      return Response.json([]);
    }
  };
  return { paths, result: privateLocal
    ? collectOwnerSuppliedGitHubProfile("probe", options)
    : collectPublicGitHubProfile("probe", options) };
}

describe("request budget partial collection", () => {
  test("can collect 100 repositories within the supported request ceiling", async () => {
    const { result, paths } = collection(100, 600);
    const profile = await result;
    expect(profile.repositories).toHaveLength(100);
    expect(profile.repositoryCollectionFailureCount).toBeUndefined();
    expect(paths).toHaveLength(502);
  });

  test("preserves completed results at the former 500-request boundary", async () => {
    const { result, paths } = collection(100, 500);
    const profile = await result;
    expect(paths).toHaveLength(500);
    expect(profile.repositories).toHaveLength(99);
    expect(profile.repositoryCollectionAttemptCount).toBe(100);
    expect(profile.repositoryCollectionFailureCount).toBe(1);
    const report = createStaticReport(normalizePublicGitHubProfile(profile), { now });
    expect(report.profile.evidenceStatus).toBe("partial");
    expect(report.profile.selection).toMatchObject({ attemptedCount: 100, evaluatedCount: 99, missedCount: 1 });
    expect(renderStaticReportHtml(report)).toContain("request budget was exhausted");
  });

  test("stops new work and counts never-started repositories in coverage", async () => {
    const { result, paths } = collection(20, 12, 1);
    const profile = await result;
    expect(paths).toHaveLength(12);
    expect(paths.some(path => path.includes("/repo-3/"))).toBe(false);
    expect(profile.repositories).toHaveLength(2);
    expect(profile.repositoryCollectionFailureCount).toBe(18);
    expect(profile.repositoryCollectionSkippedCount).toBe(17);
    expect(profile.repositoryCollectionFailures!.reduce((sum, failure) => sum + failure.count, 0)).toBe(18);
    const input = normalizePublicGitHubProfile(profile);
    const report = createStaticReport(parseProfileInput(input), { now });
    expect(report.profile.selection).toMatchObject({ attemptedCount: 20, evaluatedCount: 2, missedCount: 18, skippedCount: 17 });
    expect(report.profile.evidenceStatus).toBe("insufficient");
    expect(renderStaticReportHtml(report)).toContain("17 selected repositories were not started");
    expect(() => parseProfileInput({ ...input, repositoryCollectionSkippedCount: 19 })).toThrow("must not exceed");
  });

  test("still fails when no repository could be completed", async () => {
    const { result, paths } = collection(4, 2, 1);
    await expect(result).rejects.toMatchObject({ code: "github_request_budget_exhausted" });
    expect(paths).toHaveLength(2);
  });

  test("keeps private-local partial output redacted", async () => {
    const { result } = collection(4, 11, 1, true);
    const profile = await result;
    expect(profile.repositories).toHaveLength(2);
    expect(profile.repositoryCollectionSkippedCount).toBe(1);
    expect(JSON.stringify(profile)).not.toContain("repo-");
    expect(profile.signalVisibility?.reportVisibility).toBe("private-local");
  });
});
