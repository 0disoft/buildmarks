import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { appendWriteFailure, tryWriteTextFile } from "./write-output";
import {
  privateLocalSignalVisibility,
  publicOnlySignalVisibility,
  renderFallbackCard,
  renderUserSignalCard,
  scoreUserProfile,
  type RenderCardOptions,
  type CodebaseShapeSignals,
  type ProfileInput,
  type RepositoryInput
} from "../index";

export interface RenderCardFileOptions extends RenderCardOptions {}

export interface RenderCardFileResult {
  ok: boolean;
  inputPath: string;
  outputPath: string;
  fallback: boolean;
  error?: string;
}

export async function renderCardFile(
  inputPath: string,
  outputPath: string,
  options: RenderCardFileOptions = {}
): Promise<RenderCardFileResult> {
  const resolvedInputPath = resolve(inputPath);
  const resolvedOutputPath = resolve(outputPath);

  await mkdir(dirname(resolvedOutputPath), { recursive: true });

  try {
    const rawInput = await readFile(resolvedInputPath, "utf8");
    const profile = parseProfileInput(JSON.parse(rawInput));
    const report = scoreUserProfile(profile);
    const svg = renderUserSignalCard(report, options);

    await writeFile(resolvedOutputPath, svg, "utf8");

    return {
      ok: true,
      inputPath: resolvedInputPath,
      outputPath: resolvedOutputPath,
      fallback: false
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown render failure";
    const svg = renderFallbackCard("Buildmarks report is temporarily unavailable");
    const writeError = await tryWriteTextFile(resolvedOutputPath, svg);

    return {
      ok: false,
      inputPath: resolvedInputPath,
      outputPath: resolvedOutputPath,
      fallback: true,
      error: appendWriteFailure(message, "Fallback SVG", writeError)
    };
  }
}

async function main(args: readonly string[]): Promise<void> {
  const parsed = parseArgs(args);

  if (parsed.ok === false) {
    console.error(parsed.message);
    console.error("Usage: bun src/cli/render-card.ts <profile.json> <output.svg> [--report-href <href>]");
    process.exitCode = 2;
    return;
  }

  const result = await renderCardFile(parsed.inputPath, parsed.outputPath, {
    ...(parsed.reportHref === undefined ? {} : { reportHref: parsed.reportHref })
  });

  if (!result.ok) {
    console.error(`Buildmarks wrote fallback SVG: ${result.error ?? "unknown render failure"}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Buildmarks SVG written: ${result.outputPath}`);
}

function parseArgs(args: readonly string[]):
  | { ok: true; inputPath: string; outputPath: string; reportHref?: string }
  | { ok: false; message: string } {
  const positional: string[] = [];
  let reportHref: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === undefined) {
      continue;
    }

    if (arg === "--report-href") {
      const value = args[index + 1];
      if (value === undefined || value.trim() === "") {
        return { ok: false, message: "Missing value for --report-href." };
      }
      reportHref = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--")) {
      return { ok: false, message: `Unknown option: ${arg}` };
    }

    positional.push(arg);
  }

  const [inputPath, outputPath, ...extra] = positional;
  if (inputPath === undefined || inputPath.trim() === "") {
    return { ok: false, message: "Profile JSON path is required." };
  }
  if (outputPath === undefined || outputPath.trim() === "") {
    return { ok: false, message: "Output SVG path is required." };
  }
  if (extra.length > 0) {
    return { ok: false, message: `Unexpected positional argument: ${extra[0]}` };
  }

  return reportHref === undefined
    ? { ok: true, inputPath, outputPath }
    : { ok: true, inputPath, outputPath, reportHref };
}

if (import.meta.main) {
  await main(process.argv.slice(2));
}

export function parseProfileInput(value: unknown): ProfileInput {
  if (typeof value !== "object" || value === null) {
    throw new Error("profile input must be an object");
  }

  const record = value as Record<string, unknown>;
  if (typeof record.username !== "string" || record.username.trim() === "") {
    throw new Error("profile input must include username");
  }

  if (!Array.isArray(record.repositories)) {
    throw new Error("profile input must include repositories array");
  }

  const profile: ProfileInput = {
    username: record.username,
    repositories: record.repositories.map(parseRepositoryInput)
  };

  if (typeof record.generatedAt === "string") {
    profile.generatedAt = record.generatedAt;
  }

  const activityWindowDays = optionalPositiveInteger(record, "activityWindowDays");
  if (activityWindowDays !== undefined) {
    profile.activityWindowDays = activityWindowDays;
  }

  if (typeof record.activityAggregatesDeferred === "boolean") {
    profile.activityAggregatesDeferred = record.activityAggregatesDeferred;
  }

  const repositoryCollectionFailureCount = optionalNonNegativeInteger(record, "repositoryCollectionFailureCount");
  if (repositoryCollectionFailureCount !== undefined) {
    profile.repositoryCollectionFailureCount = repositoryCollectionFailureCount;
  }

  const signalVisibility = parseSignalVisibility(record.signalVisibility);
  if (signalVisibility !== undefined) {
    profile.signalVisibility = signalVisibility;
  }
  validateProfileSignalVisibility(profile);

  return profile;
}

function parseRepositoryInput(value: unknown): RepositoryInput {
  if (typeof value !== "object" || value === null) {
    throw new Error("repository input must be an object");
  }

  const record = value as Record<string, unknown>;
  const visibility = parseRepositoryVisibility(record.visibility);
  const redactedName = optionalBoolean(record, "redactedName");
  const name = requireString(record, "name");
  const url = optionalString(record, "url");
  validatePrivateRepositoryInput(record, { name, url, visibility, redactedName });

  const repository: RepositoryInput = {
    owner: requireString(record, "owner"),
    name,
    isFork: requireBoolean(record, "isFork"),
    isArchived: requireBoolean(record, "isArchived"),
    stars: requireNonNegativeInteger(record, "stars"),
    forks: requireNonNegativeInteger(record, "forks"),
    createdAt: requireNullableString(record, "createdAt"),
    pushedAt: requireNullableString(record, "pushedAt"),
    hasReadme: requireBoolean(record, "hasReadme"),
    hasLicense: requireBoolean(record, "hasLicense"),
    hasUsageGuide: requireBoolean(record, "hasUsageGuide"),
    hasCi: requireBoolean(record, "hasCi"),
    hasTests: requireBoolean(record, "hasTests"),
    hasChangelog: requireBoolean(record, "hasChangelog"),
    hasContributing: requireBoolean(record, "hasContributing"),
    hasCodeOfConduct: requireBoolean(record, "hasCodeOfConduct"),
    hasSecurityPolicy: requireBoolean(record, "hasSecurityPolicy"),
    hasReleases: requireBoolean(record, "hasReleases"),
    hasDemoOrDocs: requireBoolean(record, "hasDemoOrDocs"),
    hasPackageArtifact: requireBoolean(record, "hasPackageArtifact"),
    issueResponseCount: requireNonNegativeInteger(record, "issueResponseCount"),
    pullRequestReviewCount: requireNonNegativeInteger(record, "pullRequestReviewCount"),
    externalContributorCount: requireNonNegativeInteger(record, "externalContributorCount")
  };

  if (url !== undefined) {
    repository.url = url;
  }

  if (visibility !== undefined) {
    repository.visibility = visibility;
  }

  if (redactedName !== undefined) {
    repository.redactedName = redactedName;
  }

  const codebaseShape = parseCodebaseShape(record.codebaseShape);
  if (codebaseShape !== undefined) {
    repository.codebaseShape = codebaseShape;
  }

  return repository;
}

function parseCodebaseShape(value: unknown): CodebaseShapeSignals | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "object" || value === null) {
    throw new Error("repository input codebaseShape must be an object");
  }

  const record = value as Record<string, unknown>;
  const shape: CodebaseShapeSignals = {
    sourceFileCount: requireNonNegativeInteger(record, "sourceFileCount"),
    testFileCount: requireNonNegativeInteger(record, "testFileCount"),
    exampleFileCount: requireNonNegativeInteger(record, "exampleFileCount"),
    medianSourceFileBytes: requireNonNegativeNumber(record, "medianSourceFileBytes"),
    p90SourceFileBytes: requireNonNegativeNumber(record, "p90SourceFileBytes"),
    oversizedSourceFileCount: requireNonNegativeInteger(record, "oversizedSourceFileCount"),
    testToSourceRatio: requireNonNegativeNumber(record, "testToSourceRatio")
  };

  if (typeof record.treeTruncated === "boolean") {
    shape.treeTruncated = record.treeTruncated;
  }

  return shape;
}

function parseSignalVisibility(value: unknown): ProfileInput["signalVisibility"] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "object" || value === null) {
    throw new Error("signalVisibility must be an object");
  }

  const record = value as Record<string, unknown>;
  const scope = record.scope;
  const reportVisibility = record.reportVisibility;

  if (scope !== "public-only" && scope !== "public-and-owner-supplied-private") {
    throw new Error("signalVisibility.scope is invalid");
  }

  if (reportVisibility !== "public-safe" && reportVisibility !== "private-local") {
    throw new Error("signalVisibility.reportVisibility is invalid");
  }

  const disclosure: ProfileInput["signalVisibility"] = {
    scope,
    privateRepositoriesIncluded: requireBoolean(record, "privateRepositoriesIncluded"),
    privateRepositoryNamesRedacted: requireBoolean(record, "privateRepositoryNamesRedacted"),
    independentlyVerifiable: requireBoolean(record, "independentlyVerifiable"),
    cardLabel: requireString(record, "cardLabel"),
    reportVisibility
  };

  validateSignalVisibilityDisclosure(disclosure);

  return disclosure;
}

function validateSignalVisibilityDisclosure(disclosure: NonNullable<ProfileInput["signalVisibility"]>): void {
  if (disclosure.privateRepositoriesIncluded) {
    if (
      disclosure.scope !== privateLocalSignalVisibility.scope ||
      disclosure.privateRepositoryNamesRedacted !== privateLocalSignalVisibility.privateRepositoryNamesRedacted ||
      disclosure.independentlyVerifiable !== privateLocalSignalVisibility.independentlyVerifiable ||
      disclosure.reportVisibility !== privateLocalSignalVisibility.reportVisibility
    ) {
      throw new Error("private-local signalVisibility fields are inconsistent");
    }
    return;
  }

  if (
    disclosure.scope !== publicOnlySignalVisibility.scope ||
    disclosure.privateRepositoryNamesRedacted !== publicOnlySignalVisibility.privateRepositoryNamesRedacted ||
    disclosure.independentlyVerifiable !== publicOnlySignalVisibility.independentlyVerifiable ||
    disclosure.reportVisibility !== publicOnlySignalVisibility.reportVisibility
  ) {
    throw new Error("public-only signalVisibility fields are inconsistent");
  }
}

function validateProfileSignalVisibility(profile: ProfileInput): void {
  const hasPrivateRepositories = profile.repositories.some((repository) => repository.visibility === "private");
  if (hasPrivateRepositories && profile.signalVisibility?.privateRepositoriesIncluded !== true) {
    throw new Error("private repository input requires private-local signalVisibility disclosure");
  }
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`repository input must include non-empty string ${key}`);
  }

  return value;
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`repository input ${key} must be a non-empty string when provided`);
  }

  return value;
}

function optionalBoolean(record: Record<string, unknown>, key: string): boolean | undefined {
  const value = record[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new Error(`repository input ${key} must be a boolean when provided`);
  }

  return value;
}

function parseRepositoryVisibility(value: unknown): RepositoryInput["visibility"] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value !== "public" && value !== "private") {
    throw new Error("repository input visibility must be public or private when provided");
  }

  return value;
}

function validatePrivateRepositoryInput(
  record: Record<string, unknown>,
  options: {
    name: string;
    url: string | undefined;
    visibility: RepositoryInput["visibility"] | undefined;
    redactedName: boolean | undefined;
  }
): void {
  if (options.visibility !== "private" && options.redactedName === true) {
    throw new Error("redacted repository input must set visibility to private");
  }
  if (options.visibility !== "private" && isRedactedPrivateRepositoryName(options.name)) {
    throw new Error("redacted repository input must set visibility to private");
  }
  if (options.visibility !== "private") {
    return;
  }
  if (options.redactedName !== true) {
    throw new Error("private repository input must set redactedName to true");
  }
  if (options.url !== undefined) {
    throw new Error("private repository input must omit repository url");
  }
  if (!isRedactedPrivateRepositoryName(options.name)) {
    throw new Error("private repository input name must be redacted as Private repository or Private repository N");
  }
  if (record.owner !== undefined && typeof record.owner === "string" && record.owner.trim() === "") {
    throw new Error("private repository input owner must not be empty");
  }
}

function isRedactedPrivateRepositoryName(value: string): boolean {
  return /^Private repository(?: [1-9][0-9]*)?$/.test(value);
}

function requireNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === null || typeof value === "string") {
    return value;
  }

  throw new Error(`repository input must include string or null ${key}`);
}

function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== "boolean") {
    throw new Error(`repository input must include boolean ${key}`);
  }

  return value;
}

function requireNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`repository input must include finite number ${key}`);
  }

  return value;
}

function requireNonNegativeNumber(record: Record<string, unknown>, key: string): number {
  const value = requireNumber(record, key);
  if (value < 0) {
    throw new Error(`repository input must include non-negative number ${key}`);
  }

  return value;
}

function requireNonNegativeInteger(record: Record<string, unknown>, key: string): number {
  const value = requireNonNegativeNumber(record, key);
  if (!Number.isInteger(value)) {
    throw new Error(`repository input must include integer ${key}`);
  }

  return value;
}

function optionalNonNegativeInteger(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
    throw new Error(`profile input ${key} must be a non-negative integer`);
  }

  return value;
}

function optionalPositiveInteger(record: Record<string, unknown>, key: string): number | undefined {
  const value = optionalNonNegativeInteger(record, key);
  if (value === undefined) {
    return undefined;
  }
  if (value <= 0) {
    throw new Error(`profile input ${key} must be a positive integer`);
  }

  return value;
}
