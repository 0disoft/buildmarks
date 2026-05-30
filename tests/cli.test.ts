import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "bun:test";
import { renderCardFile } from "../src/cli/render-card";
import { renderGapsCardFile } from "../src/cli/render-gaps-card";
import { renderGitHubCardFile } from "../src/cli/render-github-card";
import { renderRepoCardFile } from "../src/cli/render-repo-card";
import type { GitHubCollectorFetch } from "../src";

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("render-card CLI", () => {
  test("renders a local profile fixture into an SVG file", async () => {
    const directory = await makeTempDirectory();
    const outputPath = join(directory, "cards", "example-card.svg");

    const result = await renderCardFile("fixtures/example-public-profile.json", outputPath);
    const svg = await readFile(outputPath, "utf8");

    expect(result.ok).toBe(true);
    expect(result.fallback).toBe(false);
    expect(svg).toContain("Buildmarks");
    expect(svg).toContain("example-builder");
    expect(svg).toContain("Buildmarks Profile · Public Signals");
    expect(svg).toContain("Signals Found");
    expect(svg).toContain("Found Signals");
    expect(svg).not.toContain("<text x=\"36\" y=\"390\" class=\"footer\">Not a ranking");
  });

  test("renders a local profile card with an inspectable report link", async () => {
    const directory = await makeTempDirectory();
    const outputPath = join(directory, "cards", "example-card.svg");

    const result = await renderCardFile("fixtures/example-public-profile.json", outputPath, {
      reportHref: "./report/buildmarks-report.html"
    });
    const svg = await readFile(outputPath, "utf8");

    expect(result.ok).toBe(true);
    expect(svg).toContain("<a href=\"./report/buildmarks-report.html\"");
    expect(svg).toContain("View report");
  });

  test("writes a fallback SVG when the input JSON is invalid", async () => {
    const directory = await makeTempDirectory();
    const inputPath = join(directory, "invalid-profile.json");
    const outputPath = join(directory, "fallback", "card.svg");
    await writeFile(inputPath, "{", "utf8");

    const result = await renderCardFile(inputPath, outputPath);
    const svg = await readFile(outputPath, "utf8");

    expect(result.ok).toBe(false);
    expect(result.fallback).toBe(true);
    expect(result.error).toBeDefined();
    expect(svg).toContain("Buildmarks report is temporarily unavailable");
    expect(svg).toContain("Public GitHub signals only");
  });

  test("writes a fallback SVG when the input shape is invalid", async () => {
    const directory = await makeTempDirectory();
    const inputPath = join(directory, "invalid-shape.json");
    const outputPath = join(directory, "fallback", "card.svg");
    await writeFile(inputPath, JSON.stringify({ username: "missing-repositories" }), "utf8");

    const result = await renderCardFile(inputPath, outputPath);
    const svg = await readFile(outputPath, "utf8");

    expect(result.ok).toBe(false);
    expect(result.fallback).toBe(true);
    expect(result.error).toContain("repositories array");
    expect(svg).toContain("Buildmarks report is temporarily unavailable");
  });
});

describe("render-github-card CLI", () => {
  test("collects public GitHub data and renders an SVG file", async () => {
    const directory = await makeTempDirectory();
    const outputPath = join(directory, "cards", "github-card.svg");

    const result = await renderGitHubCardFile("example-builder", outputPath, {
      fetcher: makeGitHubFetch()
    });
    const svg = await readFile(outputPath, "utf8");

    expect(result.ok).toBe(true);
    expect(result.fallback).toBe(false);
    expect(svg).toContain("Buildmarks");
    expect(svg).toContain("example-builder");
    expect(svg).toContain("Buildmarks Profile · Public Signals");
    expect(svg).toContain("Signals Found");
    expect(svg).not.toContain("<text x=\"36\" y=\"390\" class=\"footer\">Not a ranking");
  });

  test("renders a GitHub profile card with an inspectable report link", async () => {
    const directory = await makeTempDirectory();
    const outputPath = join(directory, "cards", "github-card.svg");

    const result = await renderGitHubCardFile("example-builder", outputPath, {
      fetcher: makeGitHubFetch(),
      reportHref: "./buildmarks-report/buildmarks-report.html"
    });
    const svg = await readFile(outputPath, "utf8");

    expect(result.ok).toBe(true);
    expect(svg).toContain("<a href=\"./buildmarks-report/buildmarks-report.html\"");
    expect(svg).toContain("View report");
  });

  test("writes a fallback SVG when GitHub collection fails", async () => {
    const directory = await makeTempDirectory();
    const outputPath = join(directory, "cards", "fallback-card.svg");

    const result = await renderGitHubCardFile("example-builder", outputPath, {
      fetcher: async () => jsonResponse({ message: "rate limited" }, { status: 403 })
    });
    const svg = await readFile(outputPath, "utf8");

    expect(result.ok).toBe(false);
    expect(result.fallback).toBe(true);
    expect(result.error).toBeDefined();
    expect(svg).toContain("Buildmarks GitHub report is temporarily unavailable");
    expect(svg).toContain("Public GitHub signals only");
  });
});

describe("render-gaps-card CLI", () => {
  test("renders a local profile fixture into a signal gaps SVG file", async () => {
    const directory = await makeTempDirectory();
    const outputPath = join(directory, "cards", "gaps-card.svg");

    const result = await renderGapsCardFile("fixtures/example-public-profile.json", outputPath);
    const svg = await readFile(outputPath, "utf8");

    expect(result.ok).toBe(true);
    expect(result.fallback).toBe(false);
    expect(svg).toContain("Buildmarks");
    expect(svg).toContain("What's Missing");
    expect(svg).toContain("Buildmarks Gaps · Public Signals");
    expect(svg).toContain("Missing public GitHub signals");
  });
});

describe("render-repo-card CLI", () => {
  test("renders a selected repository into a repository signal SVG file", async () => {
    const directory = await makeTempDirectory();
    const outputPath = join(directory, "cards", "repo-card.svg");

    const result = await renderRepoCardFile("fixtures/example-public-profile.json", "usable-toolkit", outputPath);
    const svg = await readFile(outputPath, "utf8");

    expect(result.ok).toBe(true);
    expect(result.fallback).toBe(false);
    expect(svg).toContain("Repository Signal Card");
    expect(svg).toContain("example-builder/usable-toolkit");
    expect(svg).toContain("Buildmarks Repo · Public Signals");
    expect(svg).toContain("Signals Found");
  });

  test("writes a fallback SVG when the requested repository is missing", async () => {
    const directory = await makeTempDirectory();
    const outputPath = join(directory, "cards", "missing-repo-card.svg");

    const result = await renderRepoCardFile("fixtures/example-public-profile.json", "missing-repo", outputPath);
    const svg = await readFile(outputPath, "utf8");

    expect(result.ok).toBe(false);
    expect(result.fallback).toBe(true);
    expect(result.error).toContain("missing-repo");
    expect(svg).toContain("Buildmarks repository signal report is temporarily unavailable");
  });
});

async function makeTempDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "buildmarks-"));
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

function jsonResponse(
  body: unknown,
  options: { status?: number; headers?: HeadersInit } = {}
): Response {
  return new Response(JSON.stringify(body), {
    status: options.status ?? 200,
    headers: {
      "content-type": "application/json",
      ...options.headers
    }
  });
}
