import { describe, expect, test } from "bun:test";
import fixture from "../fixtures/collected-public-profile.json";
import { collectOwnerSuppliedGitHubProfile, collectPublicGitHubProfile, normalizePublicGitHubProfile, scoreUserProfile } from "../src";
import { readTotalOwnedRepositoryCount } from "../src/collector/repository-total";
import { parseProfileInput } from "../src/cli/profile-input";

describe("account repository total", () => {
  test("adds only owned public and private repos, including when private count is zero", () => {
    expect(readTotalOwnedRepositoryCount({ login: "PROBE", public_repos: 38, owned_private_repos: 100, total_private_repos: 200 }, "probe")).toBe(138);
    expect(readTotalOwnedRepositoryCount({ login: "probe", public_repos: 38, owned_private_repos: 0 }, "probe")).toBe(38);
  });

  test("does not guess missing, invalid or another owner's private count", () => {
    for (const user of [null, {}, { login: "probe", public_repos: 38 },
      { login: "other", public_repos: 38, owned_private_repos: 100 },
      { login: "probe", public_repos: 38, owned_private_repos: -1 },
      { login: "probe", public_repos: 38, owned_private_repos: "100" },
      { login: "probe", public_repos: Number.MAX_SAFE_INTEGER, owned_private_repos: 1 }]) {
      expect(readTotalOwnedRepositoryCount(user, "probe")).toBeUndefined();
    }
  });

  test("collects totals in public-only mode without reading private repositories", async () => {
    const paths: string[] = [];
    const profile = await collectPublicGitHubProfile("probe", { token: "mock", fetcher: async (url) => {
      const path = new URL(url).pathname;
      paths.push(path);
      return Response.json(path === "/user" ? { login: "probe", public_repos: 38, owned_private_repos: 100 } : []);
    } });
    expect(profile.totalOwnedRepositoryCount).toBe(138);
    expect(profile.signalVisibility?.privateRepositoriesIncluded).toBe(false);
    expect(paths).toEqual(["/users/probe/repos", "/user"]);
  });

  test("reuses the owner identity response in private-local mode", async () => {
    const paths: string[] = [];
    const profile = await collectOwnerSuppliedGitHubProfile("probe", { token: "mock", fetcher: async (url) => {
      const path = new URL(url).pathname;
      paths.push(path);
      return Response.json(path === "/user" ? { login: "probe", public_repos: 38, owned_private_repos: 100 } : []);
    } });
    expect(profile.totalOwnedRepositoryCount).toBe(138);
    expect(paths).toEqual(["/user", "/user/repos"]);
  });

  test("optional metadata failure preserves collection and anonymous calls skip it", async () => {
    for (const token of [undefined, "mock"]) {
      const paths: string[] = [];
      const profile = await collectPublicGitHubProfile("probe", { ...(token ? { token } : {}), fetcher: async (url) => {
        const path = new URL(url).pathname;
        paths.push(path);
        return path === "/user" ? new Response("Forbidden", { status: 403 }) : Response.json([]);
      } });
      expect(profile.totalOwnedRepositoryCount).toBeUndefined();
      expect(profile.repositories).toEqual([]);
      expect(paths).toHaveLength(token ? 2 : 1);
    }
  });

  test("retains the total through normalization, JSON input and scoring without changing scores", () => {
    const original = normalizePublicGitHubProfile(fixture);
    const input = parseProfileInput(normalizePublicGitHubProfile({ ...fixture, totalOwnedRepositoryCount: 138 }));
    const report = scoreUserProfile(input);
    expect(report.totalOwnedRepositoryCount).toBe(138);
    expect(report.dimensions).toEqual(scoreUserProfile(original).dimensions);
    expect(report.overall).toBe(scoreUserProfile(original).overall);
    for (const totalOwnedRepositoryCount of [-1, 1.5, "138", Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => parseProfileInput({ ...original, totalOwnedRepositoryCount })).toThrow();
    }
  });
});
