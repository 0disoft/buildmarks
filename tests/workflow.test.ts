import { readFile } from "node:fs/promises";
import { describe, expect, test } from "bun:test";

describe("profile README workflow example", () => {
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
});
