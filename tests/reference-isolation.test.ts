import { describe, expect, spyOn, test } from "bun:test";
import {
  analyzeSignalGaps,
  collectPublicGitHubProfile,
  defaultGitHubCollectorPolicy,
  GitHubCollectorError,
  normalizePublicGitHubProfile,
  privateLocalGitHubCollectorPolicy,
  publicOnlySignalVisibility,
  scoreUserProfile,
  type CollectPublicGitHubProfileOptions,
  type GitHubCollectorFetch
} from "../src";
import { buildGitHubCollectorPolicyFromCli, githubCliDefaultLimits } from "../src/cli/options";

const now = new Date("2026-05-28T00:00:00Z");
const repository = {
  owner: { login: "probe" }, name: "one", private: false, fork: false, archived: false,
  stargazers_count: 0, forks_count: 0, created_at: "2025-01-01T00:00:00Z",
  pushed_at: now.toISOString(), homepage: null, default_branch: "main", html_url: null
};

const fakeGitHub: GitHubCollectorFetch = async url => {
  const path = new URL(url).pathname;
  if (path === "/users/probe/repos") return Response.json([repository]);
  if (path.endsWith("/community/profile")) return Response.json({ files: {} });
  if (path.endsWith("/readme")) return new Response("Usage: run example");
  if (path.includes("/git/trees/")) return Response.json({ tree: [{ path: "src/main.ts", type: "blob", size: 100 }] });
  return Response.json([]);
};

describe("collection ownership and reference isolation", () => {
  for (const code of ["github_rate_limited", "github_request_budget_exhausted"] as const) {
    for (const frozen of [false, true]) {
      test(`preserves ${frozen ? "frozen" : "mutable"} ${code} without tagging it`, async () => {
        const error = new GitHubCollectorError(code, "injected fatal failure");
        if (frozen) Object.freeze(error);
        await expect(collectPublicGitHubProfile("probe", {
          now,
          fetcher: async (url, init) => {
            if (url.endsWith("/community/profile")) throw error;
            return fakeGitHub(url, init);
          }
        })).rejects.toBe(error);
        expect(Object.getOwnPropertySymbols(error)).toEqual([]);
      });
    }
  }

  test("classifies a frozen parse error by operation without replacing it", async () => {
    const error = Object.freeze(new SyntaxError("injected invalid JSON"));
    const profile = await collectPublicGitHubProfile("probe", {
      now,
      fetcher: async (url, init) => {
        if (url.endsWith("/community/profile")) throw error;
        return fakeGitHub(url, init);
      }
    });
    expect(profile.repositoryCollectionFailures).toEqual([
      { code: "unknown_repository_collection_failure", operation: "community_profile", count: 1 }
    ]);
    expect(Object.getOwnPropertySymbols(error)).toEqual([]);
  });

  test("detaches normalized metrics and disclosure from collected data and report outputs", async () => {
    const collected = await collectPublicGitHubProfile("probe", { now, fetcher: fakeGitHub });
    const input = normalizePublicGitHubProfile(collected);
    const report = scoreUserProfile(input, { now });
    const gaps = analyzeSignalGaps(input, { now });
    expect(collected.signalVisibility).not.toBe(publicOnlySignalVisibility);
    expect(input.signalVisibility).not.toBe(collected.signalVisibility);
    expect(report.signalVisibility).not.toBe(input.signalVisibility);
    expect(gaps.signalVisibility).not.toBe(input.signalVisibility);
    input.repositories[0]!.codebaseShape!.sourceFileCount = 99;
    report.signalVisibility!.cardLabel = "changed report";
    gaps.signalVisibility!.cardLabel = "changed gaps";
    expect(collected.repositories[0]!.files.codebaseShape!.sourceFileCount).toBe(1);
    expect(input.signalVisibility!.cardLabel).toBe(publicOnlySignalVisibility.cardLabel);
    collected.signalVisibility!.cardLabel = "changed collection";
    expect(publicOnlySignalVisibility.cardLabel).toBe("Public GitHub projects");
  });

  test("gives each policy its own limits, cache and scopes", () => {
    expect(privateLocalGitHubCollectorPolicy.limits).not.toBe(defaultGitHubCollectorPolicy.limits);
    expect(privateLocalGitHubCollectorPolicy.cache).not.toBe(defaultGitHubCollectorPolicy.cache);
    expect(privateLocalGitHubCollectorPolicy.requiredTokenScopes).not.toBe(defaultGitHubCollectorPolicy.requiredTokenScopes);
    expect(githubCliDefaultLimits).not.toBe(defaultGitHubCollectorPolicy.limits);
    const options = { privateLocal: false, maxRepositoriesScanned: 30, maxRepositoriesScored: 12, activityWindowDays: 365, maxApiRequests: 160 };
    const first = buildGitHubCollectorPolicyFromCli(options);
    const second = buildGitHubCollectorPolicyFromCli(options);
    first.cache.profileReportTtlSeconds = 1;
    first.limits.maxApiRequestsPerProfile = 1;
    expect(second).toEqual(defaultGitHubCollectorPolicy);
    expect(first.requiredTokenScopes).not.toBe(second.requiredTokenScopes);
  });

  test("detaches its abort listener from the original signal even when caller options change", async () => {
    const first = new AbortController();
    const second = new AbortController();
    const remove = spyOn(first.signal, "removeEventListener");
    const options: CollectPublicGitHubProfileOptions = {
      now, signal: first.signal,
      fetcher: async (url, init) => {
        options.signal = second.signal;
        return fakeGitHub(url, init);
      }
    };
    try {
      await collectPublicGitHubProfile("probe", options);
      expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
    } finally { remove.mockRestore(); }
  });
});
