import {
  repositoryKinds,
  type AssessmentConfidence,
  type RepositoryInput,
  type RepositoryKind,
  type RepositoryKindAssessment
} from "../shared/types.js";
import { codebaseShapeMetric } from "./codebase-shape.js";

const packageManifestNames = new Set([
  "package.json",
  "pyproject.toml",
  "cargo.toml",
  "go.mod",
  "deno.json",
  "pubspec.yaml",
  "composer.json",
  "gemfile",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts"
]);

const workspaceMarkers = new Set([
  "pnpm-workspace.yaml",
  "turbo.json",
  "nx.json",
  "lerna.json"
]);

export interface RepositoryKindDetectionContext {
  sourceFileCount: number;
  hasReadme: boolean;
  hasDemoOrDocs: boolean;
}

export function resolveRepositoryKind(repository: RepositoryInput): RepositoryKindAssessment {
  if (repositoryKinds.includes(repository.repositoryKind as RepositoryKind)) {
    const source = repository.repositoryKindSource ?? "declared";
    return {
      kind: repository.repositoryKind as RepositoryKind,
      source,
      confidence: repository.repositoryKindConfidence ?? confidenceForSource(source)
    };
  }

  const sourceFileCount = codebaseShapeMetric(repository.codebaseShape?.sourceFileCount);
  if (
    sourceFileCount <= 2 &&
    repository.hasReadme === true &&
    repository.hasDemoOrDocs === true
  ) {
    return { kind: "documentation", source: "inferred", confidence: "medium" };
  }

  if (
    sourceFileCount > 0 &&
    sourceFileCount <= 10 &&
    repository.hasPackageArtifact !== true &&
    repository.hasReleases !== true &&
    repository.hasCi !== true
  ) {
    return { kind: "experiment", source: "inferred", confidence: "medium" };
  }

  return { kind: "general", source: "fallback", confidence: "low" };
}

export function detectRepositoryKindFromPaths(
  paths: readonly string[],
  context: RepositoryKindDetectionContext
): RepositoryKindAssessment {
  const normalizedPaths = paths.map(normalizePath);
  const fileNames = normalizedPaths.map((path) => path.split("/").at(-1) ?? "");
  const nestedPackageManifestCount = normalizedPaths.filter((path, index) => {
    const fileName = fileNames[index] ?? "";
    return path.includes("/") && packageManifestNames.has(fileName);
  }).length;

  if (
    fileNames.some((fileName) => workspaceMarkers.has(fileName)) ||
    nestedPackageManifestCount >= 2
  ) {
    return { kind: "monorepo", source: "detected", confidence: "high" };
  }

  if (
    normalizedPaths.some((path) =>
      path.startsWith("src/cli/") ||
      path.startsWith("cmd/") ||
      path.startsWith("bin/")
    )
  ) {
    return { kind: "cli", source: "detected", confidence: "medium" };
  }

  if (
    normalizedPaths.some((path) =>
      path === "dockerfile" ||
      path === "vercel.json" ||
      path === "netlify.toml" ||
      path === "wrangler.toml" ||
      path === "wrangler.jsonc" ||
      path.startsWith("app/") ||
      path.startsWith("pages/") ||
      path.startsWith("public/") ||
      path.includes("/routes/")
    )
  ) {
    return { kind: "application", source: "detected", confidence: "medium" };
  }

  if (
    context.sourceFileCount <= 2 &&
    context.hasReadme &&
    context.hasDemoOrDocs
  ) {
    return { kind: "documentation", source: "detected", confidence: "medium" };
  }

  const hasRootPackageManifest = normalizedPaths.some((path) =>
    !path.includes("/") && packageManifestNames.has(path)
  );
  if (hasRootPackageManifest && context.sourceFileCount > 0) {
    return { kind: "library", source: "detected", confidence: "low" };
  }

  if (context.sourceFileCount > 0 && context.sourceFileCount <= 10 && !hasRootPackageManifest) {
    return { kind: "experiment", source: "detected", confidence: "medium" };
  }

  return { kind: "general", source: "fallback", confidence: "low" };
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\/+/, "").toLowerCase();
}

function confidenceForSource(source: RepositoryKindAssessment["source"]): AssessmentConfidence {
  if (source === "declared") {
    return "high";
  }
  if (source === "detected" || source === "inferred") {
    return "medium";
  }
  return "low";
}
