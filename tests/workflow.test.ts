import { readFile } from "node:fs/promises";
import { describe, expect, test } from "bun:test";

describe("profile README workflow example", () => {
  test("keeps community health templates aligned with project boundaries", async () => {
    const bugReport = await readFile(".github/ISSUE_TEMPLATE/bug_report.yml", "utf8");
    const featureRequest = await readFile(".github/ISSUE_TEMPLATE/feature_request.yml", "utf8");
    const pullRequest = await readFile(".github/pull_request_template.md", "utf8");
    const security = await readFile("SECURITY.md", "utf8");
    const readme = await readFile("README.md", "utf8");
    const combined = [bugReport, featureRequest, pullRequest, security, readme].join("\n");

    expect(bugReport).toContain("Reproduction");
    expect(bugReport).toContain("Expected behavior");
    expect(bugReport).toContain("Actual behavior");
    expect(bugReport).toContain("Environment");
    expect(featureRequest).toContain("Proposed behavior");
    expect(featureRequest).toContain("Boundary check");
    expect(pullRequest).toContain("dist/");
    expect(pullRequest).toContain("out/");
    expect(security).toContain("Please do not open public issues for sensitive vulnerabilities.");
    expect(security).toContain("GitHub Security Advisories");
    expect(readme).toContain("Contributing and Security");
    expect(readme).toContain("SECURITY.md");
    expect(combined).toContain("private GitHub data");
    expect(combined).toContain("secrets");
    expect(combined).toContain("developer ranking");
    expect(security).not.toContain("mailto:");
  });

  test("keeps repository CI read-only while validating core commands", async () => {
    const workflow = await readFile(".github/workflows/ci.yml", "utf8");

    expect(workflow).toContain("name: CI");
    expect(workflow).toContain("push:");
    expect(workflow).toContain("- main");
    expect(workflow).toContain("pull_request:");
    expect(workflow).toContain("permissions:");
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("actions/checkout@v6");
    expect(workflow).toContain("oven-sh/setup-bun@v2");
    expect(workflow).toContain("run: bun test");
    expect(workflow).toContain("run: bun run build");
    expect(workflow).toContain("run: bun run build:card");
    expect(workflow).toContain("run: bun run build:report");
    expect(workflow).toContain("run: npm pack --dry-run");
    expect(workflow).not.toContain("git commit");
    expect(workflow).not.toContain("git push");
    expect(workflow).not.toContain("contents: write");
    expect(workflow).not.toContain("gh release");
    expect(workflow).not.toContain("GITHUB_TOKEN");
    expect(workflow).not.toContain("secrets.");
  });

  test("declares public package metadata for release readiness", async () => {
    const metadata = JSON.parse(await readFile("package.json", "utf8")) as {
      bugs?: { url?: string };
      bin?: unknown;
      files?: string[];
      homepage?: string;
      keywords?: string[];
      license?: string;
      repository?: { type?: string; url?: string };
      scripts?: Record<string, string>;
      version?: string;
    };

    expect(metadata.license).toBe("0BSD");
    expect(metadata.version).toBe("0.1.3");
    expect(metadata.homepage).toBe("https://github.com/0disoft/buildmarks");
    expect(metadata.repository).toEqual({
      type: "git",
      url: "git+https://github.com/0disoft/buildmarks.git"
    });
    expect(metadata.bugs).toEqual({
      url: "https://github.com/0disoft/buildmarks/issues"
    });
    for (const keyword of [
      "github",
      "profile-readme",
      "svg",
      "developer-tools",
      "oss",
      "0bsd",
      "maintenance",
      "github-actions"
    ]) {
      expect(metadata.keywords).toContain(keyword);
    }
    for (const packagedPath of [
      "src",
      "docs",
      "examples",
      "fixtures",
      "action.yml",
      "CHANGELOG.md",
      "README.md",
      "LICENSE"
    ]) {
      expect(metadata.files).toContain(packagedPath);
    }
    expect(metadata.scripts?.["pack:dry-run"]).toBe("npm pack --dry-run");
    expect(metadata.files).toContain("CHANGELOG.md");
    expect(metadata.bin).toBeUndefined();
  });

  test("keeps the changelog as the release source of truth", async () => {
    const changelog = await readFile("CHANGELOG.md", "utf8");
    const readme = await readFile("README.md", "utf8");

    expect(changelog).toContain("## Unreleased");
    expect(changelog).toContain("## v0.1.0 - 2026-05-30");
    expect(changelog).toContain("First public Buildmarks foundation release");
    expect(changelog).toContain("## v0.1.1 - 2026-05-30");
    expect(changelog).toContain("Published the `buildmarks` npm package as a library package");
    expect(changelog).toContain("## v0.1.2 - 2026-05-31");
    expect(changelog).toContain("## v0.1.3 - 2026-05-31");
    expect(changelog).toContain("explicit private-local collection");
    expect(changelog).toContain("private-local repository signal contract");
    expect(changelog).toContain("0disoft/buildmarks@v0");
    expect(changelog).toContain("no developer ranking");
    expect(readme).toContain("[CHANGELOG.md](CHANGELOG.md)");
    expect(readme).toContain("0disoft/buildmarks@v0");
  });

  test("documents the profile README quick start paths", async () => {
    const readme = await readFile("README.md", "utf8");
    const example = await readFile("examples/profile-readme.md", "utf8");

    for (const document of [readme, example]) {
      expect(document).toContain("Quick Start");
      expect(document).toContain("workflow_dispatch");
      expect(document).toContain("assets/buildmarks.svg");
      expect(document).toContain("assets/buildmarks-report/buildmarks-report.html");
      expect(document).toContain("assets/buildmarks-report/buildmarks-report.json");
      expect(document).toContain("![Buildmarks public GitHub signal card](./assets/buildmarks.svg)");
      expect(document).toContain("[View the Buildmarks report](./assets/buildmarks-report/buildmarks-report.html)");
    }
  });

  test("documents release readiness without promoting the candidate domain", async () => {
    const readme = await readFile("README.md", "utf8");

    expect(readme).toContain("Release Readiness");
    expect(readme).toContain("https://github.com/0disoft/buildmarks");
    expect(readme).toContain("buildmarks.xyz");
    expect(readme).toContain("candidate-only");
    expect(readme).toContain("backend-free profile README generation");
    expect(readme).toContain("The composite action generates artifacts only");
    expect(readme).toContain("Repository CI runs the core test, build, sample SVG, sample report, and npm package dry-run checks");
    expect(readme).toContain("The CI workflow is read-only");
  });

  test("documents npm publishing while preserving the no-bin CLI boundary", async () => {
    const readme = await readFile("README.md", "utf8");
    const npmPackaging = await readFile("docs/npm-packaging.md", "utf8");
    const combined = [readme, npmPackaging].join("\n");

    expect(readme).toContain("[docs/npm-packaging.md](docs/npm-packaging.md)");
    expect(readme).toContain("Buildmarks is published to npm as `buildmarks`");
    expect(readme).toContain("the package has no `bin` entry yet");
    expect(readme).toContain("npm pack --dry-run");
    expect(npmPackaging).toContain("Buildmarks is published to npm as a library package");
    expect(npmPackaging).toContain("npm package name: `buildmarks`");
    expect(npmPackaging).toContain("Current package version: `0.1.3`");
    expect(npmPackaging).toContain("Do not add a package `bin` entry yet");
    expect(npmPackaging).toContain("npm pack --dry-run");
    expect(npmPackaging).toContain("Generated `dist/` and `out/` artifacts are intentionally not part of the package");
    expect(npmPackaging).toContain("not official adoption paths");
  });

  test("serializes scheduled updates and commits newly generated artifacts", async () => {
    const workflow = await readFile("examples/profile-readme-workflow.yml", "utf8");

    expect(workflow).toContain("concurrency:");
    expect(workflow).toContain("cancel-in-progress: true");
    expect(workflow).toContain("git add assets/buildmarks.svg assets/buildmarks-report");
    expect(workflow).toContain("git diff --cached --quiet");
    expect(workflow.indexOf("git add assets/buildmarks.svg assets/buildmarks-report")).toBeLessThan(
      workflow.indexOf("git diff --cached --quiet")
    );
  });

  test("keeps commit and push behavior outside the composite action", async () => {
    const action = await readFile("action.yml", "utf8");

    expect(action).toContain("branding:");
    expect(action).toContain("icon: activity");
    expect(action).toContain("color: green");
    expect(action).not.toContain("git commit");
    expect(action).not.toContain("git push");
    expect(action).not.toContain("contents: write");
  });

  test("documents every composite action input without changing action boundaries", async () => {
    const action = await readFile("action.yml", "utf8");
    const readme = await readFile("README.md", "utf8");
    const example = await readFile("examples/profile-readme.md", "utf8");

    for (const input of [
      "username",
      "output",
      "generate-report",
      "report-output",
      "token",
      "private-local",
      "max-repositories-scanned",
      "max-repositories-scored",
      "activity-window-days"
    ]) {
      expect(action).toContain(`  ${input}:`);
      expect(readme).toContain(`| \`${input}\``);
      expect(example).toContain(`| \`${input}\``);
    }

    expect(readme).toContain('Must be exactly `"true"` or `"false"`');
    expect(example).toContain('Must be exactly `"true"` or `"false"`');
    expect(readme).toContain("private-local mode requires an explicit owner-provided read token");
    expect(example).toContain("private-local mode requires an explicit owner-provided read token");
    expect(readme).toContain("redacted private repository names");
    expect(example).toContain("redacted private repository names");
  });

  test("documents deferred activity aggregates and storage-neutral cache boundaries", async () => {
    const activity = await readFile("docs/activity-aggregate-methodology.md", "utf8");
    const cache = await readFile("docs/cache-contract.md", "utf8");
    const operations = await readFile("docs/github-collector-operations.md", "utf8");
    const combined = [activity, cache, operations].join("\n");

    expect(activity).toContain("public issue response traces");
    expect(activity).toContain("public pull request review traces");
    expect(activity).toContain("public external contributor traces");
    expect(activity).toContain("raw commit count");
    expect(activity).toContain("private contributions");
    expect(activity).toContain("hiring suitability");
    expect(cache).toContain("profile-report:v1:{username}:{policyHash}");
    expect(cache).toContain("repo-file-signals:v1:{owner}/{repo}:{defaultBranch}:{policyHash}");
    expect(cache).toContain("6 hours");
    expect(cache).toContain("24 hours");
    expect(cache).toContain("storage-neutral");
    expect(combined).toContain("private tokens");
    expect(combined).toContain("hosted endpoint");
    expect(operations).toContain("cache-contract.md");
    expect(operations).toContain("activity-aggregate-methodology.md");
  });

  test("keeps example assets and real smoke-test documentation discoverable", async () => {
    const readme = await readFile("README.md", "utf8");
    const example = await readFile("examples/profile-readme.md", "utf8");
    const smokeTest = await readFile("examples/profile-smoke-test.md", "utf8");
    const profileCard = await readFile("examples/assets/example-card.svg", "utf8");
    const gapsCard = await readFile("examples/assets/example-gaps-card.svg", "utf8");
    const repoCard = await readFile("examples/assets/example-repo-card.svg", "utf8");

    expect(readme).toContain("examples/assets");
    expect(example).toContain("[assets](assets)");
    for (const document of [readme, example]) {
      expect(document).toContain("example-card.svg");
      expect(document).toContain("example-gaps-card.svg");
      expect(document).toContain("example-repo-card.svg");
    }

    expect(smokeTest).toContain("0disoft/0disoft");
    expect(smokeTest).toContain(".github/workflows/update-buildmarks-card.yml");
    expect(smokeTest).toContain("assets/buildmarks.svg");
    expect(smokeTest).toContain("assets/buildmarks-report/buildmarks-report.html");
    expect(smokeTest).toContain("assets/buildmarks-report/buildmarks-report.json");
    expect(profileCard).toContain("Buildmarks");
    expect(gapsCard).toContain("What's Missing");
    expect(repoCard).toContain("Repository Signal Card");
  });

  test("validates action inputs before generating artifacts", async () => {
    const action = await readFile("action.yml", "utf8");

    expect(action).toContain("Validate Buildmarks inputs");
    expect(action).toContain("Expected generate-report to be exactly 'true' or 'false'.");
    expect(action).toContain("Invalid max-repositories-scanned");
    expect(action).toContain("Invalid max-repositories-scored");
    expect(action).toContain("Invalid activity-window-days");
    expect(action).toContain("Invalid private-local");
    expect(action).toContain("private-local mode requires an explicit token input");
    expect(action).toContain("set -euo pipefail");
    expect(action.indexOf("Validate Buildmarks inputs")).toBeLessThan(action.indexOf("Set up Bun"));
  });
});
