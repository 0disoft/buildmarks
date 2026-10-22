import { githubRequestPolicy } from "./request-policy.js";
import { RepositoryRequestScope } from "./request-scope.js";
import { collectTreePathSignals, summarizeCodebaseShape, type GitHubTreeEntry } from "./repository-tree-signals.js";
import { GitHubCollectorError } from "./github-errors.js";
import { fetchWithTimeout } from "./request-timeout.js";
import { resolveCollectorRuntime, type GitHubCollectorRuntime } from "./runtime.js";
import { cancellationError, isAbortError, runAbortable, throwIfCancelled } from "../shared/cancellation.js";
import { isTransientReadError, readWithRetry } from "./read-retry.js";
import { redactErrorCause } from "./github-errors.js";
import { resolveEvaluationTime } from "../shared/evaluation-time.js";
import { defaultGitHubRequestLimiter, type GitHubRequestLimiter } from "./request-limiter.js";
import { readBoundedText } from "./response-body.js";
import { createRepositoryIndex } from "./repository-index.js";
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
  copyGitHubCollectorPolicy,
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
const githubRequestTimeoutMilliseconds = githubRequestPolicy.timeoutMilliseconds;
const githubRequestRetryCount = githubRequestPolicy.retryCount;

const usageGuidePattern = /\b(install|installation|usage|example|quick start|get started|getting started)\b|설치|사용법|예제|시작하기/i;
export type GitHubCollectorFetch = (url: string, init: RequestInit) => Promise<Response>;

export interface CollectPublicGitHubProfileOptions {
  policy?: GitHubCollectorPolicy;
  token?: string;
  fetcher?: GitHubCollectorFetch;
  now?: Date;
  signal?: AbortSignal;
  timeoutMilliseconds?: number;
  /** Optional wall-clock limit shared by pagination, detail reads and retry waits. */
  collectionTimeoutMilliseconds?: number;
  /** Reuse across calls; the default instance is shared within this module's process. */
  requestLimiter?: GitHubRequestLimiter;
  maxResponseBytes?: number;
  maxTreeEntries?: number;
  runtime?: Partial<GitHubCollectorRuntime>;
}

export async function collectOwnerSuppliedGitHubProfile(
  username: string,
  options: CollectPublicGitHubProfileOptions = {}
): Promise<CollectedGitHubProfile> {
  const context = prepareGitHubCollection(username, options, "private-local");
  const { client, policy, now } = context;
  try {
    await client.assertAuthenticatedOwner(context.username);
    const repositories = await client.listAuthenticatedOwnerRepositories(
      context.username, policy.limits.maxRepositoriesScannedPerProfile
    );
    const activeRepositories = repositories.filter(repository =>
      wasPushedWithinWindow(repository.pushed_at, policy.limits.repositoryActivityWindowDays, now)
    );
    let collected: CollectedRepositoryBatch;
    try {
      collected = await collectRepositoryBatch(client, activeRepositories, policy);
    } catch (error) {
      throw redactPrivateRepositoryError(error, activeRepositories);
    }
    client.assertActive();
    return buildCollectedProfile(context, activeRepositories.length, collected, relabelPrivateRepositories(collected.repositories));
  } finally { client.dispose(); }
}

export async function collectPublicGitHubProfile(
  username: string,
  options: CollectPublicGitHubProfileOptions = {}
): Promise<CollectedGitHubProfile> {
  const context = prepareGitHubCollection(username, options, "public-only");
  const { client, policy, now } = context;
  try {
    const repositories = await client.listUserRepositories(context.username, policy.limits.maxRepositoriesScannedPerProfile);
    const activeRepositories = repositories.filter(repository =>
      wasPushedWithinWindow(repository.pushed_at, policy.limits.repositoryActivityWindowDays, now)
    );
    const collected = await collectRepositoryBatch(client, activeRepositories, policy);
    client.assertActive();
    return buildCollectedProfile(context, activeRepositories.length, collected, collected.repositories);
  } finally { client.dispose(); }
}

function prepareGitHubCollection(
  username: string, options: CollectPublicGitHubProfileOptions, mode: "public-only" | "private-local"
) {
  const signal = options.signal;
  throwIfCancelled(signal);
  const now = resolveEvaluationTime(options.now);
  const normalizedUsername = normalizeRequiredGitHubUsername(username);
  const requestedPolicy = options.policy ?? (mode === "private-local" ? privateLocalGitHubCollectorPolicy : defaultGitHubCollectorPolicy);
  const validation = validateGitHubCollectorPolicy(requestedPolicy, { mode });
  if (!validation.ok) throw new GitHubCollectorError("invalid_policy", validation.errors.join(" "));
  if (mode === "private-local" && (options.token === undefined || options.token.trim() === "")) {
    throw new GitHubCollectorError(
      "invalid_policy", "Private-local collection requires an explicitly supplied read-only GitHub token."
    );
  }
  const fetcher = options.fetcher ?? globalThis.fetch?.bind(globalThis);
  if (fetcher === undefined) {
    throw new GitHubCollectorError("missing_fetch", "Buildmarks requires a fetch implementation to collect GitHub data.");
  }
  const policy = copyGitHubCollectorPolicy(requestedPolicy);
  const client = new GitHubRestClient(fetcher, options.token, policy.limits.maxApiRequestsPerProfile, options);
  return { username: normalizedUsername, now, policy, client, signal };
}

type GitHubCollectionContext = ReturnType<typeof prepareGitHubCollection>;

function collectRepositoryBatch(client: GitHubRestClient, repositories: readonly GitHubRepositoryResponse[], policy: GitHubCollectorPolicy) {
  return collectRepositories(
    repositories, policy.limits.maxConcurrentRepositoryCollections,
    repository => client.collectRepository(repository), () => client.abortPendingRequests()
  );
}

function buildCollectedProfile(
  context: GitHubCollectionContext, attempted: number, collected: CollectedRepositoryBatch,
  repositories: CollectedGitHubRepository[]
): CollectedGitHubProfile {
  const includesPrivateRepositories = repositories.some(repository => repository.visibility === "private");
  return {
    username: context.username,
    collectedAt: context.now.toISOString(),
    activityWindowDays: context.policy.limits.repositoryActivityWindowDays,
    activityAggregatesDeferred,
    ...(collected.failureCount === 0 ? {} : { repositoryCollectionFailureCount: collected.failureCount }),
    repositoryCollectionAttemptCount: attempted,
    ...(collected.failures.length === 0 ? {} : { repositoryCollectionFailures: collected.failures }),
    signalVisibility: { ...(includesPrivateRepositories ? privateLocalSignalVisibility : publicOnlySignalVisibility) },
    repositories
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
  private readonly runtime: GitHubCollectorRuntime;
  private readonly timeoutMilliseconds: number;
  private readonly callerSignal: AbortSignal | undefined;
  private readonly requestLimiter: GitHubRequestLimiter;
  private readonly maxResponseBytes: number;
  private readonly maxTreeEntries: number;
  private cancelCollectionTimeout = () => {};
  private readonly abortFromCaller = () => this.batchAbortController.abort(cancellationError(this.callerSignal!));

  constructor(
    private readonly fetcher: GitHubCollectorFetch,
    private readonly token: string | undefined,
    private readonly maxRequests: number,
    options: CollectPublicGitHubProfileOptions
  ) {
    this.runtime = resolveCollectorRuntime(options.runtime);
    this.requestLimiter = options.requestLimiter ?? defaultGitHubRequestLimiter;
    this.maxResponseBytes = options.maxResponseBytes ?? githubRequestPolicy.maximumResponseBytes;
    this.maxTreeEntries = options.maxTreeEntries ?? githubRequestPolicy.maximumTreeEntries;
    for (const [label, limit] of [["Response byte limit", this.maxResponseBytes], ["Tree entry limit", this.maxTreeEntries]] as const) {
      if (!Number.isSafeInteger(limit) || limit <= 0) throw new GitHubCollectorError("invalid_policy", `${label} must be a positive safe integer.`);
    }
    this.timeoutMilliseconds = options.timeoutMilliseconds ?? githubRequestTimeoutMilliseconds;
    if (!Number.isSafeInteger(this.timeoutMilliseconds) || this.timeoutMilliseconds <= 0 || this.timeoutMilliseconds > githubRequestPolicy.maximumTimerMilliseconds) {
      throw new GitHubCollectorError("invalid_policy", `Request timeout must be a positive integer at most ${githubRequestPolicy.maximumTimerMilliseconds} milliseconds.`);
    }
    this.callerSignal = options.signal;
    throwIfCancelled(this.callerSignal);
    const collectionTimeout = options.collectionTimeoutMilliseconds;
    if (collectionTimeout !== undefined) {
      if (!Number.isSafeInteger(collectionTimeout) || collectionTimeout <= 0 || collectionTimeout > githubRequestPolicy.maximumTimerMilliseconds) {
        throw new GitHubCollectorError("invalid_policy", `Collection timeout must be a positive integer at most ${githubRequestPolicy.maximumTimerMilliseconds} milliseconds.`);
      }
      this.cancelCollectionTimeout = this.runtime.scheduleTimeout(() => this.batchAbortController.abort(
        new GitHubCollectorError("github_collection_timeout", "GitHub profile collection exceeded its total time limit.", {
          cause: new DOMException("Collection deadline exceeded.", "TimeoutError")
        })
      ), collectionTimeout);
    }
    if (this.callerSignal?.aborted) this.abortFromCaller();
    else this.callerSignal?.addEventListener("abort", this.abortFromCaller, { once: true });
  }

  dispose(): void {
    this.abortPendingRequests();
    this.callerSignal?.removeEventListener("abort", this.abortFromCaller);
    this.cancelCollectionTimeout();
  }

  assertActive(): void {
    throwIfCancelled(this.callerSignal);
    this.batchAbortController.signal.throwIfAborted();
  }

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
    const index = createRepositoryIndex<GitHubRepositoryResponse>();
    let page = 1;
    const perPage = Math.min(githubRequestPolicy.maximumPageSize, limit);

    while (repositories.length < limit) {
      const pageRepositories = await this.fetchJson<unknown>(
        `/users/${encodeURIComponent(username)}/repos?type=owner&sort=pushed&direction=desc&per_page=${perPage}&page=${page}`
      );

      if (!Array.isArray(pageRepositories)) {
        throw new GitHubCollectorError("invalid_github_response", "GitHub repository list response was not an array.");
      }

      const mapped = pageRepositories.map(asRepositoryResponse);
      for (const repository of mapped) {
        if (isRepositoryCollectionCandidate(repository) && index.add(repository)) repositories.push(repository);
      }

      if (mapped.length < perPage) {
        break;
      }

      page += 1;
    }

    return repositories.slice(0, limit);
  }

  async listAuthenticatedOwnerRepositories(username: string, limit: number): Promise<GitHubRepositoryResponse[]> {
    const repositories: GitHubRepositoryResponse[] = [];
    const index = createRepositoryIndex<GitHubRepositoryResponse>();
    let page = 1;
    const normalizedUsername = username.toLowerCase();
    const perPage = githubRequestPolicy.maximumPageSize;

    while (repositories.length < limit) {
      const pageRepositories = await this.fetchJson<unknown>(
        `/user/repos?visibility=all&affiliation=owner&sort=pushed&direction=desc&per_page=${perPage}&page=${page}`
      );

      if (!Array.isArray(pageRepositories)) {
        throw new GitHubCollectorError("invalid_github_response", "GitHub repository list response was not an array.");
      }

      const mapped = pageRepositories.map(asRepositoryResponse);
      for (const repository of mapped) {
        if (repository.owner.login.toLowerCase() === normalizedUsername && isRepositoryCollectionCandidate(repository) && index.add(repository)) repositories.push(repository);
      }

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
    const scope = new RepositoryRequestScope(this.batchAbortController.signal);
    try {
      const [community, readmeText, hasReleasesOrTags, treeEntries] = await scope.settle([
        scope.track(withRepositoryCollectionOperation(
          "community_profile",
          this.fetchJson<GitHubCommunityProfileResponse>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/community/profile`, {
            allowMissing: true, signal: scope.signal
          })
        )),
        isPrivate
          ? Promise.resolve(null)
          : scope.track(withRepositoryCollectionOperation(
              "readme",
              this.fetchText(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/readme`, {
                accept: githubRawAccept,
                allowMissing: true, signal: scope.signal
              })
            )),
        this.hasReleasesOrTags(owner, name, scope),
        scope.track(withRepositoryCollectionOperation("tree", this.fetchRepositoryTree(owner, name, repository.default_branch, scope.signal)))
      ] as const);
      const fileSignals = this.collectFileSignals(treeEntries.entries, repository, treeEntries.truncated);
      return buildCollectedRepository(repository, treeEntries, fileSignals, community, readmeText, hasReleasesOrTags);
    } finally { scope.dispose(); }
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

  async fetchRepositoryTree(owner: string, repo: string, branch: string, signal: AbortSignal): Promise<GitHubTreeSummary> {
    const tree = await this.fetchJson<GitHubTreeResponse>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      { signal }
    );

    if (tree === null) {
      throw new GitHubCollectorError("invalid_github_response", "GitHub tree response was null.");
    }

    if (!Array.isArray(tree.tree)) {
      throw new GitHubCollectorError("invalid_github_response", "GitHub tree response was missing tree array.");
    }
    if (tree.tree.length > this.maxTreeEntries) {
      throw new GitHubCollectorError("github_tree_too_large", `GitHub tree exceeded the ${this.maxTreeEntries}-entry limit.`);
    }
    if (tree.truncated !== undefined && typeof tree.truncated !== "boolean") {
      throw new GitHubCollectorError("invalid_github_response", "GitHub tree truncation flag was not boolean.");
    }

    return {
      entries: tree.tree.map((item) => {
        if (typeof item !== "object" || item === null || typeof item.path !== "string" || item.path.trim() === "" ||
            (item.type !== undefined && typeof item.type !== "string") ||
            (item.size !== undefined && (typeof item.size !== "number" || !Number.isFinite(item.size) || item.size < 0))) {
          throw new GitHubCollectorError("invalid_github_response", "GitHub tree contained an invalid entry.");
        }

        const entry: GitHubTreeEntry = { path: item.path };
        if (typeof item.type === "string") {
          entry.type = item.type;
        }
        if (typeof item.size === "number" && Number.isFinite(item.size)) {
          entry.size = Math.max(0, item.size);
        }

        return entry;
      }),
      truncated: tree.truncated === true
    };
  }

  async hasReleasesOrTags(owner: string, repo: string, scope: RepositoryRequestScope): Promise<boolean> {
    const [releases, tags] = await scope.settle([
      scope.track(withRepositoryCollectionOperation(
        "releases",
        this.fetchJson<unknown>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases?per_page=1`, {
          allowMissing: true, signal: scope.signal
        })
      )),
      scope.track(withRepositoryCollectionOperation(
        "tags",
        this.fetchJson<unknown>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tags?per_page=1`, {
          allowMissing: true, signal: scope.signal
        })
      ))
    ] as const);

    return responseArrayHasItems(releases, "releases") || responseArrayHasItems(tags, "tags");
  }

  async fetchJson<T>(path: string, options: { allowMissing?: boolean; signal?: AbortSignal } = {}): Promise<T | null> {
    return this.request(path, { accept: githubJsonAccept }, async (response, signal) => {
      if (isMissingResponse(response) && options.allowMissing === true) {
        return null;
      }

      await assertOkResponse(response, path);
      return JSON.parse(await readBoundedText(response, this.maxResponseBytes, signal, this.runtime.onCleanupError)) as T;
    }, options.signal);
  }

  async fetchText(
    path: string,
    options: { accept?: string; allowMissing?: boolean; signal?: AbortSignal } = {}
  ): Promise<string | null> {
    return this.request(path, { accept: options.accept ?? githubJsonAccept }, async (response, signal) => {
      if (isMissingResponse(response) && options.allowMissing === true) {
        return null;
      }

      await assertOkResponse(response, path);
      return readBoundedText(response, this.maxResponseBytes, signal, this.runtime.onCleanupError);
    }, options.signal);
  }

  private async request<T>(
    path: string, options: { accept: string }, consume: (response: Response, signal: AbortSignal) => Promise<T>,
    signal: AbortSignal = this.batchAbortController.signal
  ): Promise<T> {
    const headers = buildRequestHeaders(options.accept, this.token);
    try {
      return await readWithRetry(
        attempt => this.requestAttempt(path, headers, attempt, consume, signal),
        attempt => this.waitForRetry(attempt, signal), signal
      );
    } catch (error) {
      throwIfCancelled(this.callerSignal);
      signal.throwIfAborted();
      if (!isTransientReadError(error)) throw error;
      throw new GitHubCollectorError(
        "github_request_failed",
        `GitHub API request failed before its response was fully read while requesting ${path}: ${errorMessage(error)}`,
        { cause: error }
      );
    }
  }

  private async requestAttempt<T>(
    path: string,
    headers: Record<string, string>,
    attempt: number,
    consume: (response: Response, signal: AbortSignal) => Promise<T>,
    signal: AbortSignal
  ): Promise<RequestAttemptResult<T>> {
    throwIfCancelled(this.callerSignal);
    this.batchAbortController.signal.throwIfAborted();
    signal.throwIfAborted();
    const release = await this.requestLimiter.acquire(signal);
    try {
      this.assertActive();
      signal.throwIfAborted();
      this.consumeRequestBudget(path);
      return await fetchWithTimeout(this.fetcher, `${githubApiBaseUrl}${path}`, {
        headers,
        timeoutMilliseconds: this.timeoutMilliseconds,
        signal,
        scheduleTimeout: this.runtime.scheduleTimeout,
        ...(this.runtime.onCleanupError === undefined ? {} : { onCleanupError: this.runtime.onCleanupError })
      }, (response, requestSignal) => consumeRequestAttempt(response, path, attempt, value => consume(value, requestSignal)));
    } finally { release(); }
  }

  private async waitForRetry(attempt: number, signal: AbortSignal): Promise<void> {
    await runAbortable(() => this.runtime.sleep(retryDelayMilliseconds(attempt), signal), signal);
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

type RequestAttemptResult<T> = { retry: true } | { retry: false; value: T };

function buildRequestHeaders(accept: string, token: string | undefined): Record<string, string> {
  const normalizedToken = token?.trim();
  return {
    Accept: accept,
    "X-GitHub-Api-Version": githubApiVersion,
    ...(normalizedToken ? { Authorization: `Bearer ${normalizedToken}` } : {})
  };
}

function requestResponseAction(response: Response, attempt: number): "rate-limit" | "retry" | "consume" {
  if (isRateLimitResponse(response)) return "rate-limit";
  if (shouldRetryResponse(response) && attempt < githubRequestRetryCount) return "retry";
  return "consume";
}

async function consumeRequestAttempt<T>(
  response: Response, path: string, attempt: number, consume: (response: Response) => Promise<T>
): Promise<RequestAttemptResult<T>> {
  const action = requestResponseAction(response, attempt);
  if (action === "rate-limit") {
    // fetchWithTimeout owns non-blocking body cleanup for every response status.
    await assertOkResponse(response, path);
  }
  if (action === "retry") {
    return { retry: true };
  }
  return { retry: false, value: await consume(response) };
}

function buildCollectedRepository(
  repository: GitHubRepositoryResponse, treeEntries: GitHubTreeSummary,
  fileSignals: CollectedRepositoryFileSignals, community: GitHubCommunityProfileResponse | null,
  readmeText: string | null, hasReleasesOrTags: boolean
): CollectedGitHubRepository {
  const isPrivate = repository.private;
  const repositoryKind = detectRepositoryKindFromPaths(
    treeEntries.entries.map((entry) => entry.path),
    {
      sourceFileCount: fileSignals.codebaseShape.sourceFileCount,
      hasReadme: fileSignals.hasReadme,
      hasDemoOrDocs: fileSignals.hasDemoOrDocs || hasNonEmptyString(repository.homepage)
    }
  );
  return {
    owner: repository.owner.login,
    name: isPrivate ? "Private repository" : repository.name,
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
    activity: emptyActivitySignals(),
    visibility: isPrivate ? "private" : "public",
    ...(isPrivate ? { redactedName: true } : {}),
    ...(!isPrivate && repository.html_url !== null ? { url: repository.html_url } : {})
  };
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
  const state: RepositoryBatchState = {
    results: new Array(repositories.length), nextIndex: 0, failureCount: 0,
    failures: new Map(), fatalError: undefined
  };
  const workerCount = Math.min(Math.max(1, concurrency), repositories.length);
  await Promise.all(Array.from({ length: workerCount }, () =>
    runRepositoryWorker(state, repositories, collect, abortBatch)
  ));
  if (state.fatalError !== undefined) throw state.fatalError;
  return {
    repositories: state.results.filter((repository): repository is CollectedGitHubRepository => repository !== undefined),
    failureCount: state.failureCount,
    failures: [...state.failures.values()].sort(compareRepositoryCollectionFailures)
  };
}

/** Mutable scheduling and aggregation state owned by a single collection call. */
interface RepositoryBatchState {
  results: Array<CollectedGitHubRepository | undefined>;
  nextIndex: number;
  failureCount: number;
  failures: Map<string, RepositoryCollectionFailureSummary>;
  fatalError: unknown;
}

async function runRepositoryWorker(
  state: RepositoryBatchState,
  repositories: readonly GitHubRepositoryResponse[],
  collect: (repository: GitHubRepositoryResponse, index: number) => Promise<CollectedGitHubRepository>,
  abortBatch: () => void
): Promise<void> {
  while (state.fatalError === undefined) {
    const index = state.nextIndex++;
    const repository = repositories[index];
    if (repository === undefined) return;
    try {
      state.results[index] = await collect(repository, index);
    } catch (error) {
      if (shouldAbortRepositoryBatch(originalCollectionError(error))) {
        state.fatalError ??= originalCollectionError(error);
        abortBatch();
        return;
      }
      if (state.fatalError !== undefined) return;
      state.failureCount += 1;
      recordRepositoryCollectionFailure(state.failures, error);
    }
  }
}

function recordRepositoryCollectionFailure(
  failures: Map<string, RepositoryCollectionFailureSummary>,
  failure: unknown
): void {
  const error = originalCollectionError(failure);
  const code = error instanceof GitHubCollectorError ? error.code : "unknown_repository_collection_failure";
  const operation = repositoryCollectionOperation(failure);
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
  if (error instanceof RepositoryCollectionError) return error.operation;
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
    throw new RepositoryCollectionError(error, operation);
  }
}

/** Operation metadata belongs to this collection, never to a caller's error. */
class RepositoryCollectionError {
  constructor(readonly error: unknown, readonly operation: RepositoryCollectionOperation) {}
}

function originalCollectionError(error: unknown): unknown {
  return error instanceof RepositoryCollectionError ? error.error : error;
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
  return isAbortError(error) || error instanceof GitHubCollectorError &&
    (error.code === "github_rate_limited" || error.code === "github_request_budget_exhausted" || error.code === "github_collection_timeout" || error.code === "github_request_queue_full");
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

  const identifiers = repositories.filter(repository => repository.private)
    .flatMap(repository => [repository.name, encodeURIComponent(repository.name)]);
  const redact = (text: string) => identifiers.reduce((value, identifier) => value.replaceAll(identifier, "Private repository"), text);

  return new GitHubCollectorError(error.code, redact(error.message), {
    ...("cause" in error ? { cause: redactErrorCause(error.cause, redact) } : {}),
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

function shouldRetryResponse(response: Response): boolean {
  return response.status >= 500 && response.status <= 599;
}

function retryDelayMilliseconds(attempt: number): number {
  return githubRequestPolicy.retryBaseDelayMilliseconds + attempt * githubRequestPolicy.retryStepDelayMilliseconds;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
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

function wasPushedWithinWindow(value: string | null, days: number, now: Date): boolean {
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
