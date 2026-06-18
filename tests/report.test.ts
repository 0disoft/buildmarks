import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "bun:test";
import fixture from "../fixtures/example-public-profile.json";
import { createStaticReport, renderStaticReportHtml } from "../src";
import { renderGitHubArtifacts } from "../src/cli/render-github-artifacts";
import { renderGitHubReportFiles } from "../src/cli/render-github-report";
import { renderReportFiles } from "../src/cli/render-report";
import type { GitHubCollectorFetch, ProfileInput } from "../src";

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("static report", () => {
  test("creates an inspectable JSON report from a profile fixture", () => {
    const report = createStaticReport(fixture as ProfileInput);

    expect(report.version).toBe(1);
    expect(report.profile.username).toBe("example-builder");
    expect(report.profile.evidence.length).toBeGreaterThan(0);
    expect(report.gaps.gaps.length).toBeGreaterThan(0);
    expect(report.repositories.length).toBeGreaterThan(0);
  });

  test("uses the repository summary limit for profile and repository report sections", () => {
    const report = createStaticReport(fixture as ProfileInput, { maxRepositories: 1 });

    expect(report.profile.topRepos).toHaveLength(1);
    expect(report.repositories).toHaveLength(1);
    expect(report.profile.topRepos[0]?.name).toBe("usable-toolkit");
    expect(report.repositories[0]?.name).toBe("usable-toolkit");
  });

  test("uses the same generated timestamp for profile and gap reports", () => {
    const report = createStaticReport(fixture as ProfileInput, {
      now: new Date("2026-05-28T00:00:00.000Z")
    });

    expect(report.profile.generatedAt).toBe("2026-05-28T00:00:00.000Z");
    expect(report.gaps.generatedAt).toBe("2026-05-28T00:00:00.000Z");
  });

  test("renders an HTML report without executable script content", () => {
    const report = createStaticReport(fixture as ProfileInput);
    const html = renderStaticReportHtml(report);

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Buildmarks static report");
    expect(html).toContain("Dimension Scores");
    expect(html).toContain("What's Missing");
    expect(html).toContain("Repository Signals");
    expect(html).toContain("Not a ranking");
    expect(html).not.toContain("<script");
  });

  test("labels private-local static reports as owner-supplied and not independently verifiable", () => {
    const report = createStaticReport({
      ...(fixture as ProfileInput),
      signalVisibility: {
        scope: "public-and-owner-supplied-private",
        privateRepositoriesIncluded: true,
        privateRepositoryNamesRedacted: true,
        independentlyVerifiable: false,
        cardLabel: "Public + Private Signals",
        reportVisibility: "private-local"
      }
    });
    const html = renderStaticReportHtml(report);

    expect(report.gaps.signalVisibility?.privateRepositoriesIncluded).toBe(true);
    expect(report.gaps.limitations).toContain(
      "Owner-supplied private repository signals are included and are not independently verifiable from public GitHub."
    );
    expect(html).toContain("Owner-supplied private signals included");
    expect(html).toContain("Not independently verifiable");
    expect(html).toContain("owner-supplied private-local and public signals");
    expect(html).not.toContain("<h3>Public Adoption</h3>");
    expect(html).not.toContain("<p><strong>N/A</strong></p>");
    expect(html).not.toContain("Public GitHub evidence only · Not a ranking");
  });

  test("writes HTML and JSON report files", async () => {
    const directory = await makeTempDirectory();
    const result = await renderReportFiles("fixtures/example-public-profile.json", directory);
    const html = await readFile(result.htmlPath, "utf8");
    const json = JSON.parse(await readFile(result.jsonPath, "utf8")) as { version: number };

    expect(result.ok).toBe(true);
    expect(html).toContain("Buildmarks static report");
    expect(json.version).toBe(1);
  });

  test("preserves repository collection failures through local JSON report rendering", async () => {
    const directory = await makeTempDirectory();
    const inputPath = join(directory, "profile-with-failures.json");
    await writeFile(inputPath, JSON.stringify({
      ...(fixture as ProfileInput),
      repositoryCollectionFailureCount: 2
    }), "utf8");

    const result = await renderReportFiles(inputPath, directory);
    const html = await readFile(result.htmlPath, "utf8");
    const json = JSON.parse(await readFile(result.jsonPath, "utf8")) as {
      profile: { limitations: string[] };
    };
    const limitation = "2 repositories could not be collected from GitHub and were omitted from this report.";

    expect(result.ok).toBe(true);
    expect(html).toContain(limitation);
    expect(json.profile.limitations).toContain(limitation);
  });

  test("writes HTML and JSON reports from public GitHub data", async () => {
    const directory = await makeTempDirectory();
    const result = await renderGitHubReportFiles("example-builder", directory, {
      fetcher: makeGitHubFetch()
    });
    const html = await readFile(result.htmlPath, "utf8");
    const json = JSON.parse(await readFile(result.jsonPath, "utf8")) as {
      version: number;
      profile: { username: string };
    };

    expect(result.ok).toBe(true);
    expect(html).toContain("Buildmarks static report");
    expect(html).toContain("example-builder");
    expect(html).toContain("rgba(15, 139, 108, 0.18)");
    expect(html).toContain("color-mix(in srgb, var(--accent), transparent 82%)");
    expect(html).toContain("Live GitHub issue, pull request, and external contributor aggregates are deferred");
    expect(json.version).toBe(1);
    expect(json.profile.username).toBe("example-builder");
  });

  test("writes private-local HTML and JSON reports from owner-supplied GitHub data", async () => {
    const directory = await makeTempDirectory();
    const result = await renderGitHubReportFiles("example-builder", directory, {
      fetcher: makeGitHubFetch([githubRepositoryResponse("private-toolkit", { private: true })]),
      privateLocal: true,
      token: "private-local-token"
    });
    const html = await readFile(result.htmlPath, "utf8");
    const json = JSON.parse(await readFile(result.jsonPath, "utf8")) as {
      profile: { signalVisibility?: { privateRepositoriesIncluded: boolean } };
      repositories: Array<{ name: string }>;
    };

    expect(result.ok).toBe(true);
    expect(html).toContain("Owner-supplied private signals included");
    expect(json.profile.signalVisibility?.privateRepositoriesIncluded).toBe(true);
    expect(json.repositories[0]?.name).toBe("Private repository 1");
    expect(JSON.stringify(json)).not.toContain("private-toolkit");
  });

  test("passes the GitHub policy repository summary limit into report generation", async () => {
    const directory = await makeTempDirectory();
    const result = await renderGitHubReportFiles("example-builder", directory, {
      fetcher: makeGitHubFetch([
        githubRepositoryResponse("usable-toolkit"),
        githubRepositoryResponse("second-toolkit")
      ]),
      policy: {
        publicOnly: true,
        allowPrivateRepositories: false,
        allowUnauthenticatedLocalDemo: true,
        requiredTokenScopes: [],
        cache: {
          profileReportTtlSeconds: 21_600,
          repositoryFileSignalsTtlSeconds: 86_400
        },
        limits: {
          maxRepositoriesScannedPerProfile: 2,
          maxRepositoriesScoredPerProfile: 1,
          repositoryActivityWindowDays: 365,
          maxConcurrentRepositoryCollections: 3
        }
      }
    });
    const json = JSON.parse(await readFile(result.jsonPath, "utf8")) as {
      profile: { topRepos: Array<{ name: string }> };
      repositories: Array<{ name: string }>;
    };

    expect(result.ok).toBe(true);
    expect(json.profile.topRepos).toHaveLength(1);
    expect(json.repositories).toHaveLength(1);
    expect(json.profile.topRepos[0]?.name).toBe("usable-toolkit");
  });

  test("writes SVG and static reports from one public GitHub collection", async () => {
    const directory = await makeTempDirectory();
    const baseFetch = makeGitHubFetch();
    let repositoryListRequests = 0;
    const fetcher: GitHubCollectorFetch = async (url, init) => {
      const parsed = new URL(url);
      if (parsed.pathname === "/users/example-builder/repos") {
        repositoryListRequests += 1;
      }
      return baseFetch(url, init);
    };

    const result = await renderGitHubArtifacts("example-builder", join(directory, "buildmarks.svg"), join(directory, "report"), {
      fetcher
    });
    const svg = await readFile(result.svgPath, "utf8");
    const html = await readFile(result.htmlPath, "utf8");
    const json = JSON.parse(await readFile(result.jsonPath, "utf8")) as {
      version: number;
      profile: { username: string };
    };

    expect(result.ok).toBe(true);
    expect(result.fallback).toBe(false);
    expect(repositoryListRequests).toBe(1);
    expect(svg).toContain("Buildmarks");
    expect(svg).toContain("<a href=\"./report/buildmarks-report.html\"");
    expect(svg).toContain("View report");
    expect(html).toContain("Buildmarks static report");
    expect(json.version).toBe(1);
    expect(json.profile.username).toBe("example-builder");
  });

  test("percent-encodes generated report links with reserved path characters", async () => {
    const directory = await makeTempDirectory();
    const result = await renderGitHubArtifacts(
      "example-builder",
      join(directory, "cards #1", "buildmarks.svg"),
      join(directory, "report #1"),
      {
        fetcher: makeGitHubFetch()
      }
    );
    const svg = await readFile(result.svgPath, "utf8");

    expect(result.ok).toBe(true);
    expect(svg).toContain("<a href=\"../report%20%231/buildmarks-report.html\"");
    expect(svg).not.toContain("<a href=\"../report #1/buildmarks-report.html\"");
  });

  test("writes fallback report files when public GitHub collection fails", async () => {
    const directory = await makeTempDirectory();
    const result = await renderGitHubReportFiles("example-builder", directory, {
      fetcher: async () => jsonResponse({ message: "rate limited" }, { status: 403 })
    });
    const html = await readFile(result.htmlPath, "utf8");
    const json = JSON.parse(await readFile(result.jsonPath, "utf8")) as { ok: boolean; error: string };

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
    expect(html).toContain("Buildmarks GitHub report unavailable");
    expect(html).toContain("No signal score is shown");
    expect(html).not.toContain("Public GitHub signals only");
    expect(json.ok).toBe(false);
    expect(json.error).toBeDefined();
  });

  test("writes scope-neutral fallback artifacts when private-local GitHub collection fails", async () => {
    const directory = await makeTempDirectory();
    const result = await renderGitHubArtifacts("example-builder", join(directory, "buildmarks.svg"), join(directory, "report"), {
      fetcher: async () => jsonResponse({ message: "bad credentials" }, { status: 401 }),
      privateLocal: true,
      token: "private-local-token"
    });
    const svg = await readFile(result.svgPath, "utf8");
    const html = await readFile(result.htmlPath, "utf8");

    expect(result.ok).toBe(false);
    expect(result.fallback).toBe(true);
    expect(svg).toContain("No signal score is shown");
    expect(html).toContain("No signal score is shown");
    expect(svg).not.toContain("Public GitHub signals only");
    expect(html).not.toContain("Public GitHub signals only");
  });
});

async function makeTempDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "buildmarks-report-"));
  tempDirectories.push(directory);
  return directory;
}

function makeGitHubFetch(repositories = [githubRepositoryResponse("usable-toolkit")]): GitHubCollectorFetch {
  return async (url) => {
    const parsed = new URL(url);

    if (parsed.pathname === "/user") {
      return jsonResponse({ login: "example-builder" });
    }

    if (parsed.pathname === "/users/example-builder/repos" || parsed.pathname === "/user/repos") {
      return jsonResponse(repositories);
    }

    if (parsed.pathname.endsWith("/community/profile")) {
      return jsonResponse({
        documentation: { html_url: "https://docs.example.test" },
        files: {
          license: {},
          readme: {}
        }
      });
    }

    if (parsed.pathname.endsWith("/readme")) {
      return new Response("Install and usage examples.", {
        headers: { "content-type": "text/plain" }
      });
    }

    if (parsed.pathname.endsWith("/releases")) {
      return jsonResponse([{ name: "v0.1.0" }]);
    }

    if (parsed.pathname.endsWith("/tags")) {
      return jsonResponse([]);
    }

    if (parsed.pathname.endsWith("/git/trees/main")) {
      return jsonResponse({
        tree: [
          { path: ".github/workflows/ci.yml" },
          { path: "tests/score.test.ts" },
          { path: "package.json" }
        ],
        truncated: false
      });
    }

    return jsonResponse({ message: "Not found" }, { status: 404 });
  };
}

function githubRepositoryResponse(name: string, options: { private?: boolean } = {}) {
  return {
    owner: { login: "example-builder" },
    name,
    html_url: `https://github.com/example-builder/${name}`,
    private: options.private ?? false,
    fork: false,
    archived: false,
    stargazers_count: 42,
    forks_count: 7,
    created_at: "2025-01-01T00:00:00Z",
    pushed_at: "2026-05-27T00:00:00Z",
    homepage: "",
    default_branch: "main"
  };
}

function jsonResponse(body: unknown, options: { status?: number; headers?: HeadersInit } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: options.status ?? 200,
    headers: {
      "content-type": "application/json",
      ...options.headers
    }
  });
}
