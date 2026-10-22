import { describe, expect, test } from "bun:test";
import fixture from "../fixtures/example-public-profile.json";
import {
  analyzeSignalGaps, collectOwnerSuppliedGitHubProfile, collectPublicGitHubProfile,
  createStaticReport, defaultGitHubCollectorPolicy, scoreUserProfile, type ProfileInput
} from "../src";
import { parseProfileInput } from "../src/cli/profile-input";

const now = new Date("2026-05-28T00:00:00Z");
const strong = { ...fixture.repositories[0]!, name: "strong" };
const weak = { ...strong, name: "weak", hasCi: false, hasTests: false, hasReadme: false, hasUsageGuide: false, hasLicense: false, hasReleases: false };

describe("repository identity boundaries", () => {
  test("duplicate input cannot multiply score, evidence, selection or gaps", () => {
    const input: ProfileInput = { username: "probe", repositories: [strong, weak] };
    const duplicate: ProfileInput = { ...input, repositories: [strong, { ...strong, name: "STRONG" }, weak, strong] };
    const before = JSON.stringify(duplicate);
    expect(scoreUserProfile(duplicate, { now })).toEqual(scoreUserProfile(input, { now }));
    expect(analyzeSignalGaps(duplicate, { now })).toEqual(analyzeSignalGaps(input, { now }));
    expect(createStaticReport(duplicate, { now, maxRepositories: 1 })).toEqual(createStaticReport(input, { now, maxRepositories: 1 }));
    expect(parseProfileInput(duplicate).repositories).toEqual(input.repositories);
    expect(JSON.stringify(duplicate)).toBe(before);
  });

  test("equality ignores object property order and treats owner/name case-insensitively", () => {
    const reordered = Object.fromEntries(Object.entries({ ...strong, owner: strong.owner.toUpperCase(), name: "STRONG" }).reverse());
    const parsed = parseProfileInput({ username: "probe", repositories: [strong, reordered] });
    expect(parsed.repositories).toHaveLength(1);
    expect(parsed.repositories[0]?.name).toBe("strong");
  });

  test("the same repository name under different owners is distinct", () => {
    const report = scoreUserProfile({ username: "probe", repositories: [{ ...strong, owner: "alice" }, { ...strong, owner: "bob" }] }, { now });
    expect(report.selection.evaluatedCount).toBe(2);
  });

  test("conflicting duplicates are rejected by every input and assessment boundary", () => {
    const input: ProfileInput = { username: "probe", repositories: [strong, { ...strong, hasTests: !strong.hasTests }] };
    for (const run of [
      () => parseProfileInput(input), () => scoreUserProfile(input, { now }),
      () => analyzeSignalGaps(input, { now }), () => createStaticReport(input, { now })
    ]) expect(run).toThrow("Conflicting records");
  });

  test("explicit attempt counts cannot conceal duplicate inflation", () => {
    const input = { username: "probe", repositories: [strong, strong], repositoryCollectionAttemptCount: 2 };
    expect(() => parseProfileInput(input)).toThrow("repositoryCollectionAttemptCount");
    expect(() => scoreUserProfile(input, { now })).toThrow("repositoryCollectionAttemptCount");
    expect(scoreUserProfile({ ...input, repositoryCollectionAttemptCount: 1 }, { now }).selection.attemptedCount).toBe(1);
  });

  for (const [collect, firstPageSize] of [[collectPublicGitHubProfile, 2], [collectOwnerSuppliedGitHubProfile, 100]] as const) {
    test(`${collect.name} scans for unique repositories and fetches each only once`, async () => {
      let pages = 0, details = 0;
      const repository = (name: string) => ({ owner: { login: "probe" }, name, private: false, fork: false, archived: false, stargazers_count: 0, forks_count: 0, pushed_at: now.toISOString(), default_branch: "main" });
      const json = (value: unknown) => new Response(JSON.stringify(value));
      const profile = await collect("probe", {
        now, token: "test", policy: { ...defaultGitHubCollectorPolicy,
          ...(collect === collectOwnerSuppliedGitHubProfile ? { publicOnly: false, allowPrivateRepositories: true } : {}),
          limits: { ...defaultGitHubCollectorPolicy.limits, maxRepositoriesScannedPerProfile: 2, maxRepositoriesScoredPerProfile: 1 } },
        fetcher: async url => {
          const path = new URL(url).pathname;
          if (path === "/user") return json({ login: "probe" });
          if (path.endsWith("/repos")) return json(++pages === 1 ? Array.from({ length: firstPageSize }, () => repository("one")) : [repository("two")]);
          details++;
          if (path.includes("/git/trees/")) return json({ tree: [], truncated: false });
          if (path.endsWith("/community/profile")) return json({ files: {} });
          if (path.endsWith("/readme")) return new Response("Usage");
          return json([]);
        }
      });
      expect(pages).toBe(2); expect(details).toBe(10);
      expect(profile.repositories.map(repository => repository.name)).toEqual(["one", "two"]);
      expect(profile.repositoryCollectionAttemptCount).toBe(2);
    });
  }

  test("conflicting list records fail before any repository detail fetch", async () => {
    let details = 0;
    const base = { owner: { login: "probe" }, name: "secret-name", private: false, fork: false, archived: false, stargazers_count: 0, forks_count: 0, default_branch: "main" };
    const operation = collectPublicGitHubProfile("probe", { fetcher: async url => {
      if (new URL(url).pathname.startsWith("/users/")) return new Response(JSON.stringify([base, { ...base, stargazers_count: 1 }]));
      details++; throw new Error("No detail request expected");
    } });
    const failure = await operation.catch(error => error);
    expect(failure.code).toBe("invalid_github_response");
    expect(failure.message).not.toContain("secret-name"); expect(details).toBe(0);
  });
});
