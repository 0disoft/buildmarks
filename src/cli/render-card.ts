import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  renderFallbackCard,
  renderUserSignalCard,
  scoreUserProfile,
  type ProfileInput,
  type RepositoryInput
} from "../index";

export interface RenderCardFileResult {
  ok: boolean;
  inputPath: string;
  outputPath: string;
  fallback: boolean;
  error?: string;
}

export async function renderCardFile(
  inputPath: string,
  outputPath: string
): Promise<RenderCardFileResult> {
  const resolvedInputPath = resolve(inputPath);
  const resolvedOutputPath = resolve(outputPath);

  await mkdir(dirname(resolvedOutputPath), { recursive: true });

  try {
    const rawInput = await readFile(resolvedInputPath, "utf8");
    const profile = parseProfileInput(JSON.parse(rawInput));
    const report = scoreUserProfile(profile);
    const svg = renderUserSignalCard(report);

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

    await writeFile(resolvedOutputPath, svg, "utf8");

    return {
      ok: false,
      inputPath: resolvedInputPath,
      outputPath: resolvedOutputPath,
      fallback: true,
      error: message
    };
  }
}

async function main(args: readonly string[]): Promise<void> {
  const [inputPath, outputPath] = args;

  if (inputPath === undefined || outputPath === undefined) {
    console.error("Usage: bun src/cli/render-card.ts <profile.json> <output.svg>");
    process.exitCode = 2;
    return;
  }

  const result = await renderCardFile(inputPath, outputPath);

  if (!result.ok) {
    console.error(`Buildmarks wrote fallback SVG: ${result.error ?? "unknown render failure"}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Buildmarks SVG written: ${result.outputPath}`);
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

  return profile;
}

function parseRepositoryInput(value: unknown): RepositoryInput {
  if (typeof value !== "object" || value === null) {
    throw new Error("repository input must be an object");
  }

  const record = value as Record<string, unknown>;
  const repository: RepositoryInput = {
    owner: requireString(record, "owner"),
    name: requireString(record, "name"),
    isFork: requireBoolean(record, "isFork"),
    isArchived: requireBoolean(record, "isArchived"),
    stars: requireNumber(record, "stars"),
    forks: requireNumber(record, "forks"),
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
    issueResponseCount: requireNumber(record, "issueResponseCount"),
    pullRequestReviewCount: requireNumber(record, "pullRequestReviewCount"),
    externalContributorCount: requireNumber(record, "externalContributorCount")
  };

  if (typeof record.url === "string") {
    repository.url = record.url;
  }

  return repository;
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string") {
    throw new Error(`repository input must include string ${key}`);
  }

  return value;
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
