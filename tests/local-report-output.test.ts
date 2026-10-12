import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, readdir, rmdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import fixture from "../fixtures/example-public-profile.json";
import { renderReportFiles } from "../src/cli/render-report";

const tempRoot = resolve(tmpdir());
const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0)) {
    const child = relative(tempRoot, resolve(directory));
    if (!child || child.startsWith("..") || !child.startsWith("buildmarks-report-output-")) throw new Error("Unsafe test cleanup path");
    await rm(directory, { recursive: true, force: true });
  }
});

describe("local report output recovery", () => {
  for (const valid of [true, false]) {
    test(`preserves the existing HTML if the JSON destination is blocked, valid=${valid}`, async () => {
      const directory = await mkdtemp(join(tempRoot, "buildmarks-report-output-"));
      directories.push(directory);
      const input = join(directory, "profile.json");
      const output = join(directory, "report");
      await mkdir(output);
      const html = join(output, "buildmarks-report.html");
      const json = join(output, "buildmarks-report.json");
      const original = valid ? JSON.stringify(fixture) : "{invalid input";
      await writeFile(input, original);
      await writeFile(html, "previous complete report");
      await mkdir(json);
      const result = await renderReportFiles(input, output);
      expect(result.ok).toBe(false);
      expect(await readFile(html, "utf8")).toBe("previous complete report");
      expect(await readFile(input, "utf8")).toBe(original);
      expect((await readdir(output)).sort()).toEqual(["buildmarks-report.html", "buildmarks-report.json"]);

      await rmdir(json);
      await writeFile(input, JSON.stringify(fixture));
      const retried = await renderReportFiles(input, output);
      expect(retried.ok).toBe(true);
      expect(await readFile(html, "utf8")).toContain("<!doctype html>");
      expect(JSON.parse(await readFile(json, "utf8")).schemaVersion).toBe("buildmarks-report/v1");
    });
  }
});
