import { describe, expect, test } from "bun:test";
import {
  collectPublicGitHubProfile,
  defaultGitHubCollectorPolicy,
  type GitHubCollectorFetch,
  type GitHubCollectorPolicy
} from "../src";

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
      pushedAt: "2026-05-27T00:00:00Z",
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
      hasPackageArtifact: true
    });
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
        maxRepositoriesScoredPerProfile: 2
      }
    };

    const profile = await collectPublicGitHubProfile("example-builder", { fetcher, policy });

    expect(profile.repositories.map((repository) => repository.name)).toEqual(["first", "second"]);
    expect(calls.some((url) => url.includes("/repos/example-builder/third/"))).toBe(false);
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

    if (contentPath(parsed.pathname) === ".github/workflows") {
      return jsonResponse([{ name: "ci.yml", type: "file" }]);
    }

    if (contentPath(parsed.pathname) === "CHANGELOG.md") {
      return jsonResponse({ name: "CHANGELOG.md", type: "file" });
    }

    if (contentPath(parsed.pathname) === "SECURITY.md") {
      return jsonResponse({ name: "SECURITY.md", type: "file" });
    }

    if (contentPath(parsed.pathname) === "docs") {
      return jsonResponse([{ name: "index.md", type: "file" }]);
    }

    if (contentPath(parsed.pathname) === "package.json") {
      return jsonResponse({ name: "package.json", type: "file" });
    }

    return jsonResponse({ message: "Not found" }, { status: 404 });
  };
}

function makeRepositoryResponse(name: string) {
  return {
    owner: { login: "example-builder" },
    name,
    html_url: `https://github.com/example-builder/${name}`,
    fork: false,
    archived: false,
    stargazers_count: 42,
    forks_count: 7,
    created_at: "2025-01-01T00:00:00Z",
    pushed_at: "2026-05-27T00:00:00Z",
    homepage: ""
  };
}

function contentPath(pathname: string): string | null {
  const marker = "/contents/";
  const index = pathname.indexOf(marker);
  if (index === -1) {
    return null;
  }

  return decodeURIComponent(pathname.slice(index + marker.length));
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
  onRequest?: (url: string, init: RequestInit) => void;
}
