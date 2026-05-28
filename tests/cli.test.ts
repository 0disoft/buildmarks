import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "bun:test";
import { renderCardFile } from "../src/cli/render-card";

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("render-card CLI", () => {
  test("renders a local profile fixture into an SVG file", async () => {
    const directory = await makeTempDirectory();
    const outputPath = join(directory, "cards", "example-card.svg");

    const result = await renderCardFile("fixtures/example-public-profile.json", outputPath);
    const svg = await readFile(outputPath, "utf8");

    expect(result.ok).toBe(true);
    expect(result.fallback).toBe(false);
    expect(svg).toContain("Buildmarks");
    expect(svg).toContain("example-builder");
    expect(svg).toContain("Not a ranking");
    expect(svg).toContain("Public data only");
  });

  test("writes a fallback SVG when the input JSON is invalid", async () => {
    const directory = await makeTempDirectory();
    const inputPath = join(directory, "invalid-profile.json");
    const outputPath = join(directory, "fallback", "card.svg");
    await writeFile(inputPath, "{", "utf8");

    const result = await renderCardFile(inputPath, outputPath);
    const svg = await readFile(outputPath, "utf8");

    expect(result.ok).toBe(false);
    expect(result.fallback).toBe(true);
    expect(result.error).toBeDefined();
    expect(svg).toContain("Buildmarks report is temporarily unavailable");
    expect(svg).toContain("Public GitHub signals only");
  });
});

async function makeTempDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "buildmarks-"));
  tempDirectories.push(directory);
  return directory;
}
