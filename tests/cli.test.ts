import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "bun:test";
import fixture from "../fixtures/example-public-profile.json";
import { parseProfileInput, renderCardFile } from "../src/cli/render-card";
import { renderGapsCardFile } from "../src/cli/render-gaps-card";
import { renderGitHubCardFile } from "../src/cli/render-github-card";
import { parseCommonGitHubCliOptions, parsePositiveDecimalIntegerOption } from "../src/cli/options";
import { renderRepoCardFile } from "../src/cli/render-repo-card";
import { writeTextFileAtomically } from "../src/cli/write-output";
import { defaultGitHubCollectorPolicy, privateLocalSignalVisibility, type GitHubCollectorFetch, type ProfileInput } from "../src";

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("render-card CLI", () => {
  test("atomically replaces text outputs without leaving temporary files", async () => {
    const directory = await makeTempDirectory();
    const outputPath = join(directory, "artifact.svg");
    await writeFile(outputPath, "old", "utf8");

    await writeTextFileAtomically(outputPath, "new");

    expect(await readFile(outputPath, "utf8")).toBe("new");
    expect(await readdir(directory)).toEqual(["artifact.svg"]);
  });

  test("cleans up owned temporary files when atomic replacement fails", async () => {
    const directory = await makeTempDirectory();
    const outputPath = join(directory, "occupied");
    await mkdir(outputPath);

    await expect(writeTextFileAtomically(outputPath, "new")).rejects.toBeDefined();

    expect(await readdir(directory)).toEqual(["occupied"]);
  });
  test("renders a local profile fixture into an SVG file", async () => {
    const directory = await makeTempDirectory();
    const outputPath = join(directory, "cards", "example-card.svg");

    const result = await renderCardFile("fixtures/example-public-profile.json", outputPath);
    const svg = await readFile(outputPath, "utf8");

    expect(result.ok).toBe(true);
    expect(result.fallback).toBe(false);
    expect(svg).toContain("Buildmarks");
    expect(svg).toContain("example-builder");
    expect(svg).toContain("Buildmarks v");
    expect(svg).not.toContain("Public Signal Tier");
    expect(svg).toContain(">Gold II</text>");
    expect(svg).toContain("Highlights");
    expect(svg).not.toContain("50-74 band");
    expect(svg).not.toContain("repos checked");
    expect(svg).not.toContain(">24 marks</text>");
    expect(svg).not.toContain("class=\"chip\">+ ");
    expect(svg).not.toContain("<text x=\"36\" y=\"390\" class=\"footer\">Not a ranking");
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
    expect(svg).toContain("Buildmarks couldn&apos;t generate this report right now");
    expect(svg).toContain("No score is shown");
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
    expect(svg).toContain("Buildmarks couldn&apos;t generate this report right now");
  });

  test("returns an error result when fallback SVG writing also fails", async () => {
    const directory = await makeTempDirectory();
    const result = await renderCardFile(join(directory, "missing-profile.json"), directory);

    expect(result.ok).toBe(false);
    expect(result.fallback).toBe(true);
    expect(result.error).toContain("Fallback SVG write failed");
  });

  test("rejects empty file paths before resolving them to the workspace", async () => {
    const directory = await makeTempDirectory();

    await expect(renderCardFile("", join(directory, "card.svg"))).rejects.toThrow("Profile JSON path is required.");
    await expect(renderGapsCardFile("fixtures/example-public-profile.json", "")).rejects.toThrow(
      "Output SVG path is required."
    );
    await expect(renderGitHubCardFile("", join(directory, "github-card.svg"), {
      fetcher: makeGitHubFetch()
    })).rejects.toThrow("GitHub username is required.");
    await expect(renderGitHubCardFile("example-builder", "", { fetcher: makeGitHubFetch() })).rejects.toThrow(
      "Output SVG path is required."
    );
  });

  test("trims file path arguments before resolving them", async () => {
    const directory = await makeTempDirectory();
    const inputPath = join(directory, "profile.json");
    const outputPath = join(directory, "cards", "trimmed-card.svg");
    await writeFile(inputPath, JSON.stringify(fixture), "utf8");

    const result = await renderCardFile(` ${inputPath} `, ` ${outputPath} `);
    const svg = await readFile(outputPath, "utf8");

    expect(result.ok).toBe(true);
    expect(result.inputPath).toBe(resolve(inputPath));
    expect(result.outputPath).toBe(resolve(outputPath));
    expect(svg).toContain("Buildmarks");
  });

  test("rejects unexpected positional arguments before rendering", async () => {
    const directory = await makeTempDirectory();
    const outputPath = join(directory, "cards", "extra-arg-card.svg");
    const result = runBunScript([
      "src/cli/render-card.ts",
      "fixtures/example-public-profile.json",
      outputPath,
      "unexpected"
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Unexpected positional argument: unexpected");
  });

  test("rejects option-like positional values in local auxiliary CLIs before rendering", async () => {
    const directory = await makeTempDirectory();
    const gapsResult = runBunScript([
      "src/cli/render-gaps-card.ts",
      "--bad-input",
      join(directory, "gaps.svg")
    ]);
    const repoResult = runBunScript([
      "src/cli/render-repo-card.ts",
      "fixtures/example-public-profile.json",
      "--bad-repo",
      join(directory, "repo.svg")
    ]);
    const reportResult = runBunScript([
      "src/cli/render-report.ts",
      "--bad-input",
      join(directory, "report")
    ]);

    expect(gapsResult.exitCode).toBe(2);
    expect(gapsResult.stderr).toContain("Unknown option: --bad-input");
    expect(repoResult.exitCode).toBe(2);
    expect(repoResult.stderr).toContain("Unknown option: --bad-repo");
    expect(reportResult.exitCode).toBe(2);
    expect(reportResult.stderr).toContain("Unknown option: --bad-input");
  });

  test("rejects option-like positional values even when quoted with leading whitespace", async () => {
    const directory = await makeTempDirectory();
    const cardResult = runBunScript([
      "src/cli/render-card.ts",
      " --bad-input",
      join(directory, "card.svg")
    ]);
    const gapsResult = runBunScript([
      "src/cli/render-gaps-card.ts",
      " --bad-input",
      join(directory, "gaps.svg")
    ]);
    const repoResult = runBunScript([
      "src/cli/render-repo-card.ts",
      "fixtures/example-public-profile.json",
      " --bad-repo",
      join(directory, "repo.svg")
    ]);
    const reportResult = runBunScript([
      "src/cli/render-report.ts",
      " --bad-input",
      join(directory, "report")
    ]);

    expect(cardResult.exitCode).toBe(2);
    expect(cardResult.stderr).toContain("Unknown option: --bad-input");
    expect(gapsResult.exitCode).toBe(2);
    expect(gapsResult.stderr).toContain("Unknown option: --bad-input");
    expect(repoResult.exitCode).toBe(2);
    expect(repoResult.stderr).toContain("Unknown option: --bad-repo");
    expect(reportResult.exitCode).toBe(2);
    expect(reportResult.stderr).toContain("Unknown option: --bad-input");
  });

  test("rejects removed report href options before rendering", () => {
    const result = runBunScript([
      "src/cli/render-card.ts",
      "fixtures/example-public-profile.json",
      "out/example-card.svg",
      "--report-href",
      "--unexpected"
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Unknown option: --report-href");
  });

  test("rejects option-like option values even when quoted with leading whitespace", () => {
    const unknownOptionResult = runBunScript([
      "src/cli/render-card.ts",
      "fixtures/example-public-profile.json",
      "out/example-card.svg",
      " --unexpected"
    ]);
    const parsedToken = parseCommonGitHubCliOptions([
      "example-builder",
      "out.svg",
      "--token",
      " --private-local"
    ]);
    const parsedLimit = parseCommonGitHubCliOptions([
      "example-builder",
      "out.svg",
      "--max-repositories-scanned",
      " --max-repositories-scored"
    ]);

    expect(unknownOptionResult.exitCode).toBe(2);
    expect(unknownOptionResult.stderr).toContain("Unknown option: --unexpected");
    expect(parsedToken).toEqual({ ok: false, message: "Missing value for --token." });
    expect(parsedLimit).toEqual({ ok: false, message: "Missing value for --max-repositories-scanned." });
  });

  test("rejects unknown GitHub options even when quoted with leading whitespace", () => {
    expect(parseCommonGitHubCliOptions([
      "example-builder",
      "out.svg",
      " --private-local"
    ])).toEqual({ ok: false, message: "Unknown option: --private-local" });
  });

  test("rejects invalid numeric profile input instead of silently normalizing it", () => {
    const profile = fixture as ProfileInput;
    const repository = profile.repositories[0]!;

    expect(() => parseProfileInput({ ...profile, activityWindowDays: 0 })).toThrow("activityWindowDays");
    expect(() => parseProfileInput({ ...profile, repositoryCollectionFailureCount: 1.5 })).toThrow(
      "repositoryCollectionFailureCount"
    );
    expect(() => parseProfileInput({
      ...profile,
      repositories: [{ ...repository, stars: -1 }]
    })).toThrow("stars");
    expect(() => parseProfileInput({
      ...profile,
      repositories: [{
        ...repository,
        codebaseShape: {
          ...repository.codebaseShape!,
          medianSourceFileBytes: -1
        }
      }]
    })).toThrow("medianSourceFileBytes");
    expect(() => parseProfileInput({ ...profile, generatedAt: " " })).toThrow("generatedAt");
    expect(() => parseProfileInput({
      ...profile,
      repositories: [{ ...repository, createdAt: "" }]
    })).toThrow("createdAt");
  });

  test("trims local profile identity strings before scoring and lookup", async () => {
    const profile = fixture as ProfileInput;
    const repository = profile.repositories[0]!;
    const parsed = parseProfileInput({
      ...profile,
      username: " example-builder ",
      generatedAt: " 2026-05-28T00:00:00.000Z ",
      repositories: [{
        ...repository,
        owner: " example-builder ",
        name: " usable-toolkit ",
        url: " https://github.com/example-builder/usable-toolkit ",
        createdAt: " 2025-01-01T00:00:00Z ",
        pushedAt: " 2026-05-27T00:00:00Z "
      }]
    });
    const directory = await makeTempDirectory();
    const inputPath = join(directory, "profile.json");
    const outputPath = join(directory, "repo.svg");
    await writeFile(inputPath, JSON.stringify(parsed), "utf8");

    const result = await renderRepoCardFile(inputPath, "example-builder/usable-toolkit", outputPath);

    expect(parsed.username).toBe("example-builder");
    expect(parsed.generatedAt).toBe("2026-05-28T00:00:00.000Z");
    expect(parsed.repositories[0]?.owner).toBe("example-builder");
    expect(parsed.repositories[0]?.name).toBe("usable-toolkit");
    expect(parsed.repositories[0]?.url).toBe("https://github.com/example-builder/usable-toolkit");
    expect(result.ok).toBe(true);
    expect(result.fallback).toBe(false);
  });

  test("preserves methodology metadata from local profile JSON", () => {
    const profile = fixture as ProfileInput;
    const repository = profile.repositories[0]!;
    const parsed = parseProfileInput({
      ...profile,
      repositories: [{
        ...repository,
        repositoryKind: "documentation",
        repositoryKindSource: "declared",
        repositoryKindConfidence: "high",
        unavailableObservations: ["usageGuide", "usageGuide", "codebaseShape"]
      }]
    });

    expect(parsed.repositories[0]).toMatchObject({
      repositoryKind: "documentation",
      repositoryKindSource: "declared",
      repositoryKindConfidence: "high",
      unavailableObservations: ["usageGuide", "codebaseShape"]
    });
    expect(() => parseProfileInput({
      ...profile,
      repositories: [{ ...repository, repositoryKind: "website" }]
    })).toThrow("repositoryKind");
    expect(() => parseProfileInput({
      ...profile,
      repositories: [{ ...repository, unavailableObservations: ["readmeText"] }]
    })).toThrow("unavailableObservations");
  });

  test("rejects unredacted private repository records in local profile input", () => {
    const profile = fixture as ProfileInput;
    const repository = profile.repositories[0]!;
    const privateRepository = {
      ...repository,
      visibility: "private",
      redactedName: true,
      name: "Private repository 1",
      url: undefined
    };

    expect(() => parseProfileInput({
      ...profile,
      repositories: [privateRepository]
    })).toThrow("private-local signalVisibility");
    expect(parseProfileInput({
      ...profile,
      signalVisibility: privateLocalSignalVisibility,
      repositories: [privateRepository]
    }).repositories[0]).toMatchObject({
      name: "Private repository 1",
      visibility: "private",
      redactedName: true
    });
    expect(() => parseProfileInput({
      ...profile,
      signalVisibility: {
        ...privateLocalSignalVisibility,
        cardLabel: "Public GitHub signals"
      },
      repositories: [privateRepository]
    })).toThrow("private-local signalVisibility");
    expect(() => parseProfileInput({
      ...profile,
      repositories: [{ ...privateRepository, name: "secret-toolkit" }]
    })).toThrow("must be redacted");
    expect(() => parseProfileInput({
      ...profile,
      repositories: [{ ...privateRepository, redactedName: false }]
    })).toThrow("redactedName");
    expect(() => parseProfileInput({
      ...profile,
      repositories: [{ ...repository, name: "Private repository 1", redactedName: true }]
    })).toThrow("visibility to private");
    expect(() => parseProfileInput({
      ...profile,
      repositories: [{ ...privateRepository, url: "https://github.com/example-builder/secret-toolkit" }]
    })).toThrow("omit repository url");
  });

  test("rejects inconsistent local signal visibility disclosures", () => {
    const profile = fixture as ProfileInput;

    expect(() => parseProfileInput({
      ...profile,
      signalVisibility: {
        scope: "public-and-owner-supplied-private",
        privateRepositoriesIncluded: true,
        privateRepositoryNamesRedacted: true,
        independentlyVerifiable: false,
        cardLabel: "Public + Private Signals",
        reportVisibility: "public-safe"
      }
    })).toThrow("private-local signalVisibility");
    expect(() => parseProfileInput({
      ...profile,
      signalVisibility: {
        scope: "public-only",
        privateRepositoriesIncluded: false,
        privateRepositoryNamesRedacted: true,
        independentlyVerifiable: true,
        cardLabel: "Public GitHub signals",
        reportVisibility: "public-safe"
      }
    })).toThrow("public-only signalVisibility");
    expect(() => parseProfileInput({
      ...profile,
      signalVisibility: {
        scope: "public-only",
        privateRepositoriesIncluded: false,
        privateRepositoryNamesRedacted: false,
        independentlyVerifiable: true,
        cardLabel: "Public + Private Signals",
        reportVisibility: "public-safe"
      }
    })).toThrow("public-only signalVisibility");
    expect(() => parseProfileInput({
      ...profile,
      signalVisibility: privateLocalSignalVisibility
    })).toThrow("at least one private repository");
  });
});

describe("render-github-card CLI", () => {
  test("collects public GitHub data and renders an SVG file", async () => {
    const directory = await makeTempDirectory();
    const outputPath = join(directory, "cards", "github-card.svg");

    const result = await renderGitHubCardFile(" example-builder ", outputPath, {
      fetcher: makeGitHubFetch()
    });
    const svg = await readFile(outputPath, "utf8");

    expect(result.ok).toBe(true);
    expect(result.fallback).toBe(false);
    expect(result.username).toBe("example-builder");
    expect(svg).toContain("Buildmarks");
    expect(svg).toContain("example-builder");
    expect(svg).toContain("Buildmarks v");
    expect(svg).not.toContain("Public Signal Tier");
    expect(svg).toContain(">Gold I</text>");
    expect(svg).toContain(">Diamond V</text>");
    expect(svg).not.toContain("50-74 band");
    expect(svg).not.toContain("<text x=\"36\" y=\"390\" class=\"footer\">Not a ranking");
  });

  test("keeps the display limit from narrowing the profile calculation", async () => {
    const directory = await makeTempDirectory();
    const outputPath = join(directory, "cards", "limited-github-card.svg");

    const result = await renderGitHubCardFile("example-builder", outputPath, {
      fetcher: makeGitHubFetch([
        githubRepositoryResponse("usable-toolkit"),
        githubRepositoryResponse("second-toolkit")
      ]),
      policy: {
        ...defaultGitHubCollectorPolicy,
        limits: {
          ...defaultGitHubCollectorPolicy.limits,
          maxRepositoriesScannedPerProfile: 2,
          maxRepositoriesScoredPerProfile: 1,
          repositoryActivityWindowDays: 365,
          maxConcurrentRepositoryCollections: defaultGitHubCollectorPolicy.limits.maxConcurrentRepositoryCollections
        }
      }
    });
    const svg = await readFile(outputPath, "utf8");

    expect(result.ok).toBe(true);
    expect(svg).toContain("Buildmarks reviewed 2 repositories");
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
    expect(svg).toContain("Buildmarks couldn&apos;t refresh this GitHub report right now");
    expect(svg).toContain("No score is shown");
  });

  test("preserves an existing SVG when repository evidence is insufficient", async () => {
    const directory = await makeTempDirectory();
    const outputPath = join(directory, "cards", "existing-card.svg");
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, "healthy-card", "utf8");
    const baseFetch = makeGitHubFetch([
      githubRepositoryResponse("usable-toolkit"),
      githubRepositoryResponse("broken-toolkit")
    ]);

    const result = await renderGitHubCardFile("example-builder", outputPath, {
      fetcher: async (url, init) => {
        if (new URL(url).pathname === "/repos/example-builder/broken-toolkit/git/trees/main") {
          return jsonResponse({ tree: "invalid" });
        }
        return baseFetch(url, init);
      }
    });

    expect(result.ok).toBe(false);
    expect(result.fallback).toBe(false);
    expect(result.preservedExisting).toBe(true);
    expect(result.error).toContain("attempted=2, failed=1, truncated=0");
    expect(result.error).toContain("invalid_github_response/tree=1");
    expect(result.error).not.toContain("broken-toolkit");
    expect(await readFile(outputPath, "utf8")).toBe("healthy-card");
  });

  test("writes a fallback only when insufficient evidence has no existing SVG", async () => {
    const directory = await makeTempDirectory();
    const outputPath = join(directory, "cards", "first-card.svg");
    const baseFetch = makeGitHubFetch([
      githubRepositoryResponse("usable-toolkit"),
      githubRepositoryResponse("broken-toolkit")
    ]);

    const result = await renderGitHubCardFile("example-builder", outputPath, {
      fetcher: async (url, init) => {
        if (new URL(url).pathname === "/repos/example-builder/broken-toolkit/git/trees/main") {
          return jsonResponse({ tree: "invalid" });
        }
        return baseFetch(url, init);
      }
    });
    const svg = await readFile(outputPath, "utf8");

    expect(result.ok).toBe(false);
    expect(result.fallback).toBe(true);
    expect(result.preservedExisting).toBeUndefined();
    expect(svg).toContain("Card unavailable");
    expect(svg).toContain("Not enough complete repository data");
  });
});

describe("CLI option parsing", () => {
  test("accepts only plain decimal positive integers for repository limits", () => {
    expect(parsePositiveDecimalIntegerOption("--max-repositories-scanned", "12")).toBe(12);
    expect(parsePositiveDecimalIntegerOption("--max-repositories-scanned", "0x10")).toContain("base-10");
    expect(parsePositiveDecimalIntegerOption("--max-repositories-scanned", "1e2")).toContain("base-10");
    expect(parsePositiveDecimalIntegerOption("--max-repositories-scanned", "0")).toContain("base-10");
  });

  test("parses common GitHub CLI options separately from positional arguments", () => {
    const parsed = parseCommonGitHubCliOptions([
      "example-builder",
      "out.svg",
      "--token",
      " token ",
      "--private-local",
      "--max-repositories-scanned",
      "17"
    ]);
    const disallowedReportHref = parseCommonGitHubCliOptions(["example-builder", "--report-href", "./report.html"]);

    expect(parsed).toEqual({
      ok: true,
      value: {
        positional: ["example-builder", "out.svg"],
        token: "token",
        privateLocal: true,
        maxRepositoriesScanned: 17,
        maxRepositoriesScored: defaultGitHubCollectorPolicy.limits.maxRepositoriesScoredPerProfile,
        activityWindowDays: defaultGitHubCollectorPolicy.limits.repositoryActivityWindowDays,
        maxApiRequests: defaultGitHubCollectorPolicy.limits.maxApiRequestsPerProfile
      }
    });
    expect(disallowedReportHref).toEqual({ ok: false, message: "Unknown option: --report-href" });
  });

  test("rejects option-like values as missing GitHub CLI option values", () => {
    expect(parseCommonGitHubCliOptions([
      "example-builder",
      "--token",
      "--private-local"
    ])).toEqual({ ok: false, message: "Missing value for --token." });
    expect(parseCommonGitHubCliOptions([
      "example-builder",
      "--max-repositories-scanned",
      "--private-local"
    ])).toEqual({ ok: false, message: "Missing value for --max-repositories-scanned." });
  });

  test("rejects GitHub CLI limits that violate collector policy before collection starts", () => {
    expect(parseCommonGitHubCliOptions([
      "example-builder",
      "--max-repositories-scanned",
      "101"
    ])).toEqual({
      ok: false,
      message: "Max repositories scanned per profile must be less than or equal to 100."
    });
    expect(parseCommonGitHubCliOptions([
      "example-builder",
      "--max-repositories-scanned",
      "1",
      "--max-repositories-scored",
      "2"
    ])).toEqual({
      ok: false,
      message: "Max repositories scanned per profile must be greater than or equal to max repositories scored."
    });
    expect(parseCommonGitHubCliOptions([
      "example-builder",
      "--activity-window-days",
      "3651"
    ])).toEqual({
      ok: false,
      message: "Repository activity window days must be less than or equal to 3650."
    });
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
    expect(svg).toContain("Ways to Improve");
    expect(svg).toContain("Buildmarks v");
    expect(svg).toContain("Public GitHub projects");
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
    expect(svg).toContain("example-builder/usable-toolkit");
    expect(svg).toContain("Buildmarks Repo");
    expect(svg).not.toContain("Repository Signal Tier");
  });

  test("writes a fallback SVG when the requested repository is missing", async () => {
    const directory = await makeTempDirectory();
    const outputPath = join(directory, "cards", "missing-repo-card.svg");

    const result = await renderRepoCardFile("fixtures/example-public-profile.json", "missing-repo", outputPath);
    const svg = await readFile(outputPath, "utf8");

    expect(result.ok).toBe(false);
    expect(result.fallback).toBe(true);
    expect(result.error).toContain("missing-repo");
    expect(svg).toContain("Buildmarks couldn&apos;t generate this repository report right now");
  });
});

async function makeTempDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "buildmarks-"));
  tempDirectories.push(directory);
  return directory;
}

function makeGitHubFetch(repositories = [githubRepositoryResponse("usable-toolkit")]): GitHubCollectorFetch {
  return async (url) => {
    const parsed = new URL(url);

    if (parsed.pathname === "/users/example-builder/repos") {
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

function githubRepositoryResponse(name: string) {
  return {
    owner: { login: "example-builder" },
    name,
    html_url: `https://github.com/example-builder/${name}`,
    private: false,
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

function runBunScript(args: string[]): { exitCode: number | null; stderr: string } {
  const result = Bun.spawnSync({
    cmd: [process.execPath, ...args],
    stdout: "pipe",
    stderr: "pipe"
  });

  return {
    exitCode: result.exitCode,
    stderr: new TextDecoder().decode(result.stderr)
  };
}
