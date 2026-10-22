import { describe, expect, test } from "bun:test";
import { collectTreePathSignals, summarizeCodebaseShape } from "../src/collector/repository-tree-signals";
import { detectRepositoryKindFromPaths, resolveRepositoryKind } from "../src/scoring/repository-kind";
import fixture from "../fixtures/example-public-profile.json";
import type { ProfileInput } from "../src/shared/types";

const context = { sourceFileCount: 2, hasReadme: true, hasDemoOrDocs: true };

describe("repository evidence detection", () => {
  test("rejects placeholders, directories, empty files and workflow documentation", () => {
    const entries = [
      { path: ".github/workflows", type: "tree" },
      { path: ".github/workflows/README.md", type: "blob" },
      { path: ".github/workflows/nested/ci.yml", type: "blob" },
      { path: ".github/workflows/empty.yaml", type: "blob", size: 0 },
      { path: "tests/.gitkeep", type: "blob" },
      { path: "tests/README.md", type: "blob" },
      { path: "tests/fixtures/input.json", type: "blob" },
      { path: "tests/empty.test.ts", type: "blob", size: 0 },
      { path: "tests/main.test.ts", type: "tree" },
      { path: "docs/.gitkeep", type: "blob" },
      { path: "examples/app/package.json", type: "blob" }
    ];
    expect(collectTreePathSignals(entries)).toMatchObject({
      hasCi: false, hasTests: false, hasDemoOrDocs: true, hasPackageArtifact: false
    });
    expect(collectTreePathSignals([{ path: "docs/.gitkeep", type: "blob" }]).hasDemoOrDocs).toBe(false);
    expect(summarizeCodebaseShape(entries).testFileCount).toBe(0);
  });

  test("accepts workflow YAML and common test source naming", () => {
    for (const path of ["src/main.test.ts", "internal/parser_test.go", "test_parser.py", "spec/parser_spec.rb"]) {
      expect(collectTreePathSignals([{ path, type: "blob", size: 100 }]).hasTests).toBe(true);
      expect(summarizeCodebaseShape([{ path, type: "blob", size: 100 }]).testFileCount).toBe(1);
    }
    expect(collectTreePathSignals([{ path: ".github/workflows/ci.yaml", type: "blob" }]).hasCi).toBe(true);
  });

  test("keeps a small package with code classified as a library", () => {
    expect(detectRepositoryKindFromPaths([
      "README.md", "package.json", "index.ts", "index.test.ts", "docs/usage.md"
    ], context).kind).toBe("library");
    const repository = {
      ...(fixture as ProfileInput).repositories[0]!,
      owner: "probe", name: "small-library", hasReadme: true,
      hasDemoOrDocs: true, hasPackageArtifact: true
    };
    delete repository.repositoryKind;
    expect(resolveRepositoryKind(repository).kind).toBe("general");
  });

  test("does not treat documentation build tooling as library code", () => {
    expect(detectRepositoryKindFromPaths([
      "README.md", "package.json", "docs/usage.md", "scripts/build.ts", "vite.config.ts"
    ], context).kind).toBe("documentation");
  });

  test("ignores dependencies, generated output and examples when detecting repository kind", () => {
    const paths = ["README.md", "docs/usage.md"];
    for (const directory of ["vendor", "dist", "node_modules", "examples"]) {
      expect(detectRepositoryKindFromPaths([
        ...paths, `${directory}/a/package.json`, `${directory}/b/package.json`,
        `${directory}/src/cli/main.ts`, `${directory}/turbo.json`
      ], { ...context, sourceFileCount: 0 }).kind).toBe("documentation");
    }
    expect(detectRepositoryKindFromPaths([
      ...paths, "docs/a/package.json", "docs/b/package.json"
    ], { ...context, sourceFileCount: 0 }).kind).toBe("documentation");
    expect(detectRepositoryKindFromPaths([
      "packages/a/package.json", "packages/b/package.json"
    ], context).kind).toBe("monorepo");
    expect(detectRepositoryKindFromPaths(["pnpm-workspace.yaml"], context).kind).toBe("monorepo");
  });
});
