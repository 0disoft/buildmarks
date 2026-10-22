/** Paths belonging to dependencies or generated output are not project evidence. */
const ignoredSegments = new Set([
  ".cache", ".git", ".next", ".svelte-kit", ".turbo", "build", "coverage",
  "dist", "node_modules", "out", "target", "vendor"
]);

export function normalizeRepositoryPath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\/+/, "").toLowerCase();
}

export function isIgnoredRepositoryPath(path: string): boolean {
  return normalizeRepositoryPath(path).split("/").some(segment => ignoredSegments.has(segment));
}

export function isExampleRepositoryPath(path: string): boolean {
  return normalizeRepositoryPath(path).split("/").some(segment =>
    ["demo", "demos", "example", "examples", "fixture", "fixtures", "sample", "samples"].includes(segment)
  );
}

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

export function isSourceRepositoryPath(path: string): boolean {
  const fileName = normalizeRepositoryPath(path).split("/").at(-1) ?? "";
  return sourceFileExtensions.has(fileName.slice(fileName.lastIndexOf(".")));
}
