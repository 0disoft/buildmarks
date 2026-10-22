import { codebaseShapePolicy } from "../shared/evidence-policy.js";
import type { CodebaseShapeSignals } from "../shared/types.js";
import { isIgnoredRepositoryPath, isExampleRepositoryPath, isSourceRepositoryPath } from "../shared/repository-paths.js";

const ciFilePaths = [
  ".circleci/config.yml",
  ".travis.yml",
  "Jenkinsfile",
  "azure-pipelines.yml",
  ".gitlab-ci.yml",
  ".drone.yml"
];
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
    if (isIgnoredRepositoryPath(normalizedPath)) {
      continue;
    }

    if (!signals.hasTests) {
      signals.hasTests = isCountableSourceFile(entry) && isTestPath(entry.path);
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
          : isFileEntry(entry) && entry.size !== 0 &&
            !(normalizedPath.split("/").at(-1) ?? "").startsWith(".") &&
            normalizedPath.startsWith(`${normalizeTreePath(candidate)}/`)
      );
    }

    if (Object.values(signals).every(Boolean)) {
      break;
    }
  }

  return signals;
}

function filePathMatchesCandidate(
  entry: GitHubTreeEntry,
  normalizedPath: string,
  normalizedCandidate: string
): boolean {
  return isFileEntry(entry) && entry.size !== 0 && normalizedPath === normalizedCandidate;
}

function isCiPath(entry: GitHubTreeEntry, normalizedPath: string): boolean {
  return (
    (isFileEntry(entry) && entry.size !== 0 && /^\.github\/workflows\/[^/]+\.ya?ml$/.test(normalizedPath)) ||
    ciFilePaths.some((candidate) => filePathMatchesCandidate(entry, normalizedPath, normalizeTreePath(candidate)))
  );
}

function isFileEntry(entry: GitHubTreeEntry): boolean {
  return entry.type === undefined || entry.type === "blob";
}

function isPackageArtifactPath(entry: GitHubTreeEntry): boolean {
  if (!isFileEntry(entry) || entry.size === 0 || isExampleRepositoryPath(entry.path)) {
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
      if (entry.size > codebaseShapePolicy.maximumP90SourceFileBytes) {
        oversizedSourceFileCount += 1;
      }
    }
  }

  // This array is owned by the summary; sort once for both exact percentiles.
  sourceSizes.sort((left, right) => left - right);
  return {
    sourceFileCount,
    testFileCount,
    exampleFileCount,
    medianSourceFileBytes: percentileOfSorted(sourceSizes, 0.5),
    p90SourceFileBytes: percentileOfSorted(sourceSizes, 0.9),
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
  if (isIgnoredRepositoryPath(normalizedPath) || entry.size === 0) {
    return false;
  }
  if (lockfileNames.has(fileName) || fileName.endsWith(".min.js") || fileName.endsWith(".map")) {
    return false;
  }

  return isSourceRepositoryPath(normalizedPath);
}

function isExampleFileEntry(entry: GitHubTreeEntry): boolean {
  if (!isFileEntry(entry)) {
    return false;
  }
  if (isIgnoredRepositoryPath(entry.path)) {
    return false;
  }

  return isExampleRepositoryPath(entry.path);
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
    fileName.includes(".spec.") ||
    fileName.endsWith("_test.go") ||
    (fileName.endsWith(".py") && (fileName.startsWith("test_") || fileName.endsWith("_test.py"))) ||
    fileName.endsWith("_spec.rb")
  );
}

function percentileOfSorted(sorted: readonly number[], percentileValue: number): number {
  if (sorted.length === 0) {
    return 0;
  }

  const clampedPercentile = Math.max(0, Math.min(1, percentileValue));
  const rawIndex = (sorted.length - 1) * clampedPercentile;
  const lowerIndex = Math.floor(rawIndex);
  const upperIndex = Math.ceil(rawIndex);
  const lower = sorted[lowerIndex] ?? 0;
  const upper = sorted[upperIndex] ?? lower;

  return Math.round(lower + (upper - lower) * (rawIndex - lowerIndex));
}

function roundRatio(value: number): number {
  return Number(value.toFixed(codebaseShapePolicy.storedRatioDecimalPlaces));
}
