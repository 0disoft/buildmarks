import { collectTreePathSignals, summarizeCodebaseShape, type GitHubTreeEntry } from "./repository-tree-signals.js";
import { GitHubCollectorError } from "./github-errors.js";
export { GitHubCollectorError, type GitHubCollectorErrorCode } from "./github-errors.js";

import type {
  CollectedGitHubProfile,
  CollectedGitHubRepository,
  CollectedRepositoryActivitySignals,
  CollectedRepositoryFileSignals,
  RepositoryCollectionFailureSummary,
  RepositoryCollectionOperation
} from "../shared/types.js";
import { privateLocalSignalVisibility, publicOnlySignalVisibility } from "../shared/types.js";
import {
  defaultGitHubCollectorPolicy,
  privateLocalGitHubCollectorPolicy,
  type GitHubCollectorPolicy,
  validateGitHubCollectorPolicy
} from "./policy.js";
import { detectRepositoryKindFromPaths } from "../scoring/repository-kind.js";

const githubApiBaseUrl = "https://api.github.com";
const githubApiVersion = "2026-03-10";
const githubJsonAccept = "application/vnd.github+json";
const githubRawAccept = "application/vnd.github.raw+json";
const activityAggregatesDeferred = true;
const githubRequestTimeoutMilliseconds = 10_000;
const githubRequestRetryCount = 1;
const repositoryCollectionOperationSymbol = Symbol("repositoryCollectionOperation");

const usageGuidePattern = /\b(install|installation|usage|example|quick start|get started|getting started)\b|설치|사용법|예제|시작하기/i;
export type GitHubCollectorFetch = (url: string, init: RequestInit) => Promise<Response>;

export interface CollectPublicGitHubProfileOptions {
  policy?: GitHubCollectorPolicy;
  token?: string;
  fetcher?: GitHubCollectorFetch;
}

export async function collectOwnerSuppliedGitHubProfile(
  username: string,
  options: CollectPublicGitHubProfileOptions = {}
): Promise<CollectedGitHubProfile> {
  const normalizedUsername = normalizeRequiredGitHubUsername(username);
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

  const client = new GitHubRestClient(fetcher, options.token, policy.limits.maxApiRequestsPerProfile);
  await client.assertAuthenticatedOwner(normalizedUsername);
  const repositories = await client.listAuthenticatedOwnerRepositories(
    normalizedUsername,
    policy.limits.maxRepositoriesScannedPerProfile
  );
  const activeRepositories = repositories.filter((repository) =>
    wasPushedWithinWindow(repository.pushed_at, policy.limits.repositoryActivityWindowDays)
  );
  let collected: CollectedRepositoryBatch;
  try {
    collected = await collectRepositories(
      activeRepositories,
      policy.limits.maxConcurrentRepositoryCollections,
      (repository) => client.collectRepository(repository),
      () => client.abortPendingRequests()
    );
  } catch (error) {
    throw redactPrivateRepositoryError(error, activeRepositories);
  }
  const repositoriesWithPrivateLabels = relabelPrivateRepositories(collected.repositories);
  const includesPrivateRepositories = repositoriesWithPrivateLabels.some((repository) => repository.visibility === "private");

  return {
    username: normalizedUsername,
    collectedAt: new Date().toISOString(),
    activityWindowDays: policy.limits.repositoryActivityWindowDays,
    activityAggregatesDeferred,
    ...(collected.failureCount === 0 ? {} : { repositoryCollectionFailureCount: collected.failureCount }),
    repositoryCollectionAttemptCount: activeRepositories.length,
    ...(collected.failures.length === 0 ? {} : { repositoryCollectionFailures: collected.failures }),
    signalVisibility: includesPrivateRepositories ? privateLocalSignalVisibility : publicOnlySignalVisibility,
    repositories: repositoriesWithPrivateLabels
  };
}

export async function collectPublicGitHubProfile(
  username: string,
  options: CollectPublicGitHubProfileOptions = {}
): Promise<CollectedGitHubProfile> {
  const normalizedUsername = normalizeRequiredGitHubUsername(username);
  const policy = options.policy ?? defaultGitHubCollectorPolicy;
  const validation = validateGitHubCollectorPolicy(policy);
  if (!validation.ok) {
    throw new GitHubCollectorError("invalid_policy", validation.errors.join(" "));
  }

  const fetcher = options.fetcher ?? globalThis.fetch?.bind(globalThis);
  if (fetcher === undefined) {
    throw new GitHubCollectorError("missing_fetch", "Buildmarks requires a fetch implementation to collect GitHub data.");
  }

  const client = new GitHubRestClient(fetcher, options.token, policy.limits.maxApiRequestsPerProfile);
  const repositories = await client.listUserRepositories(normalizedUsername, policy.limits.maxRepositoriesScannedPerProfile);
  const activeRepositories = repositories.filter((repository) =>
    wasPushedWithinWindow(repository.pushed_at, policy.limits.repositoryActivityWindowDays)
  );
  const collected = await collectRepositories(
    activeRepositories,
    policy.limits.maxConcurrentRepositoryCollections,
    (repository) => client.collectRepository(repository),
    () => client.abortPendingRequests()
  );

  return {
    username: normalizedUsername,
    collectedAt: new Date().toISOString(),
    activityWindowDays: policy.limits.repositoryActivityWindowDays,
    activityAggregatesDeferred,
    ...(collected.failureCount === 0 ? {} : { repositoryCollectionFailureCount: collected.failureCount }),
    repositoryCollectionAttemptCount: activeRepositories.length,
    ...(collected.failures.length === 0 ? {} : { repositoryCollectionFailures: collected.failures }),
    signalVisibility: publicOnlySignalVisibility,
    repositories: collected.repositories
  };
}

function normalizeRequiredGitHubUsername(username: string): string {
  const normalizedUsername = username.trim();
  if (normalizedUsername === "") {
    throw new GitHubCollectorError("invalid_policy", "GitHub username is required.");
  }

  return normalizedUsername;
}

class GitHubRestClient {
  private readonly batchAbortController = new AbortController();
  private requestCount = 0;

  constructor(
    private readonly fetcher: GitHubCollectorFetch,
    private readonly token: string | undefined,
    private readonly maxRequests: number
  ) {}

  abortPendingRequests(): void {
    this.batchAbortController.abort();
  }

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
    const perPage = Math.min(100, limit);

    while (repositories.length < limit) {
      const pageRepositories = await this.fetchJson<unknown>(
        `/users/${encodeURIComponent(username)}/repos?type=owner&sort=pushed&direction=desc&per_page=${perPage}&page=${page}`
      );

      if (!Array.isArray(pageRepositories)) {
        throw new GitHubCollectorError("invalid_github_response", "GitHub repository list response was not an array.");
      }

      const mapped = pageRepositories.map(asRepositoryResponse);
      repositories.push(...mapped.filter(isRepositoryCollectionCandidate));

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
    const perPage = 100;

    while (repositories.length < limit) {
      const pageRepositories = await this.fetchJson<unknown>(
        `/user/repos?visibility=all&affiliation=owner&sort=pushed&direction=desc&per_page=${perPage}&page=${page}`
      );

      if (!Array.isArray(pageRepositories)) {
        throw new GitHubCollectorError("invalid_github_response", "GitHub repository list response was not an array.");
      }

      const mapped = pageRepositories.map(asRepositoryResponse);
      repositories.push(...mapped.filter((repository) =>
        repository.owner.login.toLowerCase() === normalizedUsername && isRepositoryCollectionCandidate(repository)
      ));

      if (mapped.length < perPage) {
        break;
      }

      page += 1;
    }

    return repositories.slice(0, limit);
  }

  async collectRepository(
    repository: GitHubRepositoryResponse
  ): Promise<CollectedGitHubRepository> {
    const owner = repository.owner.login;
    const name = repository.name;
    const isPrivate = repository.private;
    const [community, readmeText, hasReleasesOrTags, treeEntries] = await Promise.all([
      withRepositoryCollectionOperation(
        "community_profile",
        this.fetchJson<GitHubCommunityProfileResponse>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/community/profile`, {
          allowMissing: true
        })
      ),
      isPrivate
        ? Promise.resolve(null)
        : withRepositoryCollectionOperation(
            "readme",
            this.fetchText(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/readme`, {
              accept: githubRawAccept,
              allowMissing: true
            })
          ),
      this.hasReleasesOrTags(owner, name),
      withRepositoryCollectionOperation("tree", this.fetchRepositoryTree(owner, name, repository.default_branch))
    ]);
    const fileSignals = this.collectFileSignals(treeEntries.entries, repository, treeEntries.truncated);
    const repositoryKind = detectRepositoryKindFromPaths(
      treeEntries.entries.map((entry) => entry.path),
      {
        sourceFileCount: fileSignals.codebaseShape.sourceFileCount,
        hasReadme: fileSignals.hasReadme,
        hasDemoOrDocs: fileSignals.hasDemoOrDocs || hasNonEmptyString(repository.homepage)
      }
    );
    const collected: CollectedGitHubRepository = {
      owner,
      name: isPrivate ? "Private repository" : name,
      repositoryKind: repositoryKind.kind,
      repositoryKindSource: repositoryKind.source,
      repositoryKindConfidence: repositoryKind.confidence,
      ...(isPrivate ? { unavailableObservations: ["usageGuide"] } : {}),
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
      hasReadme: treeSignals.hasReadme,
      hasLicense: treeSignals.hasLicense,
      hasUsageGuide: false,
      hasCi: treeSignals.hasCi,
      hasTests: treeSignals.hasTests,
      hasChangelog: treeSignals.hasChangelog,
      hasContributing: treeSignals.hasContributing,
      hasCodeOfConduct: treeSignals.hasCodeOfConduct,
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
      withRepositoryCollectionOperation(
        "releases",
        this.fetchJson<unknown>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases?per_page=1`, {
          allowMissing: true
        })
      ),
      withRepositoryCollectionOperation(
        "tags",
        this.fetchJson<unknown>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tags?per_page=1`, {
          allowMissing: true
        })
      )
    ]);

    return responseArrayHasItems(releases, "releases") || responseArrayHasItems(tags, "tags");
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

    const token = this.token?.trim();
    if (token !== undefined && token !== "") {
      headers.Authorization = `Bearer ${token}`;
    }

    let lastError: unknown;

    for (let attempt = 0; attempt <= githubRequestRetryCount; attempt += 1) {
      try {
        this.consumeRequestBudget(path);
        const response = await fetchWithTimeout(this.fetcher, `${githubApiBaseUrl}${path}`, {
          headers,
          timeoutMilliseconds: githubRequestTimeoutMilliseconds,
          signal: this.batchAbortController.signal
        });

        if (!shouldRetryResponse(response) || attempt === githubRequestRetryCount) {
          return response;
        }

        await sleep(retryDelayMilliseconds(attempt));
      } catch (error) {
        if (error instanceof GitHubCollectorError && error.code === "github_request_budget_exhausted") {
          throw error;
        }
        lastError = error;
        if (this.batchAbortController.signal.aborted || attempt === githubRequestRetryCount) {
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

  private consumeRequestBudget(path: string): void {
    if (this.requestCount >= this.maxRequests) {
      throw new GitHubCollectorError(
        "github_request_budget_exhausted",
        `GitHub API request budget of ${this.maxRequests} was exhausted while requesting ${path}.`
      );
    }
    this.requestCount += 1;
  }
}

function mergeCommunitySignals(
  fileSignals: CollectedRepositoryFileSignals,
  community: GitHubCommunityProfileResponse | null,
  readmeText: string | null
): CollectedRepositoryFileSignals {
  validateCommunityProfileResponse(community);
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

function validateCommunityProfileResponse(community: GitHubCommunityProfileResponse | null): void {
  if (community === null) {
    return;
  }
  if (typeof community !== "object" || Array.isArray(community)) {
    throw new GitHubCollectorError("invalid_github_response", "GitHub community profile response was not an object.");
  }
  if (
    community.files !== undefined &&
    (typeof community.files !== "object" || community.files === null || Array.isArray(community.files))
  ) {
    throw new GitHubCollectorError("invalid_github_response", "GitHub community profile files response was not an object.");
  }
  if (
    community.documentation !== undefined &&
    !isNullableObject(community.documentation) &&
    !isNonEmptyString(community.documentation)
  ) {
    throw new GitHubCollectorError(
      "invalid_github_response",
      "GitHub community profile documentation response was not a URL string, object, or null."
    );
  }
  if (community.files !== undefined) {
    const fileFields = [
      "code_of_conduct",
      "code_of_conduct_file",
      "contributing",
      "license",
      "readme"
    ] as const;

    fileFields.forEach((field) => {
      if (community.files?.[field] !== undefined && !isNullableObject(community.files[field])) {
        throw new GitHubCollectorError(
          "invalid_github_response",
          `GitHub community profile ${field} response was not an object or null.`
        );
      }
    });
  }
}

function isNullableObject(value: unknown): boolean {
  return value === null || (typeof value === "object" && !Array.isArray(value));
}

function isNonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim() !== "";
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
  collect: (repository: GitHubRepositoryResponse, index: number) => Promise<CollectedGitHubRepository>,
  abortBatch: () => void
): Promise<CollectedRepositoryBatch> {
  const results: Array<CollectedGitHubRepository | undefined> = new Array(repositories.length);
  const workerCount = Math.min(Math.max(1, concurrency), repositories.length);
  let nextIndex = 0;
  let failureCount = 0;
  const failures = new Map<string, RepositoryCollectionFailureSummary>();
  let fatalError: unknown;

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        if (fatalError !== undefined) {
          return;
        }
        const index = nextIndex;
        nextIndex += 1;
        const repository = repositories[index];
        if (repository === undefined) {
          return;
        }

        try {
          results[index] = await collect(repository, index);
        } catch (error) {
          if (shouldAbortRepositoryBatch(error)) {
            fatalError ??= error;
            abortBatch();
            return;
          }
          if (fatalError !== undefined) {
            return;
          }
          failureCount += 1;
          recordRepositoryCollectionFailure(failures, error);
        }
      }
    })
  );

  if (fatalError !== undefined) {
    throw fatalError;
  }

  return {
    repositories: results.filter((repository): repository is CollectedGitHubRepository => repository !== undefined),
    failureCount,
    failures: [...failures.values()].sort(compareRepositoryCollectionFailures)
  };
}

function recordRepositoryCollectionFailure(
  failures: Map<string, RepositoryCollectionFailureSummary>,
  error: unknown
): void {
  const code = error instanceof GitHubCollectorError ? error.code : "unknown_repository_collection_failure";
  const operation = repositoryCollectionOperation(error);
  const status = error instanceof GitHubCollectorError ? error.status : undefined;
  const key = `${code}:${operation}:${status ?? "none"}`;
  const current = failures.get(key);
  if (current !== undefined) {
    current.count += 1;
    return;
  }

  failures.set(key, {
    code,
    operation,
    ...(status === undefined ? {} : { status }),
    count: 1
  });
}

function repositoryCollectionOperation(error: unknown): RepositoryCollectionOperation {
  if (error instanceof Error) {
    const tagged = (error as Error & { [repositoryCollectionOperationSymbol]?: RepositoryCollectionOperation })[
      repositoryCollectionOperationSymbol
    ];
    if (tagged !== undefined) {
      return tagged;
    }
  }
  if (!(error instanceof Error)) {
    return "unknown";
  }
  if (error.message.includes("community profile")) {
    return "community_profile";
  }
  if (error.message.includes("/community/profile")) {
    return "community_profile";
  }
  if (error.message.includes("/readme")) {
    return "readme";
  }
  if (error.message.includes("/releases")) {
    return "releases";
  }
  if (error.message.includes("/tags")) {
    return "tags";
  }
  if (error.message.includes("/git/trees/")) {
    return "tree";
  }
  return "unknown";
}

async function withRepositoryCollectionOperation<T>(
  operation: RepositoryCollectionOperation,
  promise: Promise<T>
): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof Error) {
      Object.defineProperty(error, repositoryCollectionOperationSymbol, {
        value: operation,
        configurable: true
      });
    }
    throw error;
  }
}

function compareRepositoryCollectionFailures(
  left: RepositoryCollectionFailureSummary,
  right: RepositoryCollectionFailureSummary
): number {
  return left.code.localeCompare(right.code) ||
    left.operation.localeCompare(right.operation) ||
    (left.status ?? 0) - (right.status ?? 0);
}

function shouldAbortRepositoryBatch(error: unknown): boolean {
  return error instanceof GitHubCollectorError &&
    (error.code === "github_rate_limited" || error.code === "github_request_budget_exhausted");
}

function isRepositoryCollectionCandidate(repository: GitHubRepositoryResponse): boolean {
  return repository.fork === false && repository.archived === false;
}

function redactPrivateRepositoryError(
  error: unknown,
  repositories: readonly GitHubRepositoryResponse[]
): unknown {
  if (!(error instanceof GitHubCollectorError)) {
    return error;
  }

  let message = error.message;
  for (const repository of repositories) {
    if (!repository.private) {
      continue;
    }
    for (const identifier of new Set([repository.name, encodeURIComponent(repository.name)])) {
      message = message.replaceAll(identifier, "Private repository");
    }
  }

  return new GitHubCollectorError(error.code, message, {
    ...(error.status === undefined ? {} : { status: error.status }),
    ...(error.rateLimitReset === undefined ? {} : { rateLimitReset: error.rateLimitReset })
  });
}

function relabelPrivateRepositories(
  repositories: readonly CollectedGitHubRepository[]
): CollectedGitHubRepository[] {
  let privateOrdinal = 1;

  return repositories.map((repository) => {
    if (repository.visibility !== "private") {
      return repository;
    }

    const name = `Private repository ${privateOrdinal}`;
    privateOrdinal += 1;

    return {
      ...repository,
      name
    };
  });
}

interface CollectedRepositoryBatch {
  repositories: CollectedGitHubRepository[];
  failureCount: number;
  failures: RepositoryCollectionFailureSummary[];
}

function asRepositoryResponse(value: unknown): GitHubRepositoryResponse {
  if (typeof value !== "object" || value === null) {
    throw new GitHubCollectorError("invalid_github_response", "GitHub repository response item was not an object.");
  }

  const record = value as Record<string, unknown>;
  const owner = record.owner;
  if (
    typeof owner !== "object" ||
    owner === null ||
    typeof (owner as Record<string, unknown>).login !== "string" ||
    ((owner as Record<string, unknown>).login as string).trim() === ""
  ) {
    throw new GitHubCollectorError("invalid_github_response", "GitHub repository response was missing owner.login.");
  }
  const ownerLogin = ((owner as Record<string, unknown>).login as string).trim();

  const repository: GitHubRepositoryResponse = {
    owner: { login: ownerLogin },
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
  options: { headers: Record<string, string>; timeoutMilliseconds: number; signal: AbortSignal }
): Promise<Response> {
  const controller = new AbortController();
  const abortFromBatch = () => controller.abort();
  if (options.signal.aborted) {
    controller.abort();
  } else {
    options.signal.addEventListener("abort", abortFromBatch, { once: true });
  }
  const timeout = setTimeout(() => controller.abort(), options.timeoutMilliseconds);

  try {
    return await fetcher(url, {
      headers: options.headers,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
    options.signal.removeEventListener("abort", abortFromBatch);
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
  if (typeof value !== "string" || value.trim() === "") {
    throw new GitHubCollectorError("invalid_github_response", `GitHub repository response was missing ${key}.`);
  }

  return value.trim();
}

function optionalNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
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

function responseArrayHasItems(value: unknown, label: string): boolean {
  if (value === null) {
    return false;
  }
  if (!Array.isArray(value)) {
    throw new GitHubCollectorError("invalid_github_response", `GitHub ${label} response was not an array.`);
  }

  return value.length > 0;
}

function wasPushedWithinWindow(value: string | null, days: number, now = new Date()): boolean {
  if (value === null) {
    return false;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const ageMilliseconds = now.getTime() - date.getTime();

  return ageMilliseconds >= 0 && ageMilliseconds <= days * 24 * 60 * 60 * 1000;
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

interface GitHubTreeSummary {
  entries: GitHubTreeEntry[];
  truncated: boolean;
}
