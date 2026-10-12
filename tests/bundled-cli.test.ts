import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import fixture from "../fixtures/example-public-profile.json";

const kinds = ["card", "gaps-card", "repo-card", "report"] as const;
const importedKinds = [...kinds, "github-card", "github-report", "github-artifacts"] as const;
const tempRoot = resolve(tmpdir());
let directory: string;
let bundles: string;
const node = Bun.which("node");

beforeAll(async () => {
  if (!node) throw new Error("Node.js is required to verify the shipped Node CLI bundles");
  directory = await mkdtemp(join(tempRoot, "buildmarks-node-cli-"));
  bundles = join(directory, "bundles");
  const built = await Bun.build({
    entrypoints: importedKinds.map(kind => resolve(`src/cli/render-${kind}.ts`)),
    outdir: bundles, target: "node",
  });
  if (!built.success) throw new Error(built.logs.map(String).join("\n"));
});

afterAll(async () => {
  if (!directory) return;
  const child = relative(tempRoot, resolve(directory));
  if (!child || child.startsWith("..") || !child.startsWith("buildmarks-node-cli-")) throw new Error("Unsafe test cleanup path");
  await rm(directory, { recursive: true, force: true });
});

describe("shipped Node CLI entry points", () => {
  for (const kind of kinds) {
    test(`${kind} runs only its own command`, async () => {
      const workspace = join(directory, kind);
      await mkdir(workspace);
      const input = join(workspace, "profile.json");
      const output = join(workspace, kind === "report" ? "report" : "card.svg");
      const contents = `${JSON.stringify(fixture)}\n`;
      await writeFile(input, contents);
      const args = kind === "repo-card" ? [input, "usable-toolkit", output] : [input, output];
      const child = Bun.spawn([node!, join(bundles, `render-${kind}.js`), ...args], { cwd: workspace, stdout: "pipe", stderr: "pipe" });
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
      expect(stderr).toBe("");
      expect(code).toBe(0);
      expect(stdout.trim().split("\n")).toHaveLength(kind === "report" ? 2 : 1);
      expect(await readFile(input, "utf8")).toBe(contents);
      expect(await readFile(kind === "report" ? join(output, "buildmarks-report.html") : output, "utf8"))
        .toContain(kind === "report" ? "<!doctype html>" : "<svg");
    });
  }

  test("importing a bundled renderer does not execute any CLI", async () => {
    for (const kind of importedKinds) {
      const child = Bun.spawn([node!, "--input-type=module", "-e", "await import(process.env.BUILDMARKS_TEST_ENTRY)"], {
        cwd: directory,
        env: { ...process.env, BUILDMARKS_TEST_ENTRY: pathToFileURL(join(bundles, `render-${kind}.js`)).href },
        stdout: "pipe", stderr: "pipe",
      });
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
      expect(code).toBe(0);
      expect(stdout).toBe("");
      expect(stderr).toBe("");
    }
  });
});
