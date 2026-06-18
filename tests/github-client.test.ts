import { describe, expect, test } from "bun:test";
import {
  collectOwnerSuppliedGitHubProfile,
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
    expect(profile.activityAggregatesDeferred).toBe(true);
    expect(profile.signalVisibility?.privateRepositoriesIncluded).toBe(false);
    expect(profile.signalVisibility?.cardLabel).toBe("Public GitHub signals");
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

  test("derives file-presence signals from the repository tree when community profile data is missing", async () => {
    const baseFetch = makeGitHubFetch({
      tree: [
        { path: "README.md" },
        { path: "LICENSE" },
        { path: "CONTRIBUTING.md" },
        { path: "CODE_OF_CONDUCT.md" },
        { path: "SECURITY.md" },
        { path: "CHANGELOG.md" },
        { path: ".github/workflows/ci.yml" },
        { path: "src/score.test.ts", type: "blob", size: 1200 },
        { path: "docs/index.md" },
        { path: "package.json" }
      ]
    });
    const profile = await collectPublicGitHubProfile("example-builder", {
      fetcher: async (url, init) => {
        if (new URL(url).pathname.endsWith("/community/profile")) {
          return jsonResponse({ message: "Not found" }, { status: 404 });
        }

        return baseFetch(url, init);
      }
    });

    expect(profile.repositories[0]?.files).toMatchObject({
      hasReadme: true,
      hasLicense: true,
      hasUsageGuide: true,
      hasCi: true,
      hasTests: true,
      hasChangelog: true,
      hasContributing: true,
      hasCodeOfConduct: true,
      hasSecurityPolicy: true,
      hasDemoOrDocs: true,
      hasPackageArtifact: true
    });
  });

  test("detects common CI configuration files beyond GitHub Actions", async () => {
    const ciPaths = [
      ".circleci/config.yml",
      ".travis.yml",
      "Jenkinsfile",
      "azure-pipelines.yml",
      ".gitlab-ci.yml",
      ".drone.yml"
    ];

    for (const path of ciPaths) {
      const profile = await collectPublicGitHubProfile("example-builder", {
        fetcher: makeGitHubFetch({
          tree: [{ path }]
        })
      });

      expect(profile.repositories[0]?.files.hasCi).toBe(true);
    }
  });

  test("detects demo and sample directories as demo or docs signals", async () => {
    const demoPaths = [
      "demo/index.html",
      "demos/basic.ts",
      "docs/index.md",
      "documentation/getting-started.md",
      "example/basic.ts",
      "examples/basic.ts",
      "sample/app.ts",
      "samples/app.ts"
    ];

    for (const path of demoPaths) {
      const profile = await collectPublicGitHubProfile("example-builder", {
        fetcher: makeGitHubFetch({
          tree: [{ path, type: "blob", size: 900 }]
        })
      });

      expect(profile.repositories[0]?.files.hasDemoOrDocs).toBe(true);
    }
  });

  test("detects package manifests outside the repository root", async () => {
    const packageManifestPaths = [
      "packages/web/package.json",
      "crates/engine/Cargo.toml",
      "apps/api/pyproject.toml",
      "cmd/server/go.mod"
    ];

    for (const path of packageManifestPaths) {
      const profile = await collectPublicGitHubProfile("example-builder", {
        fetcher: makeGitHubFetch({
          tree: [{ path, type: "blob", size: 900 }]
        })
      });

      expect(profile.repositories[0]?.files.hasPackageArtifact).toBe(true);
    }
  });

  test("does not derive file-presence signals from directories named like files", async () => {
    const baseFetch = makeGitHubFetch({
      tree: [
        { path: "README.md/note.txt", type: "blob", size: 120 },
        { path: "LICENSE/text.txt", type: "blob", size: 120 },
        { path: "CHANGELOG.md/entry.txt", type: "blob", size: 120 },
        { path: "CONTRIBUTING.md/guide.txt", type: "blob", size: 120 },
        { path: "CODE_OF_CONDUCT.md/rules.txt", type: "blob", size: 120 },
        { path: "SECURITY.md/policy.txt", type: "blob", size: 120 },
        { path: ".travis.yml/config.yml", type: "blob", size: 120 },
        { path: "packages/web/package.json", type: "tree" },
        { path: "docs/index.md", type: "blob", size: 120 }
      ]
    });
    const profile = await collectPublicGitHubProfile("example-builder", {
      fetcher: async (url, init) => {
        if (new URL(url).pathname.endsWith("/community/profile")) {
          return jsonResponse({ message: "Not found" }, { status: 404 });
        }

        return baseFetch(url, init);
      }
    });

    expect(profile.repositories[0]?.files).toMatchObject({
      hasReadme: false,
      hasLicense: false,
      hasCi: false,
      hasChangelog: false,
      hasContributing: false,
      hasCodeOfConduct: false,
      hasSecurityPolicy: false,
      hasDemoOrDocs: true,
      hasPackageArtifact: false
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
          { path: "examples", type: "tree" },
          { path: "examples/basic.ts", type: "blob", size: 900 },
          { path: "node_modules/examples/dependency.ts", type: "blob", size: 900 },
          { path: "vendor/fixtures/package-example.ts", type: "blob", size: 900 },
          { path: "dist/examples/generated.ts", type: "blob", size: 900 },
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
      p90SourceFileBytes: 26_480,
      oversizedSourceFileCount: 1,
      testToSourceRatio: 0.2
    });
  });

  test("counts source file tree entries even when GitHub omits the entry type", async () => {
    const profile = await collectPublicGitHubProfile("example-builder", {
      fetcher: makeGitHubFetch({
        tree: [
          { path: "src/index.ts", size: 2400 },
          { path: "tests/index.test.ts", size: 1000 }
        ]
      })
    });

    expect(profile.repositories[0]?.files.codebaseShape).toMatchObject({
      sourceFileCount: 2,
      testFileCount: 1,
      medianSourceFileBytes: 1700,
      p90SourceFileBytes: 2260,
      testToSourceRatio: 0.5
    });
  });

  test("counts source files under root test directories as test files", async () => {
    const profile = await collectPublicGitHubProfile("example-builder", {
      fetcher: makeGitHubFetch({
        tree: [
          { path: "src/index.ts", type: "blob", size: 2400 },
          { path: "tests/helpers.ts", type: "blob", size: 800 },
          { path: "__tests__/fixture.ts", type: "blob", size: 600 },
          { path: "spec/support.ts", type: "blob", size: 700 }
        ]
      })
    });

    expect(profile.repositories[0]?.files.codebaseShape).toMatchObject({
      sourceFileCount: 4,
      testFileCount: 3,
      testToSourceRatio: 0.75
    });
  });

  test("preserves GitHub recursive tree truncation as an incomplete file-signal warning", async () => {
    const profile = await collectPublicGitHubProfile("example-builder", {
      fetcher: makeGitHubFetch({
        tree: [{ path: "src/index.ts", type: "blob", size: 2400 }],
        treeTruncated: true
      })
    });

    expect(profile.repositories[0]?.files.codebaseShape.treeTruncated).toBe(true);
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
        repositoryActivityWindowDays: 365,
        maxConcurrentRepositoryCollections: 3
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
        makeRepositoryResponse("old", { pushedAt: "2024-01-01T00:00:00Z" }),
        makeRepositoryResponse("future", { pushedAt: "2999-01-01T00:00:00Z" })
      ],
      onRequest: (url) => calls.push(url)
    });
    const policy: GitHubCollectorPolicy = {
      ...defaultGitHubCollectorPolicy,
      limits: {
        maxRepositoriesScannedPerProfile: 30,
        maxRepositoriesScoredPerProfile: 12,
        repositoryActivityWindowDays: 180,
        maxConcurrentRepositoryCollections: 3
      }
    };

    const profile = await collectPublicGitHubProfile("example-builder", { fetcher, policy });

    expect(profile.activityWindowDays).toBe(180);
    expect(profile.repositories.map((repository) => repository.name)).toEqual(["recent"]);
    expect(calls.some((url) => url.includes("/repos/example-builder/old/"))).toBe(false);
    expect(calls.some((url) => url.includes("/repos/example-builder/future/"))).toBe(false);
  });

  test("treats missing optional content paths as absent instead of failing collection", async () => {
    const profile = await collectPublicGitHubProfile("example-builder", { fetcher: makeGitHubFetch() });

    expect(profile.repositories[0]?.files.hasTests).toBe(false);
  });

  test("ignores dependency and build-output test paths when deriving file signals", async () => {
    const baseFetch = makeGitHubFetch({
      tree: [
        { path: "node_modules/test/dependency.test.ts", type: "blob", size: 900 },
        { path: "vendor/tests/package.test.ts", type: "blob", size: 900 },
        { path: "dist/test/generated.test.ts", type: "blob", size: 900 },
        { path: "node_modules/demo/dependency.html", type: "blob", size: 900 },
        { path: "vendor/samples/package.ts", type: "blob", size: 900 },
        { path: "dist/docs/generated.md", type: "blob", size: 900 },
        { path: "node_modules/package.json", type: "blob", size: 900 },
        { path: "dist/package.json", type: "blob", size: 900 }
      ]
    });
    const profile = await collectPublicGitHubProfile("example-builder", {
      fetcher: async (url, init) => {
        if (new URL(url).pathname.endsWith("/community/profile")) {
          return jsonResponse({ message: "Not found" }, { status: 404 });
        }

        return baseFetch(url, init);
      }
    });

    expect(profile.repositories[0]?.files.hasTests).toBe(false);
    expect(profile.repositories[0]?.files.hasDemoOrDocs).toBe(false);
    expect(profile.repositories[0]?.files.hasPackageArtifact).toBe(false);
    expect(profile.repositories[0]?.files.codebaseShape).toMatchObject({
      sourceFileCount: 0,
      testFileCount: 0,
      exampleFileCount: 0
    });
  });

  test("collects repositories with bounded concurrency while preserving order", async () => {
    let activeCommunityRequests = 0;
    let maxActiveCommunityRequests = 0;
    const profile = await collectPublicGitHubProfile("example-builder", {
      fetcher: makeGitHubFetch({
        repositories: [
          makeRepositoryResponse("first"),
          makeRepositoryResponse("second"),
          makeRepositoryResponse("third"),
          makeRepositoryResponse("fourth")
        ],
        onCommunityRequest: async () => {
          activeCommunityRequests += 1;
          maxActiveCommunityRequests = Math.max(maxActiveCommunityRequests, activeCommunityRequests);
          await sleep(5);
          activeCommunityRequests -= 1;
        }
      }),
      policy: {
        ...defaultGitHubCollectorPolicy,
        limits: {
          ...defaultGitHubCollectorPolicy.limits,
          maxRepositoriesScannedPerProfile: 4,
          maxRepositoriesScoredPerProfile: 4,
          maxConcurrentRepositoryCollections: 2
        }
      }
    });

    expect(profile.repositories.map((repository) => repository.name)).toEqual(["first", "second", "third", "fourth"]);
    expect(maxActiveCommunityRequests).toBeLessThanOrEqual(2);
  });

  test("omits repository detail failures while preserving the rest of the profile", async () => {
    const baseFetch = makeGitHubFetch({
      repositories: [
        makeRepositoryResponse("usable-toolkit"),
        makeRepositoryResponse("broken-toolkit")
      ]
    });
    const profile = await collectPublicGitHubProfile("example-builder", {
      fetcher: async (url, init) => {
        const parsed = new URL(url);
        if (parsed.pathname === "/repos/example-builder/broken-toolkit/git/trees/main") {
          return jsonResponse({ tree: "invalid" });
        }

        return baseFetch(url, init);
      }
    });

    expect(profile.repositories.map((repository) => repository.name)).toEqual(["usable-toolkit"]);
    expect(profile.repositoryCollectionFailureCount).toBe(1);
  });

  test("does not treat invalid release or tag responses as absent release signals", async () => {
    const baseFetch = makeGitHubFetch({
      repositories: [
        makeRepositoryResponse("usable-toolkit"),
        makeRepositoryResponse("broken-release-toolkit")
      ]
    });
    const profile = await collectPublicGitHubProfile("example-builder", {
      fetcher: async (url, init) => {
        const parsed = new URL(url);
        if (parsed.pathname === "/repos/example-builder/broken-release-toolkit/releases") {
          return jsonResponse({ message: "unexpected shape" });
        }

        return baseFetch(url, init);
      }
    });

    expect(profile.repositories.map((repository) => repository.name)).toEqual(["usable-toolkit"]);
    expect(profile.repositoryCollectionFailureCount).toBe(1);
  });

  test("does not treat invalid community profile responses as absent file signals", async () => {
    const baseFetch = makeGitHubFetch({
      repositories: [
        makeRepositoryResponse("usable-toolkit"),
        makeRepositoryResponse("broken-community-toolkit")
      ]
    });
    const profile = await collectPublicGitHubProfile("example-builder", {
      fetcher: async (url, init) => {
        const parsed = new URL(url);
        if (parsed.pathname === "/repos/example-builder/broken-community-toolkit/community/profile") {
          return jsonResponse("unexpected shape");
        }

        return baseFetch(url, init);
      }
    });

    expect(profile.repositories.map((repository) => repository.name)).toEqual(["usable-toolkit"]);
    expect(profile.repositoryCollectionFailureCount).toBe(1);
  });

  test("does not treat invalid community profile field values as present file signals", async () => {
    const baseFetch = makeGitHubFetch({
      repositories: [
        makeRepositoryResponse("usable-toolkit"),
        makeRepositoryResponse("broken-community-fields-toolkit")
      ]
    });
    const profile = await collectPublicGitHubProfile("example-builder", {
      fetcher: async (url, init) => {
        const parsed = new URL(url);
        if (parsed.pathname === "/repos/example-builder/broken-community-fields-toolkit/community/profile") {
          return jsonResponse({
            documentation: false,
            files: {
              readme: false,
              license: 0,
              contributing: "yes"
            }
          });
        }

        return baseFetch(url, init);
      }
    });

    expect(profile.repositories.map((repository) => repository.name)).toEqual(["usable-toolkit"]);
    expect(profile.repositoryCollectionFailureCount).toBe(1);
  });

  test("does not hide repository detail rate limits as ordinary omissions", async () => {
    const baseFetch = makeGitHubFetch({
      repositories: [
        makeRepositoryResponse("usable-toolkit"),
        makeRepositoryResponse("limited-toolkit")
      ]
    });

    await expect(
      collectPublicGitHubProfile("example-builder", {
        fetcher: async (url, init) => {
          const parsed = new URL(url);
          if (parsed.pathname === "/repos/example-builder/limited-toolkit/git/trees/main") {
            return jsonResponse(
              { message: "API rate limit exceeded" },
              {
                status: 403,
                headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1770000000" }
              }
            );
          }

          return baseFetch(url, init);
        }
      })
    ).rejects.toMatchObject({
      code: "github_rate_limited",
      status: 403,
      rateLimitReset: "1770000000"
    });
  });

  test("retries transient GitHub responses before failing collection", async () => {
    const baseFetch = makeGitHubFetch();
    let repositoryListAttempts = 0;
    const profile = await collectPublicGitHubProfile("example-builder", {
      fetcher: async (url, init) => {
        const parsed = new URL(url);
        if (parsed.pathname === "/users/example-builder/repos") {
          repositoryListAttempts += 1;
          if (repositoryListAttempts === 1) {
            return jsonResponse({ message: "temporary unavailable" }, { status: 503 });
          }
        }

        return baseFetch(url, init);
      }
    });

    expect(repositoryListAttempts).toBe(2);
    expect(profile.repositories).toHaveLength(1);
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
          headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1770000000" }
        }
      );

    await expect(collectPublicGitHubProfile("example-builder", { fetcher })).rejects.toMatchObject({
      code: "github_rate_limited",
      status: 403,
      rateLimitReset: "1770000000"
    });
  });

  test("rejects blank GitHub usernames before any GitHub request is made", async () => {
    let requestCount = 0;
    const fetcher: GitHubCollectorFetch = async () => {
      requestCount += 1;
      return jsonResponse({});
    };

    await expect(collectPublicGitHubProfile("  ", { fetcher })).rejects.toMatchObject({
      code: "invalid_policy",
      message: "GitHub username is required."
    });
    await expect(collectOwnerSuppliedGitHubProfile("", {
      fetcher,
      token: "private-local-token"
    })).rejects.toMatchObject({
      code: "invalid_policy",
      message: "GitHub username is required."
    });
    expect(requestCount).toBe(0);
  });

  test("trims GitHub usernames before collection and profile output", async () => {
    const calls: string[] = [];
    const profile = await collectPublicGitHubProfile(" example-builder ", {
      fetcher: makeGitHubFetch({
        onRequest: (url) => calls.push(url)
      })
    });

    expect(profile.username).toBe("example-builder");
    expect(calls.some((url) => url.includes("/users/example-builder/repos"))).toBe(true);
    expect(calls.every((url) => !url.includes("%20"))).toBe(true);
  });

  test("trims GitHub repository identifiers before detail requests and profile output", async () => {
    const calls: string[] = [];
    const profile = await collectPublicGitHubProfile("example-builder", {
      fetcher: makeGitHubFetch({
        repositories: [
          makeRepositoryResponse(" usable-toolkit ", {
            ownerLogin: " example-builder ",
            defaultBranch: " main ",
            htmlUrl: "  ",
            homepage: "  "
          })
        ],
        onRequest: (url) => calls.push(url)
      })
    });

    expect(calls.some((url) => url.includes("/repos/example-builder/usable-toolkit/"))).toBe(true);
    expect(calls.every((url) => !url.includes("%20"))).toBe(true);
    expect(profile.repositories[0]?.owner).toBe("example-builder");
    expect(profile.repositories[0]?.name).toBe("usable-toolkit");
    expect(profile.repositories[0]?.url).toBeUndefined();
  });

  test("does not classify unrelated GitHub forbidden responses as rate limits", async () => {
    const fetcher: GitHubCollectorFetch = async () =>
      jsonResponse(
        { message: "Resource not accessible by integration" },
        {
          status: 403
        }
      );

    await expect(collectPublicGitHubProfile("example-builder", { fetcher })).rejects.toMatchObject({
      code: "github_request_failed",
      status: 403
    });
  });

  test("rejects blank GitHub repository identifiers before detail collection", async () => {
    const baseRepository = makeRepositoryResponse("usable-toolkit");
    const cases = [
      { ...baseRepository, name: "" },
      { ...baseRepository, owner: { login: " " } },
      { ...baseRepository, default_branch: "" }
    ];

    for (const repository of cases) {
      await expect(
        collectPublicGitHubProfile("example-builder", {
          fetcher: makeGitHubFetch({ repositories: [repository] })
        })
      ).rejects.toMatchObject({
        code: "invalid_github_response"
      });
    }
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
      token: " public-data-token "
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
    expect(serialized).not.toContain("\"visibility\":\"private\"");
    expect(serialized).not.toContain("\"redactedName\":true");
  });

  test("collects owner-supplied private-local repositories with redacted private names", async () => {
    const calls: string[] = [];
    const profile = await collectOwnerSuppliedGitHubProfile("example-builder", {
      fetcher: makeGitHubFetch({
        repositories: [
          makeRepositoryResponse("public-toolkit"),
          makeRepositoryResponse("secret-product", { private: true })
        ],
        onRequest: (url) => calls.push(url)
      }),
      token: "private-local-token"
    });

    expect(calls.some((url) => url.includes("/user/repos?visibility=all"))).toBe(true);
    expect(profile.signalVisibility?.privateRepositoriesIncluded).toBe(true);
    expect(profile.signalVisibility?.privateRepositoryNamesRedacted).toBe(true);
    expect(profile.repositories).toHaveLength(2);
    expect(profile.repositories[1]).toMatchObject({
      name: "Private repository 1",
      visibility: "private",
      redactedName: true,
      stars: 0,
      forks: 0
    });
    expect(profile.repositories[1]?.url).toBeUndefined();
    expect(JSON.stringify(profile)).not.toContain("secret-product");
  });

  test("redacts names and URLs when every private-local repository is private", async () => {
    const profile = await collectOwnerSuppliedGitHubProfile("example-builder", {
      fetcher: makeGitHubFetch({
        repositories: [
          makeRepositoryResponse("secret-one", { private: true }),
          makeRepositoryResponse("secret-two", { private: true })
        ]
      }),
      token: "private-local-token"
    });

    expect(profile.repositories.map((repository) => repository.name)).toEqual([
      "Private repository 1",
      "Private repository 2"
    ]);
    expect(profile.repositories.every((repository) => repository.redactedName === true)).toBe(true);
    expect(profile.repositories.every((repository) => repository.url === undefined)).toBe(true);
    expect(JSON.stringify(profile)).not.toContain("secret-one");
    expect(JSON.stringify(profile)).not.toContain("secret-two");
  });

  test("does not claim private repositories are included when private-local collection finds only public repositories", async () => {
    const profile = await collectOwnerSuppliedGitHubProfile("example-builder", {
      fetcher: makeGitHubFetch({
        repositories: [
          makeRepositoryResponse("public-one"),
          makeRepositoryResponse("public-two")
        ]
      }),
      token: "private-local-token"
    });

    expect(profile.signalVisibility?.privateRepositoriesIncluded).toBe(false);
    expect(profile.signalVisibility?.cardLabel).toBe("Public GitHub signals");
    expect(profile.repositories.every((repository) => repository.visibility !== "private")).toBe(true);
  });

  test("rejects private-local collection when the token owner does not match the requested username", async () => {
    let repositoryListRequests = 0;

    await expect(
      collectOwnerSuppliedGitHubProfile("example-builder", {
        fetcher: makeGitHubFetch({
          authenticatedLogin: "other-owner",
          onRequest: (url) => {
            if (new URL(url).pathname === "/user/repos") {
              repositoryListRequests += 1;
            }
          }
        }),
        token: "private-local-token"
      })
    ).rejects.toMatchObject({
      code: "github_owner_mismatch"
    });

    expect(repositoryListRequests).toBe(0);
  });

  test("requires an explicit token before private-local collection", async () => {
    let requestCount = 0;

    await expect(
      collectOwnerSuppliedGitHubProfile("example-builder", {
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

    if (parsed.pathname === "/user") {
      return jsonResponse({ login: options.authenticatedLogin ?? "example-builder" });
    }

    if (parsed.pathname === "/users/example-builder/repos" || parsed.pathname === "/user/repos") {
      return jsonResponse(repositories);
    }

    if (parsed.pathname.endsWith("/community/profile")) {
      await options.onCommunityRequest?.();
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
        truncated: options.treeTruncated ?? false
      });
    }

    return jsonResponse({ message: "Not found" }, { status: 404 });
  };
}

function makeRepositoryResponse(
  name: string,
  options: {
    defaultBranch?: string;
    homepage?: string;
    htmlUrl?: string;
    ownerLogin?: string;
    pushedAt?: string;
    private?: boolean;
  } = {}
) {
  return {
    owner: { login: options.ownerLogin ?? "example-builder" },
    name,
    html_url: options.htmlUrl ?? `https://github.com/example-builder/${name}`,
    private: options.private ?? false,
    fork: false,
    archived: false,
    stargazers_count: 42,
    forks_count: 7,
    created_at: "2025-01-01T00:00:00Z",
    pushed_at: options.pushedAt ?? recentPushedAt,
    homepage: options.homepage ?? "",
    default_branch: options.defaultBranch ?? "main"
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
  treeTruncated?: boolean;
  onRequest?: (url: string, init: RequestInit) => void;
  onCommunityRequest?: () => Promise<void>;
  authenticatedLogin?: string;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
