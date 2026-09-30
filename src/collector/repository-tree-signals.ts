import type { CodebaseShapeSignals } from "../shared/types.js";

const ciDirectoryPaths = [".github/workflows"];
const ciFilePaths = [
  ".circleci/config.yml",
  ".travis.yml",
  "Jenkinsfile",
  "azure-pipelines.yml",
  ".gitlab-ci.yml",
  ".drone.yml"
];
const testPaths = ["tests", "test", "__tests__", "spec"];
const readmePaths = ["README.md", "README", "readme.md"];
const licensePaths = ["LICENSE", "LICENSE.md", "LICENCE", "LICENCE.md", "COPYING"];
const changelogPaths = ["CHANGELOG.md", "CHANGELOG", "changelog.md"];
const contributingPaths = ["CONTRIBUTING.md", "CONTRIBUTING", ".github/CONTRIBUTING.md"];
const codeOfConductPaths = ["CODE_OF_CONDUCT.md", "CODE_OF_CONDUCT", ".github/CODE_OF_CONDUCT.md"];
const securityPolicyPaths = ["SECURITY.md", ".github/SECURITY.md"];
const demoOrDocsPaths = ["demo", "demos", "docs", "documentation", "example", "examples", "sample", "samples"];
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
const packageArtifactFileNames = new Set(packageArtifactPaths.map((path) => path.toLowerCase()));
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

export interface GitHubTreeEntry {
  path: string;
  type?: string;
  size?: number;
}

function normalizeTreePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\/+/, "").toLowerCase();
}

interface TreePathSignals {
  hasReadme: boolean;
  hasLicense: boolean;
  hasCi: boolean;
  hasTests: boolean;
  hasChangelog: boolean;
  hasContributing: boolean;
  hasCodeOfConduct: boolean;
  hasSecurityPolicy: boolean;
  hasDemoOrDocs: boolean;
  hasPackageArtifact: boolean;
}

export function collectTreePathSignals(treeEntries: readonly GitHubTreeEntry[]): TreePathSignals {
  const signals: TreePathSignals = {
    hasReadme: false,
    hasLicense: false,
    hasCi: false,
    hasTests: false,
    hasChangelog: false,
    hasContributing: false,
    hasCodeOfConduct: false,
    hasSecurityPolicy: false,
    hasDemoOrDocs: false,
    hasPackageArtifact: false
  };
  const matchers = [
    { key: "hasReadme", candidates: readmePaths, mode: "file" },
    { key: "hasLicense", candidates: licensePaths, mode: "file" },
    { key: "hasChangelog", candidates: changelogPaths, mode: "file" },
    { key: "hasContributing", candidates: contributingPaths, mode: "file" },
    { key: "hasCodeOfConduct", candidates: codeOfConductPaths, mode: "file" },
    { key: "hasSecurityPolicy", candidates: securityPolicyPaths, mode: "file" },
    { key: "hasDemoOrDocs", candidates: demoOrDocsPaths, mode: "tree" }
  ] as const;

  for (const entry of treeEntries) {
    const normalizedPath = normalizeTreePath(entry.path);
    if (hasIgnoredShapePathSegment(normalizedPath)) {
      continue;
    }

    if (!signals.hasTests) {
      signals.hasTests =
        isTestPath(entry.path) ||
        testPaths.some((candidate) => treePathMatchesCandidate(normalizedPath, normalizeTreePath(candidate)));
    }
    if (!signals.hasCi) {
      signals.hasCi = isCiPath(entry, normalizedPath);
    }
    if (!signals.hasPackageArtifact) {
      signals.hasPackageArtifact = isPackageArtifactPath(entry);
    }

    for (const matcher of matchers) {
      if (signals[matcher.key]) {
        continue;
      }

      signals[matcher.key] = matcher.candidates.some((candidate) =>
        matcher.mode === "file"
          ? filePathMatchesCandidate(entry, normalizedPath, normalizeTreePath(candidate))
          : treePathMatchesCandidate(normalizedPath, normalizeTreePath(candidate))
      );
    }

    if (Object.values(signals).every(Boolean)) {
      break;
    }
  }

  return signals;
}

function treePathMatchesCandidate(normalizedPath: string, normalizedCandidate: string): boolean {
  return normalizedPath === normalizedCandidate || normalizedPath.startsWith(`${normalizedCandidate}/`);
}

function filePathMatchesCandidate(
  entry: GitHubTreeEntry,
  normalizedPath: string,
  normalizedCandidate: string
): boolean {
  return isFileEntry(entry) && normalizedPath === normalizedCandidate;
}

function isCiPath(entry: GitHubTreeEntry, normalizedPath: string): boolean {
  return (
    ciDirectoryPaths.some((candidate) => treePathMatchesCandidate(normalizedPath, normalizeTreePath(candidate))) ||
    ciFilePaths.some((candidate) => filePathMatchesCandidate(entry, normalizedPath, normalizeTreePath(candidate)))
  );
}

function isFileEntry(entry: GitHubTreeEntry): boolean {
  return entry.type === undefined || entry.type === "blob";
}

function isPackageArtifactPath(entry: GitHubTreeEntry): boolean {
  if (!isFileEntry(entry)) {
    return false;
  }

  const fileName = normalizeTreePath(entry.path).split("/").at(-1) ?? "";

  return packageArtifactFileNames.has(fileName);
}

export function summarizeCodebaseShape(
  treeEntries: readonly GitHubTreeEntry[],
  treeTruncated = false
): CodebaseShapeSignals {
  const sourceSizes: number[] = [];
  let sourceFileCount = 0;
  let testFileCount = 0;
  let exampleFileCount = 0;
  let oversizedSourceFileCount = 0;

  for (const entry of treeEntries) {
    if (isExampleFileEntry(entry)) {
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

  if (!isFileEntry(entry)) {
    return false;
  }
  if (hasIgnoredShapePathSegment(normalizedPath)) {
    return false;
  }
  if (lockfileNames.has(fileName) || fileName.endsWith(".min.js") || fileName.endsWith(".map")) {
    return false;
  }

  return sourceFileExtensions.has(extensionOf(fileName));
}

function isExampleFileEntry(entry: GitHubTreeEntry): boolean {
  if (!isFileEntry(entry)) {
    return false;
  }
  if (hasIgnoredShapePathSegment(entry.path)) {
    return false;
  }

  return isExamplePath(entry.path);
}

function hasIgnoredShapePathSegment(path: string): boolean {
  return normalizeTreePath(path)
    .split("/")
    .some((segment) => ignoredShapePathSegments.has(segment));
}

function isTestPath(path: string): boolean {
  const normalizedPath = normalizeTreePath(path);
  const fileName = normalizedPath.split("/").at(-1) ?? "";

  return (
    normalizedPath.startsWith("__tests__/") ||
    normalizedPath.startsWith("test/") ||
    normalizedPath.startsWith("tests/") ||
    normalizedPath.startsWith("spec/") ||
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
