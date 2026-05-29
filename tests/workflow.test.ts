import { readFile } from "node:fs/promises";
import { describe, expect, test } from "bun:test";

describe("profile README workflow example", () => {
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
      expect(document).toContain("[View the Buildmarks evidence report](./assets/buildmarks-report/buildmarks-report.html)");
    }
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

    expect(action).not.toContain("git commit");
    expect(action).not.toContain("git push");
    expect(action).not.toContain("contents: write");
  });

  test("validates action inputs before generating artifacts", async () => {
    const action = await readFile("action.yml", "utf8");

    expect(action).toContain("Validate Buildmarks inputs");
    expect(action).toContain("Expected generate-report to be exactly 'true' or 'false'.");
    expect(action).toContain("Invalid max-repositories-scanned");
    expect(action).toContain("Invalid max-repositories-scored");
    expect(action).toContain("set -euo pipefail");
    expect(action.indexOf("Validate Buildmarks inputs")).toBeLessThan(action.indexOf("Set up Bun"));
  });
});
