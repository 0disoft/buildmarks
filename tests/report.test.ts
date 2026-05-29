import { mkdtemp, readFile, rm } from "node:fs/promises";
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

  test("writes HTML and JSON report files", async () => {
    const directory = await makeTempDirectory();
    const result = await renderReportFiles("fixtures/example-public-profile.json", directory);
    const html = await readFile(result.htmlPath, "utf8");
    const json = JSON.parse(await readFile(result.jsonPath, "utf8")) as { version: number };

    expect(result.ok).toBe(true);
    expect(html).toContain("Buildmarks static report");
    expect(json.version).toBe(1);
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
    expect(json.version).toBe(1);
    expect(json.profile.username).toBe("example-builder");
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
    expect(svg).toContain("View evidence");
    expect(html).toContain("Buildmarks static report");
    expect(json.version).toBe(1);
    expect(json.profile.username).toBe("example-builder");
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
    expect(json.ok).toBe(false);
    expect(json.error).toBeDefined();
  });
});

async function makeTempDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "buildmarks-report-"));
  tempDirectories.push(directory);
  return directory;
}

function makeGitHubFetch(): GitHubCollectorFetch {
  return async (url) => {
    const parsed = new URL(url);

    if (parsed.pathname === "/users/example-builder/repos") {
      return jsonResponse([
        {
          owner: { login: "example-builder" },
          name: "usable-toolkit",
          html_url: "https://github.com/example-builder/usable-toolkit",
          fork: false,
          archived: false,
          stargazers_count: 42,
          forks_count: 7,
          created_at: "2025-01-01T00:00:00Z",
          pushed_at: "2026-05-27T00:00:00Z",
          homepage: "",
          default_branch: "main"
        }
      ]);
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

function jsonResponse(body: unknown, options: { status?: number; headers?: HeadersInit } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: options.status ?? 200,
    headers: {
      "content-type": "application/json",
      ...options.headers
    }
  });
}
