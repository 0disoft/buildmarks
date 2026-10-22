import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, open, readFile, readdir, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { OutputBusyError, OutputLockReleaseError, withOutputLocks } from "../src/cli/output-lock";
import { recoverGitHubOutput } from "../src/cli/github-render-runtime";
import type { WriteOutputOptions } from "../src/cli/file-system";
import { writeTextFileAtomically, writeTextFilesAsSet } from "../src/cli/write-output";
import { renderCardFile } from "../src/cli/render-card";
import { renderGitHubCardFile } from "../src/cli/render-github-card";
import { GitHubCollectorError } from "../src/collector/github-client";
import type { CollectPublicGitHubProfileOptions } from "../src";
import { renderGitHubReportFiles } from "../src/cli/render-github-report";
import { renderGitHubArtifacts } from "../src/cli/render-github-artifacts";

const tempRoot = resolve(tmpdir());
const directories: string[] = [];
async function workspace() {
  const directory = await mkdtemp(join(tempRoot, "buildmarks-output-lock-"));
  directories.push(directory);
  return directory;
}
afterEach(async () => {
  for (const directory of directories.splice(0)) {
    const child = relative(tempRoot, resolve(directory));
    if (!child || child.startsWith("..") || !child.startsWith("buildmarks-output-lock-")) throw new Error("Unsafe test cleanup path");
    await rm(directory, { recursive: true, force: true });
  }
});
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

describe("output writer exclusion", () => {
  for (const kind of ["card", "report", "artifacts"] as const) {
    test(`holds the ${kind} refresh lease from collection through publication`, async () => {
      const directory = await workspace(); const card = join(directory, "card.svg");
      const now = new Date("2026-05-28T00:00:00Z");
      const paused = deferred(), resume = deferred();
      const json = (value: unknown) => new Response(JSON.stringify(value));
      const fetcher = async (url: string) => {
        const path = new URL(url).pathname;
        if (path.includes("/users/")) return json([{ owner: { login: "probe" }, name: "one", private: false, fork: false, archived: false, stargazers_count: 0, forks_count: 0, pushed_at: now.toISOString(), default_branch: "main" }]);
        if (path.includes("/git/trees/")) return json({ tree: [{ path: "src/main.ts", type: "blob", size: 10 }], truncated: false });
        if (path.endsWith("/community/profile")) return json({ files: {} });
        if (path.endsWith("/readme")) return new Response("Usage");
        return json([]);
      };
      const renderers = {
        card: (options: CollectPublicGitHubProfileOptions) => renderGitHubCardFile("probe", card, options),
        report: (options: CollectPublicGitHubProfileOptions) => renderGitHubReportFiles("probe", directory, options),
        artifacts: (options: CollectPublicGitHubProfileOptions) => renderGitHubArtifacts("probe", card, directory, options)
      };
      const first = renderers[kind]({ now, fetcher: async url => { paused.resolve(); await resume.promise; return fetcher(url); } });
      await paused.promise;
      let duplicateRequests = 0;
      try {
        const overlaps = kind === "artifacts" ? ["card", "report", "artifacts"] as const : [kind, "artifacts"] as const;
        for (const overlap of overlaps) {
          await expect(renderers[overlap]({ now, fetcher: async url => { duplicateRequests++; return fetcher(url); } }))
            .rejects.toBeInstanceOf(OutputBusyError);
        }
        expect(duplicateRequests).toBe(0);
      } finally { resume.resolve(); }
      expect((await first).ok).toBe(true);
      expect((await renderers[kind]({ now: new Date("2026-05-29T00:00:00Z"), fetcher })).ok).toBe(true);
      expect((await readdir(directory)).some(path => path.endsWith(".lock"))).toBe(false);
    });
  }

  test("renderers propagate lock conflicts without attempting fallback publication", async () => {
    const directory = await workspace();
    const path = join(directory, "card.svg");
    await writeFile(path, "current output");
    await withOutputLocks([path], {}, async () => {
      await expect(renderCardFile(resolve(import.meta.dir, "../fixtures/example-public-profile.json"), path))
        .rejects.toBeInstanceOf(OutputBusyError);
      await expect(renderGitHubCardFile("probe", path, {
        fetcher: async () => { throw new GitHubCollectorError("github_rate_limited", "injected failure"); }
      })).rejects.toBeInstanceOf(OutputBusyError);
      expect(await readFile(path, "utf8")).toBe("current output");
    });
    expect(await readdir(directory)).toEqual(["card.svg"]);
  });

  test("excludes overlapping sets through rollback and allows a clean retry", async () => {
    const directory = await workspace();
    const html = join(directory, "report.html"), json = join(directory, "report.json");
    await writeFile(html, "HTML-0"); await writeFile(json, "JSON-0");
    const paused = deferred(), resume = deferred();
    const first = writeTextFilesAsSet([{ path: html, content: "HTML-A" }, { path: json, content: "JSON-A" }], async (from, to) => {
      if (to === json) throw new Error("A second replacement failed");
      await rename(from, to);
      paused.resolve();
      await resume.promise;
    }).catch(error => error);
    await paused.promise;
    try {
      await expect(writeTextFilesAsSet([{ path: json, content: "JSON-B" }, { path: html, content: "HTML-B" }]))
        .rejects.toBeInstanceOf(OutputBusyError);
      await expect(writeTextFileAtomically(html, "single writer")).rejects.toBeInstanceOf(OutputBusyError);
      expect(await readFile(html, "utf8")).toBe("HTML-A");
    } finally { resume.resolve(); }
    expect((await first).message).toBe("A second replacement failed");
    expect(await readFile(html, "utf8")).toBe("HTML-0");
    expect(await readFile(json, "utf8")).toBe("JSON-0");
    await writeTextFilesAsSet([{ path: html, content: "HTML-B" }, { path: json, content: "JSON-B" }]);
    expect(await readFile(html, "utf8")).toBe("HTML-B");
    expect(await readFile(json, "utf8")).toBe("JSON-B");
    expect((await readdir(directory)).sort()).toEqual(["report.html", "report.json"]);
  });

  test("protects absence checking and fallback publication with the same lock", async () => {
    const directory = await workspace();
    const path = join(directory, "card.svg");
    const paused = deferred(), resume = deferred();
    const operation = recoverGitHubOutput(new Error("collection failed"), {
      paths: [path], unknownErrorMessage: "unknown", fallbackLabel: "Fallback SVG",
      writeFallback: async (_message, lockedOptions) => {
        paused.resolve();
        await resume.promise;
        await writeTextFileAtomically(path, "fallback", lockedOptions);
        return undefined;
      }
    }, {});
    await paused.promise;
    try {
      await expect(writeTextFileAtomically(path, "new success")).rejects.toBeInstanceOf(OutputBusyError);
    } finally { resume.resolve(); }
    expect((await operation).fallback).toBe(true);
    await writeTextFileAtomically(path, "new success");
    let fallbackWrites = 0;
    const preserved = await recoverGitHubOutput(new Error("late failure"), {
      paths: [path], unknownErrorMessage: "unknown", fallbackLabel: "Fallback SVG",
      writeFallback: async () => { fallbackWrites++; return undefined; }
    }, {});
    expect(preserved).toMatchObject({ fallback: false, preservedExisting: true });
    expect(fallbackWrites).toBe(0);
    expect(await readFile(path, "utf8")).toBe("new success");
  });

  test("releases partially acquired locks and never removes another writer's lock", async () => {
    const directory = await workspace();
    const first = join(directory, "a"), second = join(directory, "z");
    await withOutputLocks([second], {}, async () => {
      await expect(withOutputLocks([first, second], {}, async () => {})).rejects.toBeInstanceOf(OutputBusyError);
      expect(await readdir(directory)).toHaveLength(1);
      await writeTextFileAtomically(first, "independent destination");
    });
    expect(await readdir(directory)).toEqual(["a"]);
  });

  test("canonical directory aliases share a lock and expired scopes cannot bypass it", async () => {
    const directory = await workspace();
    const actual = join(directory, "actual"), alias = join(directory, "alias");
    await mkdir(actual);
    await symlink(actual, alias, process.platform === "win32" ? "junction" : "dir");
    const path = join(actual, "card.svg");
    let expired: WriteOutputOptions = {};
    await withOutputLocks([path], {}, async options => { expired = options; });
    await withOutputLocks([path], {}, async () => {
      await expect(writeTextFileAtomically(join(alias, "card.svg"), "alias writer")).rejects.toBeInstanceOf(OutputBusyError);
      await expect(writeTextFileAtomically(path, "expired scope", expired)).rejects.toBeInstanceOf(OutputBusyError);
    });
    expect(await readdir(actual)).toEqual([]);
  });

  test("closes and removes an acquired lock when metadata writing fails or the caller cancels", async () => {
    for (const cancel of [false, true]) {
      const directory = await workspace();
      const caller = new AbortController();
      let closes = 0;
      const operation = withOutputLocks([join(directory, "card.svg")], {
        signal: caller.signal,
        fileSystem: { open: async (path, flags) => {
          const handle = await open(path, flags);
          return {
            writeFile: async () => { if (cancel) caller.abort(); else throw new Error("metadata failed"); },
            sync: () => handle.sync(),
            close: async () => { closes++; await handle.close(); }
          };
        } }
      }, async () => { throw new Error("must not publish"); });
      if (cancel) await expect(operation).rejects.toMatchObject({ name: "AbortError" });
      else await expect(operation).rejects.toThrow("metadata failed");
      expect(closes).toBe(1);
      expect(await readdir(directory)).toEqual([]);
    }
  });

  test("reports lock cleanup failure with its original cause and does not reclaim the lock", async () => {
    const directory = await workspace();
    const error = new Error("publication failed");
    const operation = withOutputLocks([join(directory, "card.svg")], {
      fileSystem: { rm: async () => { throw new Error("remove denied"); } }
    }, async () => { throw error; });
    await expect(operation).rejects.toBeInstanceOf(OutputLockReleaseError);
    await expect(operation).rejects.toMatchObject({ cause: error });
    expect(await readdir(directory)).toHaveLength(1);
    await expect(writeTextFileAtomically(join(directory, "card.svg"), "unsafe retry")).rejects.toBeInstanceOf(OutputBusyError);
  });

  test("coordinates a separate process without relying on an in-memory mutex", async () => {
    const directory = await workspace();
    const path = join(directory, "card.svg");
    const lockModule = pathToFileURL(resolve(import.meta.dir, "../src/cli/output-lock.ts")).href;
    const writerModule = pathToFileURL(resolve(import.meta.dir, "../src/cli/write-output.ts")).href;
    const script = `
      import { withOutputLocks } from ${JSON.stringify(lockModule)};
      import { writeTextFileAtomically } from ${JSON.stringify(writerModule)};
      await withOutputLocks([${JSON.stringify(path)}], {}, async options => {
        await Bun.write(Bun.stdout, "LOCKED\\n");
        await new Promise(resolve => process.stdin.once("data", resolve));
        await writeTextFileAtomically(${JSON.stringify(path)}, "child success", options);
      });
    `;
    const child = Bun.spawn([process.execPath, "--eval", script], { stdin: "pipe", stdout: "pipe", stderr: "pipe" });
    const reader = child.stdout.getReader();
    try {
      const ready = await reader.read();
      expect(new TextDecoder().decode(ready.value)).toContain("LOCKED");
      await expect(writeTextFileAtomically(path, "parent collision")).rejects.toBeInstanceOf(OutputBusyError);
      child.stdin.write("release\n"); child.stdin.end();
      const code = await child.exited;
      if (code !== 0) throw new Error(await new Response(child.stderr).text());
      expect(await readFile(path, "utf8")).toBe("child success");
      expect(await readdir(directory)).toEqual(["card.svg"]);
    } finally {
      child.kill();
      await child.exited;
      await reader.cancel();
    }
  }, 15000);
});
