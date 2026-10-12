import { afterEach, describe, expect, test } from "bun:test";
import { link, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import fixture from "../fixtures/example-public-profile.json";
import { renderCardFile } from "../src/cli/render-card";
import { renderGapsCardFile } from "../src/cli/render-gaps-card";
import { renderRepoCardFile } from "../src/cli/render-repo-card";
import { renderReportFiles } from "../src/cli/render-report";

const directories: string[] = [];
const fixtureText = `${JSON.stringify(fixture, null, 2)}\n`;
const root = resolve(import.meta.dir, "..");
const tempRoot = resolve(tmpdir());

async function workspace() {
  const path = await mkdtemp(join(tempRoot, "buildmarks-input-preservation-"));
  directories.push(path);
  return path;
}

afterEach(async () => {
  for (const directory of directories.splice(0)) {
    const child = relative(tempRoot, resolve(directory));
    if (!child || child.startsWith("..") || !child.startsWith("buildmarks-input-preservation-")) throw new Error("Unsafe test cleanup path");
    await rm(directory, { recursive: true, force: true });
  }
});

const renderers = [
  { name: "profile card", file: "profile.json", render: (input: string, output: string) => renderCardFile(input, output) },
  { name: "gaps card", file: "profile.json", render: (input: string, output: string) => renderGapsCardFile(input, output) },
  { name: "repository card", file: "profile.json", render: (input: string, output: string) => renderRepoCardFile(input, "usable-toolkit", output) },
  { name: "report JSON", file: "buildmarks-report.json", render: (input: string) => renderReportFiles(input, dirname(input)) },
  { name: "report HTML", file: "buildmarks-report.html", render: (input: string) => renderReportFiles(input, dirname(input)) },
];

describe("local render input preservation", () => {
  for (const renderer of renderers) {
    for (const valid of [true, false]) {
      test(`${renderer.name} rejects input replacement with valid=${valid}`, async () => {
        const directory = await workspace();
        const input = join(directory, renderer.file);
        const contents = valid ? fixtureText : "{invalid profile";
        await writeFile(input, contents);
        await expect(renderer.render(input, input)).rejects.toThrow("would replace profile input");
        expect(await readFile(input, "utf8")).toBe(contents);
        expect(await readdir(directory)).toEqual([renderer.file]);
      });
    }
  }

  test("normalized relative paths cannot hide an input collision", async () => {
    const directory = await workspace();
    const input = join(directory, "profile.json");
    await writeFile(input, fixtureText);
    await expect(renderCardFile(relative(process.cwd(), input), ` ${join(directory, "nested", "..", "profile.json")} `))
      .rejects.toThrow("would replace profile input");
    expect(await readFile(input, "utf8")).toBe(fixtureText);
  });

  test("a directory alias cannot hide an input collision", async () => {
    const directory = await workspace();
    const actual = join(directory, "actual");
    const alias = join(directory, "alias");
    await mkdir(actual);
    await symlink(actual, alias, process.platform === "win32" ? "junction" : "dir");
    const input = join(actual, "profile.json");
    await writeFile(input, fixtureText);
    await expect(renderCardFile(join(alias, "profile.json"), input)).rejects.toThrow("would replace profile input");
    expect(await readFile(input, "utf8")).toBe(fixtureText);
  });

  test("the source CLI rejects a collision and accepts a corrected output path", async () => {
    const directory = await workspace();
    const input = join(directory, "profile.json");
    const output = join(directory, "card.svg");
    await writeFile(input, fixtureText);
    const rejected = Bun.spawn([process.execPath, join(root, "src/cli/render-card.ts"), input, input], { cwd: directory, stdout: "pipe", stderr: "pipe" });
    const [code, stderr] = await Promise.all([rejected.exited, new Response(rejected.stderr).text()]);
    expect(code).toBe(2);
    expect(stderr).toContain("would replace profile input");
    expect(stderr).not.toContain("wrote fallback");
    expect(await readFile(input, "utf8")).toBe(fixtureText);

    const retried = Bun.spawn([process.execPath, join(root, "src/cli/render-card.ts"), input, output], { cwd: directory, stdout: "pipe", stderr: "pipe" });
    expect(await retried.exited).toBe(0);
    expect(await readFile(output, "utf8")).toContain("<svg");
    expect(await readFile(input, "utf8")).toBe(fixtureText);
  });

  test("a missing input is not created as its own fallback output", async () => {
    const directory = await workspace();
    const input = join(directory, "missing.json");
    await expect(renderCardFile(input, input)).rejects.toThrow("would replace profile input");
    expect(await readdir(directory)).toEqual([]);
  });

  test("hard-linked input aliases are rejected before the alias is replaced", async () => {
    const directory = await workspace();
    const input = join(directory, "profile.json");
    const output = join(directory, "alias.json");
    await writeFile(input, fixtureText);
    await link(input, output);
    await expect(renderCardFile(input, output)).rejects.toThrow("would replace profile input");
    expect(await readFile(input, "utf8")).toBe(fixtureText);
    expect(await readFile(output, "utf8")).toBe(fixtureText);
  });

  test("all report destinations are checked before an unrelated artifact is replaced", async () => {
    const directory = await workspace();
    const input = join(directory, "buildmarks-report.json");
    const html = join(directory, "buildmarks-report.html");
    await writeFile(input, fixtureText);
    await writeFile(html, "previous report");
    await expect(renderReportFiles(input, directory)).rejects.toThrow("would replace profile input");
    expect(await readFile(input, "utf8")).toBe(fixtureText);
    expect(await readFile(html, "utf8")).toBe("previous report");
  });

  test("normal missing-input fallback still uses a separate destination", async () => {
    const directory = await workspace();
    const result = await renderCardFile(join(directory, "missing.json"), join(directory, "fallback.svg"));
    expect(result.ok).toBe(false);
    expect(result.fallback).toBe(true);
    expect(await readFile(result.outputPath, "utf8")).toContain("<svg");
  });
});
