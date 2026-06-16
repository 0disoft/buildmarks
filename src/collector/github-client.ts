import type {
  CodebaseShapeSignals,
  CollectedGitHubProfile,
  CollectedGitHubRepository,
  CollectedRepositoryActivitySignals,
  CollectedRepositoryFileSignals
} from "../shared/types";
import { privateLocalSignalVisibility, publicOnlySignalVisibility } from "../shared/types";
import {
  defaultGitHubCollectorPolicy,
  privateLocalGitHubCollectorPolicy,
  type GitHubCollectorPolicy,
  validateGitHubCollectorPolicy
} from "./policy";

const githubApiBaseUrl = "https://api.github.com";
const githubApiVersion = "2026-03-10";
const githubJsonAccept = "application/vnd.github+json";
const githubRawAccept = "application/vnd.github.raw+json";
const activityAggregatesDeferred = true;
const githubRequestTimeoutMilliseconds = 10_000;
const githubRequestRetryCount = 1;

const ciPaths = [
  ".github/workflows",
  ".circleci/config.yml",
  ".travis.yml",
  "Jenkinsfile",
  "azure-pipelines.yml",
  ".gitlab-ci.yml",
  ".drone.yml"
];
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
const sourceFileExtensions = new Set([
  ".astro",
  ".c",
  ".cpp",
  ".cs",
  ".cjs",
  ".dart",
  ".go",
  ".h",
  ".hpp",
  ".java",
  ".js",
  ".jsx",
  ".kt",
  ".mjs",
  ".php",
  ".py",
  ".rb",
  ".rs",
  ".scala",
  ".svelte",
  ".swift",
  ".ts",
  ".tsx",
  ".vue",
  ".zig"
]);
const ignoredShapePathSegments = new Set([
  ".cache",
  ".git",
  ".next",
  ".svelte-kit",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "target",
  "vendor"
]);
const lockfileNames = new Set([
  "bun.lock",
  "bun.lockb",
  "cargo.lock",
  "composer.lock",
  "package-lock.json",
  "pnpm-lock.yaml",
  "poetry.lock",
  "yarn.lock"
]);

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
  | "github_owner_mismatch"
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

export async function collectOwnerSuppliedGitHubProfile(
  username: string,
  options: CollectPublicGitHubProfileOptions = {}
): Promise<CollectedGitHubProfile> {
  const policy = options.policy ?? privateLocalGitHubCollectorPolicy;
  const validation = validateGitHubCollectorPolicy(policy, { mode: "private-local" });
  if (!validation.ok) {
    throw new GitHubCollectorError("invalid_policy", validation.errors.join(" "));
  }

  if (options.token === undefined || options.token.trim() === "") {
    throw new GitHubCollectorError(
      "invalid_policy",
      "Private-local collection requires an explicitly supplied read-only GitHub token."
    );
  }

  const fetcher = options.fetcher ?? globalThis.fetch?.bind(globalThis);
  if (fetcher === undefined) {
    throw new GitHubCollectorError("missing_fetch", "Buildmarks requires a fetch implementation to collect GitHub data.");
  }

  const client = new GitHubRestClient(fetcher, options.token);
  await client.assertAuthenticatedOwner(username);
  const repositories = await client.listAuthenticatedOwnerRepositories(
    username,
    policy.limits.maxRepositoriesScannedPerProfile
  );
  const activeRepositories = repositories.filter((repository) =>
    wasPushedWithinWindow(repository.pushed_at, policy.limits.repositoryActivityWindowDays)
  );
  const collected = await collectRepositories(
    activeRepositories,
    policy.limits.maxConcurrentRepositoryCollections,
    (repository, index) => client.collectRepository(repository, { privateOrdinal: index + 1 })
  );

  return {
    username,
    collectedAt: new Date().toISOString(),
    activityWindowDays: policy.limits.repositoryActivityWindowDays,
    activityAggregatesDeferred,
    ...(collected.failureCount === 0 ? {} : { repositoryCollectionFailureCount: collected.failureCount }),
    signalVisibility: privateLocalSignalVisibility,
    repositories: collected.repositories
  };
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
  const activeRepositories = repositories.filter((repository) =>
    wasPushedWithinWindow(repository.pushed_at, policy.limits.repositoryActivityWindowDays)
  );
  const collected = await collectRepositories(
    activeRepositories,
    policy.limits.maxConcurrentRepositoryCollections,
    (repository) => client.collectRepository(repository)
  );

  return {
    username,
    collectedAt: new Date().toISOString(),
    activityWindowDays: policy.limits.repositoryActivityWindowDays,
    activityAggregatesDeferred,
    ...(collected.failureCount === 0 ? {} : { repositoryCollectionFailureCount: collected.failureCount }),
    signalVisibility: publicOnlySignalVisibility,
    repositories: collected.repositories
  };
}

class GitHubRestClient {
  constructor(
    private readonly fetcher: GitHubCollectorFetch,
    private readonly token?: string
  ) {}

  async assertAuthenticatedOwner(username: string): Promise<void> {
    const authenticatedUser = await this.fetchJson<unknown>("/user");
    const login = asAuthenticatedUserLogin(authenticatedUser);
    if (login.toLowerCase() !== username.toLowerCase()) {
      throw new GitHubCollectorError(
        "github_owner_mismatch",
        `Private-local collection token belongs to ${login}, not ${username}.`
      );
    }
  }

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

  async listAuthenticatedOwnerRepositories(username: string, limit: number): Promise<GitHubRepositoryResponse[]> {
    const repositories: GitHubRepositoryResponse[] = [];
    let page = 1;
    const normalizedUsername = username.toLowerCase();

    while (repositories.length < limit) {
      const perPage = Math.min(100, limit - repositories.length);
      const pageRepositories = await this.fetchJson<unknown>(
        `/user/repos?visibility=all&affiliation=owner&sort=pushed&direction=desc&per_page=${perPage}&page=${page}`
      );

      if (!Array.isArray(pageRepositories)) {
        throw new GitHubCollectorError("invalid_github_response", "GitHub repository list response was not an array.");
      }

      const mapped = pageRepositories.map(asRepositoryResponse);
      repositories.push(...mapped.filter((repository) => repository.owner.login.toLowerCase() === normalizedUsername));

      if (mapped.length < perPage) {
        break;
      }

      page += 1;
    }

    return repositories.slice(0, limit);
  }

  async collectRepository(
    repository: GitHubRepositoryResponse,
    options: { privateOrdinal?: number } = {}
  ): Promise<CollectedGitHubRepository> {
    const owner = repository.owner.login;
    const name = repository.name;
    const isPrivate = repository.private;
    const [community, readmeText, hasReleasesOrTags, treeEntries] = await Promise.all([
      this.fetchJson<GitHubCommunityProfileResponse>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/community/profile`, {
        allowMissing: true
      }),
      isPrivate
        ? Promise.resolve(null)
        : this.fetchText(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/readme`, {
            accept: githubRawAccept,
            allowMissing: true
          }),
      this.hasReleasesOrTags(owner, name),
      this.fetchRepositoryTree(owner, name, repository.default_branch)
    ]);
    const fileSignals = this.collectFileSignals(treeEntries.entries, repository, treeEntries.truncated);
    const privateLabel = options.privateOrdinal === undefined ? undefined : `Private repository ${options.privateOrdinal}`;

    const collected: CollectedGitHubRepository = {
      owner,
      name: isPrivate ? (privateLabel ?? "Private repository") : name,
      isFork: repository.fork,
      isArchived: repository.archived,
      stars: isPrivate ? 0 : repository.stargazers_count,
      forks: isPrivate ? 0 : repository.forks_count,
      createdAt: repository.created_at,
      pushedAt: repository.pushed_at,
      hasReleasesOrTags,
      files: mergeCommunitySignals(fileSignals, community, readmeText),
      activity: emptyActivitySignals()
    };

    if (isPrivate) {
      collected.visibility = "private";
      collected.redactedName = true;
    } else {
      collected.visibility = "public";
    }

    if (!isPrivate && repository.html_url !== null) {
      collected.url = repository.html_url;
    }

    return collected;
  }

  collectFileSignals(
    treeEntries: readonly GitHubTreeEntry[],
    repository: GitHubRepositoryResponse,
    treeTruncated = false
  ): CollectedRepositoryFileSignals {
    const treeSignals = collectTreePathSignals(treeEntries);

    return {
      hasReadme: false,
      hasLicense: false,
      hasUsageGuide: false,
      hasCi: treeSignals.hasCi,
      hasTests: treeSignals.hasTests,
      hasChangelog: treeSignals.hasChangelog,
      hasContributing: false,
      hasCodeOfConduct: false,
      hasSecurityPolicy: treeSignals.hasSecurityPolicy,
      hasDemoOrDocs: treeSignals.hasDemoOrDocs || hasNonEmptyString(repository.homepage),
      hasPackageArtifact: treeSignals.hasPackageArtifact,
      codebaseShape: summarizeCodebaseShape(treeEntries, treeTruncated)
    };
  }

  async fetchRepositoryTree(owner: string, repo: string, branch: string): Promise<GitHubTreeSummary> {
    const tree = await this.fetchJson<GitHubTreeResponse>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      { allowMissing: true }
    );

    if (tree === null) {
      return { entries: [], truncated: false };
    }

    if (!Array.isArray(tree.tree)) {
      throw new GitHubCollectorError("invalid_github_response", "GitHub tree response was missing tree array.");
    }

    return {
      entries: tree.tree.flatMap((item) => {
        if (typeof item.path !== "string") {
          return [];
        }

        const entry: GitHubTreeEntry = { path: item.path };
        if (typeof item.type === "string") {
          entry.type = item.type;
        }
        if (typeof item.size === "number" && Number.isFinite(item.size)) {
          entry.size = Math.max(0, item.size);
        }

        return [entry];
      }),
      truncated: tree.truncated === true
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

  private async request(path: string, options: { accept: string }): Promise<Response> {
    const headers: Record<string, string> = {
      Accept: options.accept,
      "X-GitHub-Api-Version": githubApiVersion
    };

    if (this.token !== undefined && this.token.trim() !== "") {
      headers.Authorization = `Bearer ${this.token}`;
    }

    let lastError: unknown;

    for (let attempt = 0; attempt <= githubRequestRetryCount; attempt += 1) {
      try {
        const response = await fetchWithTimeout(this.fetcher, `${githubApiBaseUrl}${path}`, {
          headers,
          timeoutMilliseconds: githubRequestTimeoutMilliseconds
        });

        if (!shouldRetryResponse(response) || attempt === githubRequestRetryCount) {
          return response;
        }

        await sleep(retryDelayMilliseconds(attempt));
      } catch (error) {
        lastError = error;
        if (attempt === githubRequestRetryCount) {
          break;
        }

        await sleep(retryDelayMilliseconds(attempt));
      }
    }

    throw new GitHubCollectorError(
      "github_request_failed",
      `GitHub API request failed before a response was received while requesting ${path}: ${errorMessage(lastError)}`
    );
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

async function collectRepositories(
  repositories: readonly GitHubRepositoryResponse[],
  concurrency: number,
  collect: (repository: GitHubRepositoryResponse, index: number) => Promise<CollectedGitHubRepository>
): Promise<CollectedRepositoryBatch> {
  const results: Array<CollectedGitHubRepository | undefined> = new Array(repositories.length);
  const workerCount = Math.min(Math.max(1, concurrency), repositories.length);
  let nextIndex = 0;
  let failureCount = 0;

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const index = nextIndex;
        nextIndex += 1;
        const repository = repositories[index];
        if (repository === undefined) {
          return;
        }

        try {
          results[index] = await collect(repository, index);
        } catch {
          failureCount += 1;
        }
      }
    })
  );

  return {
    repositories: results.filter((repository): repository is CollectedGitHubRepository => repository !== undefined),
    failureCount
  };
}

interface CollectedRepositoryBatch {
  repositories: CollectedGitHubRepository[];
  failureCount: number;
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
    private: requireBoolean(record, "private"),
    fork: requireBoolean(record, "fork"),
    archived: requireBoolean(record, "archived"),
    stargazers_count: requireNumber(record, "stargazers_count"),
    forks_count: requireNumber(record, "forks_count"),
    created_at: optionalNullableString(record, "created_at"),
    pushed_at: optionalNullableString(record, "pushed_at"),
    homepage: optionalNullableString(record, "homepage"),
    default_branch: requireString(record, "default_branch")
  };

  return repository;
}

function asAuthenticatedUserLogin(value: unknown): string {
  if (typeof value !== "object" || value === null) {
    throw new GitHubCollectorError("invalid_github_response", "GitHub authenticated user response was not an object.");
  }

  const login = (value as Record<string, unknown>).login;
  if (typeof login !== "string" || login.trim() === "") {
    throw new GitHubCollectorError("invalid_github_response", "GitHub authenticated user response was missing login.");
  }

  return login;
}

async function assertOkResponse(response: Response, path: string): Promise<void> {
  if (response.ok) {
    return;
  }

  if (isRateLimitResponse(response)) {
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

function isRateLimitResponse(response: Response): boolean {
  if (response.status === 429) {
    return true;
  }

  if (response.status !== 403) {
    return false;
  }

  return response.headers.get("x-ratelimit-remaining") === "0" || response.headers.has("retry-after");
}

function isMissingResponse(response: Response): boolean {
  return response.status === 404 || response.status === 409;
}

async function fetchWithTimeout(
  fetcher: GitHubCollectorFetch,
  url: string,
  options: { headers: Record<string, string>; timeoutMilliseconds: number }
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMilliseconds);

  try {
    return await fetcher(url, {
      headers: options.headers,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function shouldRetryResponse(response: Response): boolean {
  return response.status === 429 || (response.status >= 500 && response.status <= 599);
}

function retryDelayMilliseconds(attempt: number): number {
  return 150 + attempt * 250;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
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
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new GitHubCollectorError("invalid_github_response", `GitHub repository response was missing ${key}.`);
  }

  return value;
}

function hasNonEmptyString(value: string | null): boolean {
  return value !== null && value.trim() !== "";
}

function arrayHasItems(value: unknown[] | null): boolean {
  return Array.isArray(value) && value.length > 0;
}

function wasPushedWithinWindow(value: string | null, days: number, now = new Date()): boolean {
  if (value === null) {
    return false;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return now.getTime() - date.getTime() <= days * 24 * 60 * 60 * 1000;
}

interface GitHubRepositoryResponse {
  owner: { login: string };
  name: string;
  html_url: string | null;
  private: boolean;
  fork: boolean;
  archived: boolean;
  stargazers_count: number;
  forks_count: number;
  created_at: string | null;
  pushed_at: string | null;
  homepage: string | null;
  default_branch: string;
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

interface GitHubTreeResponse {
  tree?: Array<{ path?: unknown; type?: unknown; size?: unknown }>;
  truncated?: boolean;
}

interface GitHubTreeEntry {
  path: string;
  type?: string;
  size?: number;
}

interface GitHubTreeSummary {
  entries: GitHubTreeEntry[];
  truncated: boolean;
}

function normalizeTreePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\/+/, "").toLowerCase();
}

interface TreePathSignals {
  hasCi: boolean;
  hasTests: boolean;
  hasChangelog: boolean;
  hasSecurityPolicy: boolean;
  hasDemoOrDocs: boolean;
  hasPackageArtifact: boolean;
}

function collectTreePathSignals(treeEntries: readonly GitHubTreeEntry[]): TreePathSignals {
  const signals: TreePathSignals = {
    hasCi: false,
    hasTests: false,
    hasChangelog: false,
    hasSecurityPolicy: false,
    hasDemoOrDocs: false,
    hasPackageArtifact: false
  };
  const matchers = [
    { key: "hasCi", candidates: ciPaths },
    { key: "hasTests", candidates: testPaths },
    { key: "hasChangelog", candidates: changelogPaths },
    { key: "hasSecurityPolicy", candidates: securityPolicyPaths },
    { key: "hasDemoOrDocs", candidates: demoOrDocsPaths },
    { key: "hasPackageArtifact", candidates: packageArtifactPaths }
  ] as const;

  for (const entry of treeEntries) {
    const normalizedPath = normalizeTreePath(entry.path);
    for (const matcher of matchers) {
      if (signals[matcher.key]) {
        continue;
      }

      signals[matcher.key] = matcher.candidates.some((candidate) =>
        pathMatchesCandidate(normalizedPath, normalizeTreePath(candidate))
      );
    }

    if (Object.values(signals).every(Boolean)) {
      break;
    }
  }

  return signals;
}

function pathMatchesCandidate(normalizedPath: string, normalizedCandidate: string): boolean {
  return normalizedPath === normalizedCandidate || normalizedPath.startsWith(`${normalizedCandidate}/`);
}

function summarizeCodebaseShape(
  treeEntries: readonly GitHubTreeEntry[],
  treeTruncated = false
): CodebaseShapeSignals {
  const sourceSizes: number[] = [];
  let sourceFileCount = 0;
  let testFileCount = 0;
  let exampleFileCount = 0;
  let oversizedSourceFileCount = 0;

  for (const entry of treeEntries) {
    if (isExamplePath(entry.path)) {
      exampleFileCount += 1;
    }

    if (!isCountableSourceFile(entry)) {
      continue;
    }

    sourceFileCount += 1;
    if (isTestPath(entry.path)) {
      testFileCount += 1;
    }

    if (entry.size !== undefined && Number.isFinite(entry.size)) {
      sourceSizes.push(entry.size);
      if (entry.size > 32_000) {
        oversizedSourceFileCount += 1;
      }
    }
  }

  return {
    sourceFileCount,
    testFileCount,
    exampleFileCount,
    medianSourceFileBytes: percentile(sourceSizes, 0.5),
    p90SourceFileBytes: percentile(sourceSizes, 0.9),
    oversizedSourceFileCount,
    testToSourceRatio: sourceFileCount === 0 ? 0 : roundRatio(testFileCount / sourceFileCount),
    ...(treeTruncated ? { treeTruncated: true } : {})
  };
}

function isCountableSourceFile(entry: GitHubTreeEntry): boolean {
  const normalizedPath = normalizeTreePath(entry.path);
  const segments = normalizedPath.split("/");
  const fileName = segments.at(-1) ?? "";

  if (entry.type !== undefined && entry.type !== "blob") {
    return false;
  }
  if (segments.some((segment) => ignoredShapePathSegments.has(segment))) {
    return false;
  }
  if (lockfileNames.has(fileName) || fileName.endsWith(".min.js") || fileName.endsWith(".map")) {
    return false;
  }

  return sourceFileExtensions.has(extensionOf(fileName));
}

function isTestPath(path: string): boolean {
  const normalizedPath = normalizeTreePath(path);
  const fileName = normalizedPath.split("/").at(-1) ?? "";

  return (
    normalizedPath.includes("/__tests__/") ||
    normalizedPath.includes("/test/") ||
    normalizedPath.includes("/tests/") ||
    normalizedPath.includes("/spec/") ||
    fileName.includes(".test.") ||
    fileName.includes(".spec.")
  );
}

function isExamplePath(path: string): boolean {
  const normalizedPath = normalizeTreePath(path);

  return (
    normalizedPath.startsWith("demo/") ||
    normalizedPath.startsWith("demos/") ||
    normalizedPath.startsWith("example/") ||
    normalizedPath.startsWith("examples/") ||
    normalizedPath.startsWith("fixture/") ||
    normalizedPath.startsWith("fixtures/") ||
    normalizedPath.startsWith("sample/") ||
    normalizedPath.startsWith("samples/") ||
    normalizedPath.includes("/examples/") ||
    normalizedPath.includes("/fixtures/")
  );
}

function extensionOf(fileName: string): string {
  const extensionStart = fileName.lastIndexOf(".");
  return extensionStart === -1 ? "" : fileName.slice(extensionStart);
}

function percentile(values: readonly number[], percentileValue: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const clampedPercentile = Math.max(0, Math.min(1, percentileValue));
  const rawIndex = (sorted.length - 1) * clampedPercentile;
  const lowerIndex = Math.floor(rawIndex);
  const upperIndex = Math.ceil(rawIndex);
  const lower = sorted[lowerIndex] ?? 0;
  const upper = sorted[upperIndex] ?? lower;

  return Math.round(lower + (upper - lower) * (rawIndex - lowerIndex));
}

function roundRatio(value: number): number {
  return Number(value.toFixed(3));
}
