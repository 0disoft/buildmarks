import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "bun:test";
import fixture from "../fixtures/example-public-profile.json";
import { createStaticReport, renderStaticReportHtml } from "../src";
import { renderReportFiles } from "../src/cli/render-report";
import type { ProfileInput } from "../src";

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("static report", () => {
  test("creates an inspectable JSON report from a profile fixture", () => {
    const report = createStaticReport(fixture as ProfileInput);

    expect(report.version).toBe(1);
    expect(report.profile.username).toBe("example-builder");
    expect(report.profile.evidence.length).toBeGreaterThan(0);
    expect(report.gaps.gaps.length).toBeGreaterThan(0);
    expect(report.repositories.length).toBeGreaterThan(0);
  });

  test("renders an HTML report without executable script content", () => {
    const report = createStaticReport(fixture as ProfileInput);
    const html = renderStaticReportHtml(report);

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Buildmarks static report");
    expect(html).toContain("Dimension Scores");
    expect(html).toContain("What's Missing");
    expect(html).toContain("Repository Signals");
    expect(html).toContain("Not a ranking");
    expect(html).not.toContain("<script");
  });

  test("writes HTML and JSON report files", async () => {
    const directory = await makeTempDirectory();
    const result = await renderReportFiles("fixtures/example-public-profile.json", directory);
    const html = await readFile(result.htmlPath, "utf8");
    const json = JSON.parse(await readFile(result.jsonPath, "utf8")) as { version: number };

    expect(result.ok).toBe(true);
    expect(html).toContain("Buildmarks static report");
    expect(json.version).toBe(1);
  });
});

async function makeTempDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "buildmarks-report-"));
  tempDirectories.push(directory);
  return directory;
}
