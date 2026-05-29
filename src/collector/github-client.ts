import type {
  CollectedGitHubProfile,
  CollectedGitHubRepository,
  CollectedRepositoryActivitySignals,
  CollectedRepositoryFileSignals
} from "../shared/types";
import {
  defaultGitHubCollectorPolicy,
  type GitHubCollectorPolicy,
  validateGitHubCollectorPolicy
} from "./policy";

const githubApiBaseUrl = "https://api.github.com";
const githubApiVersion = "2026-03-10";
const githubJsonAccept = "application/vnd.github+json";
const githubRawAccept = "application/vnd.github.raw+json";

const ciPaths = [".github/workflows"];
const testPaths = ["tests", "test", "__tests__", "spec"];
const changelogPaths = ["CHANGELOG.md", "CHANGELOG", "changelog.md"];
const securityPolicyPaths = ["SECURITY.md", ".github/SECURITY.md"];
const demoOrDocsPaths = ["docs", "documentation", "examples"];
const packageArtifactPaths = [
  "package.json",
  "pyproject.toml",
  "Cargo.toml",
  "go.mod",
  "deno.json",
  "pubspec.yaml",
  "composer.json",
  "Gemfile",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts"
];
const usageGuidePattern = /\b(install|installation|usage|example|quick start|get started|getting started)\b|설치|사용법|예제|시작하기/i;

export type GitHubCollectorFetch = (url: string, init: RequestInit) => Promise<Response>;

export interface CollectPublicGitHubProfileOptions {
  policy?: GitHubCollectorPolicy;
  token?: string;
  fetcher?: GitHubCollectorFetch;
}

export type GitHubCollectorErrorCode =
  | "invalid_policy"
  | "missing_fetch"
  | "github_request_failed"
  | "github_rate_limited"
  | "invalid_github_response";

export class GitHubCollectorError extends Error {
  readonly code: GitHubCollectorErrorCode;
  readonly status?: number;
  readonly rateLimitReset?: string;

  constructor(
    code: GitHubCollectorErrorCode,
    message: string,
    options: { status?: number; rateLimitReset?: string } = {}
  ) {
    super(message);
    this.name = "GitHubCollectorError";
    this.code = code;
    if (options.status !== undefined) {
      this.status = options.status;
    }
    if (options.rateLimitReset !== undefined) {
      this.rateLimitReset = options.rateLimitReset;
    }
  }
}

export async function collectPublicGitHubProfile(
  username: string,
  options: CollectPublicGitHubProfileOptions = {}
): Promise<CollectedGitHubProfile> {
  const policy = options.policy ?? defaultGitHubCollectorPolicy;
  const validation = validateGitHubCollectorPolicy(policy);
  if (!validation.ok) {
    throw new GitHubCollectorError("invalid_policy", validation.errors.join(" "));
  }

  const fetcher = options.fetcher ?? globalThis.fetch?.bind(globalThis);
  if (fetcher === undefined) {
    throw new GitHubCollectorError("missing_fetch", "Buildmarks requires a fetch implementation to collect GitHub data.");
  }

  const client = new GitHubRestClient(fetcher, options.token);
  const repositories = await client.listUserRepositories(username, policy.limits.maxRepositoriesScannedPerProfile);
  const collectedRepositories: CollectedGitHubRepository[] = [];

  for (const repository of repositories) {
    collectedRepositories.push(await client.collectRepository(repository));
  }

  return {
    username,
    collectedAt: new Date().toISOString(),
    repositories: collectedRepositories
  };
}

class GitHubRestClient {
  constructor(
    private readonly fetcher: GitHubCollectorFetch,
    private readonly token?: string
  ) {}

  async listUserRepositories(username: string, limit: number): Promise<GitHubRepositoryResponse[]> {
    const repositories: GitHubRepositoryResponse[] = [];
    let page = 1;

    while (repositories.length < limit) {
      const perPage = Math.min(100, limit - repositories.length);
      const pageRepositories = await this.fetchJson<unknown>(
        `/users/${encodeURIComponent(username)}/repos?type=owner&sort=pushed&direction=desc&per_page=${perPage}&page=${page}`
      );

      if (!Array.isArray(pageRepositories)) {
        throw new GitHubCollectorError("invalid_github_response", "GitHub repository list response was not an array.");
      }

      const mapped = pageRepositories.map(asRepositoryResponse);
      repositories.push(...mapped);

      if (mapped.length < perPage) {
        break;
      }

      page += 1;
    }

    return repositories.slice(0, limit);
  }

  async collectRepository(repository: GitHubRepositoryResponse): Promise<CollectedGitHubRepository> {
    const owner = repository.owner.login;
    const name = repository.name;
    const [community, readmeText, hasReleasesOrTags, fileSignals] = await Promise.all([
      this.fetchJson<GitHubCommunityProfileResponse>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/community/profile`, {
        allowMissing: true
      }),
      this.fetchText(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/readme`, {
        accept: githubRawAccept,
        allowMissing: true
      }),
      this.hasReleasesOrTags(owner, name),
      this.collectFileSignals(owner, name, repository)
    ]);

    const collected: CollectedGitHubRepository = {
      owner,
      name,
      isFork: repository.fork,
      isArchived: repository.archived,
      stars: repository.stargazers_count,
      forks: repository.forks_count,
      createdAt: repository.created_at,
      pushedAt: repository.pushed_at,
      hasReleasesOrTags,
      files: mergeCommunitySignals(fileSignals, community, readmeText),
      activity: emptyActivitySignals()
    };

    if (repository.html_url !== null) {
      collected.url = repository.html_url;
    }

    return collected;
  }

  async collectFileSignals(
    owner: string,
    repo: string,
    repository: GitHubRepositoryResponse
  ): Promise<CollectedRepositoryFileSignals> {
    const [hasCi, hasTests, hasChangelog, hasSecurityPolicy, hasDemoOrDocsPath, hasPackageArtifact] =
      await Promise.all([
        this.existsAnyContentPath(owner, repo, ciPaths),
        this.existsAnyContentPath(owner, repo, testPaths),
        this.existsAnyContentPath(owner, repo, changelogPaths),
        this.existsAnyContentPath(owner, repo, securityPolicyPaths),
        this.existsAnyContentPath(owner, repo, demoOrDocsPaths),
        this.existsAnyContentPath(owner, repo, packageArtifactPaths)
      ]);

    return {
      hasReadme: false,
      hasLicense: false,
      hasUsageGuide: false,
      hasCi,
      hasTests,
      hasChangelog,
      hasContributing: false,
      hasCodeOfConduct: false,
      hasSecurityPolicy,
      hasDemoOrDocs: hasDemoOrDocsPath || hasNonEmptyString(repository.homepage),
      hasPackageArtifact
    };
  }

  async hasReleasesOrTags(owner: string, repo: string): Promise<boolean> {
    const [releases, tags] = await Promise.all([
      this.fetchJson<unknown[]>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases?per_page=1`, {
        allowMissing: true
      }),
      this.fetchJson<unknown[]>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tags?per_page=1`, {
        allowMissing: true
      })
    ]);

    return arrayHasItems(releases) || arrayHasItems(tags);
  }

  async existsAnyContentPath(owner: string, repo: string, paths: readonly string[]): Promise<boolean> {
    for (const path of paths) {
      if (await this.contentExists(owner, repo, path)) {
        return true;
      }
    }

    return false;
  }

  async contentExists(owner: string, repo: string, path: string): Promise<boolean> {
    const content = await this.fetchJson<unknown>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodePath(path)}`,
      { allowMissing: true }
    );

    return content !== null;
  }

  async fetchJson<T>(path: string, options: { allowMissing?: boolean } = {}): Promise<T | null> {
    const response = await this.request(path, { accept: githubJsonAccept });
    if (isMissingResponse(response) && options.allowMissing === true) {
      return null;
    }

    await assertOkResponse(response, path);
    return (await response.json()) as T;
  }

  async fetchText(
    path: string,
    options: { accept?: string; allowMissing?: boolean } = {}
  ): Promise<string | null> {
    const response = await this.request(path, { accept: options.accept ?? githubJsonAccept });
    if (isMissingResponse(response) && options.allowMissing === true) {
      return null;
    }

    await assertOkResponse(response, path);
    return response.text();
  }

  private request(path: string, options: { accept: string }): Promise<Response> {
    const headers: Record<string, string> = {
      Accept: options.accept,
      "X-GitHub-Api-Version": githubApiVersion
    };

    if (this.token !== undefined && this.token.trim() !== "") {
      headers.Authorization = `Bearer ${this.token}`;
    }

    return this.fetcher(`${githubApiBaseUrl}${path}`, { headers });
  }
}

function mergeCommunitySignals(
  fileSignals: CollectedRepositoryFileSignals,
  community: GitHubCommunityProfileResponse | null,
  readmeText: string | null
): CollectedRepositoryFileSignals {
  const communityFiles = community?.files ?? {};

  return {
    ...fileSignals,
    hasReadme: fileSignals.hasReadme || (communityFiles.readme !== null && communityFiles.readme !== undefined),
    hasLicense: fileSignals.hasLicense || (communityFiles.license !== null && communityFiles.license !== undefined),
    hasUsageGuide: fileSignals.hasUsageGuide || (readmeText !== null && usageGuidePattern.test(readmeText)),
    hasContributing:
      fileSignals.hasContributing ||
      (communityFiles.contributing !== null && communityFiles.contributing !== undefined),
    hasCodeOfConduct:
      fileSignals.hasCodeOfConduct ||
      (communityFiles.code_of_conduct !== null && communityFiles.code_of_conduct !== undefined) ||
      (communityFiles.code_of_conduct_file !== null && communityFiles.code_of_conduct_file !== undefined),
    hasDemoOrDocs:
      fileSignals.hasDemoOrDocs ||
      (community?.documentation !== null && community?.documentation !== undefined)
  };
}

function emptyActivitySignals(): CollectedRepositoryActivitySignals {
  return {
    issueResponseCount: 0,
    pullRequestReviewCount: 0,
    externalContributorCount: 0
  };
}

function asRepositoryResponse(value: unknown): GitHubRepositoryResponse {
  if (typeof value !== "object" || value === null) {
    throw new GitHubCollectorError("invalid_github_response", "GitHub repository response item was not an object.");
  }

  const record = value as Record<string, unknown>;
  const owner = record.owner;
  if (typeof owner !== "object" || owner === null || typeof (owner as Record<string, unknown>).login !== "string") {
    throw new GitHubCollectorError("invalid_github_response", "GitHub repository response was missing owner.login.");
  }

  const repository: GitHubRepositoryResponse = {
    owner: { login: (owner as Record<string, string>).login },
    name: requireString(record, "name"),
    html_url: optionalNullableString(record, "html_url"),
    fork: requireBoolean(record, "fork"),
    archived: requireBoolean(record, "archived"),
    stargazers_count: requireNumber(record, "stargazers_count"),
    forks_count: requireNumber(record, "forks_count"),
    created_at: optionalNullableString(record, "created_at"),
    pushed_at: optionalNullableString(record, "pushed_at"),
    homepage: optionalNullableString(record, "homepage")
  };

  return repository;
}

async function assertOkResponse(response: Response, path: string): Promise<void> {
  if (response.ok) {
    return;
  }

  if (response.status === 403 || response.status === 429) {
    const reset = response.headers.get("x-ratelimit-reset") ?? response.headers.get("retry-after") ?? undefined;
    const options = reset === undefined
      ? { status: response.status }
      : { status: response.status, rateLimitReset: reset };
    throw new GitHubCollectorError(
      "github_rate_limited",
      `GitHub API rate limit or abuse limit was reached while requesting ${path}.`,
      options
    );
  }

  throw new GitHubCollectorError(
    "github_request_failed",
    `GitHub API request failed with status ${response.status} while requesting ${path}.`,
    { status: response.status }
  );
}

function isMissingResponse(response: Response): boolean {
  return response.status === 404 || response.status === 409;
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string") {
    throw new GitHubCollectorError("invalid_github_response", `GitHub repository response was missing ${key}.`);
  }

  return value;
}

function optionalNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== "boolean") {
    throw new GitHubCollectorError("invalid_github_response", `GitHub repository response was missing ${key}.`);
  }

  return value;
}

function requireNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number") {
    throw new GitHubCollectorError("invalid_github_response", `GitHub repository response was missing ${key}.`);
  }

  return value;
}

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function hasNonEmptyString(value: string | null): boolean {
  return value !== null && value.trim() !== "";
}

function arrayHasItems(value: unknown[] | null): boolean {
  return Array.isArray(value) && value.length > 0;
}

interface GitHubRepositoryResponse {
  owner: { login: string };
  name: string;
  html_url: string | null;
  fork: boolean;
  archived: boolean;
  stargazers_count: number;
  forks_count: number;
  created_at: string | null;
  pushed_at: string | null;
  homepage: string | null;
}

interface GitHubCommunityProfileResponse {
  documentation?: unknown;
  files?: {
    code_of_conduct?: unknown;
    code_of_conduct_file?: unknown;
    contributing?: unknown;
    license?: unknown;
    readme?: unknown;
  };
}
