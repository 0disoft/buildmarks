import { describe, expect, test } from "bun:test";
import {
  collectPublicGitHubProfile,
  defaultGitHubCollectorPolicy,
  type GitHubCollectorFetch,
  type GitHubCollectorPolicy
} from "../src";

const recentPushedAt = new Date().toISOString();

describe("live public GitHub collector", () => {
  test("collects public repository metadata into the normalized collector contract", async () => {
    const fetcher = makeGitHubFetch();

    const profile = await collectPublicGitHubProfile("example-builder", { fetcher });
    const repository = profile.repositories[0];

    expect(profile.username).toBe("example-builder");
    expect(profile.repositories).toHaveLength(1);
    expect(repository).toMatchObject({
      owner: "example-builder",
      name: "usable-toolkit",
      url: "https://github.com/example-builder/usable-toolkit",
      isFork: false,
      isArchived: false,
      stars: 42,
      forks: 7,
      createdAt: "2025-01-01T00:00:00Z",
      pushedAt: recentPushedAt,
      hasReleasesOrTags: true
    });
  });

  test("maps community profile and content checks into file signals", async () => {
    const profile = await collectPublicGitHubProfile("example-builder", { fetcher: makeGitHubFetch() });
    const signals = profile.repositories[0]?.files;

    expect(signals).toEqual({
      hasReadme: true,
      hasLicense: true,
      hasUsageGuide: true,
      hasCi: true,
      hasTests: false,
      hasChangelog: true,
      hasContributing: true,
      hasCodeOfConduct: true,
      hasSecurityPolicy: true,
      hasDemoOrDocs: true,
      hasPackageArtifact: true,
      codebaseShape: {
        sourceFileCount: 0,
        testFileCount: 0,
        exampleFileCount: 0,
        medianSourceFileBytes: 0,
        p90SourceFileBytes: 0,
        oversizedSourceFileCount: 0,
        testToSourceRatio: 0
      }
    });
  });

  test("summarizes repository tree shape without reading file contents or lines", async () => {
    const profile = await collectPublicGitHubProfile("example-builder", {
      fetcher: makeGitHubFetch({
        tree: [
          { path: "src/index.ts", type: "blob", size: 2400 },
          { path: "src/render.ts", type: "blob", size: 6200 },
          { path: "src/large.ts", type: "blob", size: 40_000 },
          { path: "tests/render.test.ts", type: "blob", size: 4200 },
          { path: "examples/basic.ts", type: "blob", size: 900 },
          { path: "dist/generated.js", type: "blob", size: 1000 },
          { path: "package-lock.json", type: "blob", size: 120_000 }
        ]
      })
    });

    expect(profile.repositories[0]?.files.codebaseShape).toEqual({
      sourceFileCount: 5,
      testFileCount: 1,
      exampleFileCount: 1,
      medianSourceFileBytes: 4200,
      p90SourceFileBytes: 40_000,
      oversizedSourceFileCount: 1,
      testToSourceRatio: 0.2
    });
  });

  test("uses one recursive tree request for repository file signals instead of content path probing", async () => {
    const calls: string[] = [];
    await collectPublicGitHubProfile("example-builder", {
      fetcher: makeGitHubFetch({
        onRequest: (url) => calls.push(url)
      })
    });

    expect(calls.some((url) => url.includes("/git/trees/main?recursive=1"))).toBe(true);
    expect(calls.some((url) => url.includes("/contents/"))).toBe(false);
  });

  test("limits scanned repositories before per-repository collection", async () => {
    const calls: string[] = [];
    const fetcher = makeGitHubFetch({
      repositories: [
        makeRepositoryResponse("first"),
        makeRepositoryResponse("second"),
        makeRepositoryResponse("third")
      ],
      onRequest: (url) => calls.push(url)
    });

    const policy: GitHubCollectorPolicy = {
      ...defaultGitHubCollectorPolicy,
      limits: {
        maxRepositoriesScannedPerProfile: 2,
        maxRepositoriesScoredPerProfile: 2,
        repositoryActivityWindowDays: 365
      }
    };

    const profile = await collectPublicGitHubProfile("example-builder", { fetcher, policy });

    expect(profile.repositories.map((repository) => repository.name)).toEqual(["first", "second"]);
    expect(calls.some((url) => url.includes("/repos/example-builder/third/"))).toBe(false);
  });

  test("skips repositories outside the activity window before per-repository collection", async () => {
    const calls: string[] = [];
    const fetcher = makeGitHubFetch({
      repositories: [
        makeRepositoryResponse("recent"),
        makeRepositoryResponse("old", { pushedAt: "2024-01-01T00:00:00Z" })
      ],
      onRequest: (url) => calls.push(url)
    });
    const policy: GitHubCollectorPolicy = {
      ...defaultGitHubCollectorPolicy,
      limits: {
        maxRepositoriesScannedPerProfile: 30,
        maxRepositoriesScoredPerProfile: 8,
        repositoryActivityWindowDays: 180
      }
    };

    const profile = await collectPublicGitHubProfile("example-builder", { fetcher, policy });

    expect(profile.activityWindowDays).toBe(180);
    expect(profile.repositories.map((repository) => repository.name)).toEqual(["recent"]);
    expect(calls.some((url) => url.includes("/repos/example-builder/old/"))).toBe(false);
  });

  test("treats missing optional content paths as absent instead of failing collection", async () => {
    const profile = await collectPublicGitHubProfile("example-builder", { fetcher: makeGitHubFetch() });

    expect(profile.repositories[0]?.files.hasTests).toBe(false);
  });

  test("rejects invalid policy before any GitHub request is made", async () => {
    let requestCount = 0;
    const policy: GitHubCollectorPolicy = {
      ...defaultGitHubCollectorPolicy,
      publicOnly: false
    };

    await expect(
      collectPublicGitHubProfile("example-builder", {
        policy,
        fetcher: async () => {
          requestCount += 1;
          return jsonResponse({});
        }
      })
    ).rejects.toMatchObject({
      code: "invalid_policy"
    });
    expect(requestCount).toBe(0);
  });

  test("reports GitHub rate limits as explicit collector errors", async () => {
    const fetcher: GitHubCollectorFetch = async () =>
      jsonResponse(
        { message: "API rate limit exceeded" },
        {
          status: 403,
          headers: { "x-ratelimit-reset": "1770000000" }
        }
      );

    await expect(collectPublicGitHubProfile("example-builder", { fetcher })).rejects.toMatchObject({
      code: "github_rate_limited",
      status: 403,
      rateLimitReset: "1770000000"
    });
  });

  test("uses an explicitly provided token without reading ambient credentials", async () => {
    const authorizations: Array<string | undefined> = [];
    const fetcher = makeGitHubFetch({
      onRequest: (_url, init) => {
        const headers = init.headers as Record<string, string>;
        authorizations.push(headers.Authorization);
      }
    });

    await collectPublicGitHubProfile("example-builder", {
      fetcher,
      token: "public-data-token"
    });

    expect(authorizations.every((value) => value === "Bearer public-data-token")).toBe(true);
  });

  test("does not emit prohibited vanity or private-data fields", async () => {
    const profile = await collectPublicGitHubProfile("example-builder", { fetcher: makeGitHubFetch() });
    const serialized = JSON.stringify(profile);

    expect(serialized).not.toContain("followers");
    expect(serialized).not.toContain("language");
    expect(serialized).not.toContain("rawCommitCount");
    expect(serialized).not.toContain("contributionStreak");
    expect(serialized).not.toContain("private");
  });
});

function makeGitHubFetch(options: MakeGitHubFetchOptions = {}): GitHubCollectorFetch {
  const repositories = options.repositories ?? [makeRepositoryResponse("usable-toolkit")];

  return async (url, init) => {
    options.onRequest?.(url, init);
    const parsed = new URL(url);

    expect(init.headers).toMatchObject({
      Accept: expect.any(String),
      "X-GitHub-Api-Version": "2026-03-10"
    });

    if (parsed.pathname === "/users/example-builder/repos") {
      return jsonResponse(repositories);
    }

    if (parsed.pathname.endsWith("/community/profile")) {
      return jsonResponse({
        documentation: { html_url: "https://docs.example.test" },
        files: {
          code_of_conduct_file: {},
          contributing: {},
          license: {},
          readme: {}
        }
      });
    }

    if (parsed.pathname.endsWith("/readme")) {
      return textResponse("Install the package and see usage examples.");
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
          ...(options.tree ?? [
            { path: ".github/workflows/ci.yml" },
            { path: "CHANGELOG.md" },
            { path: "SECURITY.md" },
            { path: "docs/index.md" },
            { path: "package.json" }
          ])
        ],
        truncated: false
      });
    }

    return jsonResponse({ message: "Not found" }, { status: 404 });
  };
}

function makeRepositoryResponse(name: string, options: { pushedAt?: string } = {}) {
  return {
    owner: { login: "example-builder" },
    name,
    html_url: `https://github.com/example-builder/${name}`,
    fork: false,
    archived: false,
    stargazers_count: 42,
    forks_count: 7,
    created_at: "2025-01-01T00:00:00Z",
    pushed_at: options.pushedAt ?? recentPushedAt,
    homepage: "",
    default_branch: "main"
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

function textResponse(body: string): Response {
  return new Response(body, {
    headers: {
      "content-type": "text/plain"
    }
  });
}

interface MakeGitHubFetchOptions {
  repositories?: unknown[];
  tree?: Array<{ path: string; type?: string; size?: number }>;
  onRequest?: (url: string, init: RequestInit) => void;
}
