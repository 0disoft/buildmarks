import { describe, expect, test } from "bun:test";
import { basename, dirname, join, resolve } from "node:path";
import fixture from "../fixtures/example-public-profile.json";
import type { RenderFileSystem } from "../src/cli/file-system";
import { writeTextFileAtomically, writeTextFilesAsSet, OutputSetRollbackError } from "../src/cli/write-output";
import { renderCardFile } from "../src/cli/render-card";
import { renderGapsCardFile } from "../src/cli/render-gaps-card";
import { renderRepoCardFile } from "../src/cli/render-repo-card";
import { renderReportFiles } from "../src/cli/render-report";
import { renderGitHubCardFile } from "../src/cli/render-github-card";
import { renderGitHubReportFiles } from "../src/cli/render-github-report";
import { renderGitHubArtifacts } from "../src/cli/render-github-artifacts";
import type { LocalRenderOptions } from "../src/cli/local-render-options";

const root = resolve("memory-output-runtime");
const first = join(root, "first.txt"), second = join(root, "second.txt");
const outputs = [{ path: first, content: "new first" }, { path: second, content: "new second" }];
const temporary = (path: string, suffix = "tmp") => join(dirname(path), `.${basename(path)}.${process.pid}.fixed.${suffix}`);
const missing = () => Object.assign(new Error("Not found"), { code: "ENOENT" });
const exists = () => Object.assign(new Error("Already exists"), { code: "EEXIST" });

/** Filesystem failures are injected before the simulated operation changes state. */
class MemoryFiles implements RenderFileSystem {
  files = new Map<string, string>();
  operations: string[] = [];
  lockOperations: string[] = [];
  before: (operation: string, path: string, destination?: string) => void = () => {};
  event = (operation: string, path: string, destination?: string) => {
    // Existing failure injection targets artifact I/O, independently of locking.
    if (basename(path).startsWith(".buildmarks-") && path.endsWith(".lock")) {
      this.lockOperations.push(operation);
      return;
    }
    this.operations.push(operation); this.before(operation, path, destination);
  };
  open: RenderFileSystem["open"] = async path => {
    this.event("open", path);
    if (this.files.has(path)) throw exists();
    this.files.set(path, "");
    return {
      writeFile: async content => { this.event("write", path); this.files.set(path, content); },
      sync: async () => { this.event("sync", path); },
      close: async () => { this.event("close", path); }
    };
  };
  copyFile: RenderFileSystem["copyFile"] = async (source, destination) => {
    this.event("copy", source, destination);
    if (this.files.has(destination)) throw exists();
    const data = this.files.get(source); if (data === undefined) throw missing();
    this.files.set(destination, data);
  };
  rename: RenderFileSystem["rename"] = async (source, destination) => {
    this.event("rename", source, destination);
    const data = this.files.get(source); if (data === undefined) throw missing();
    this.files.set(destination, data); this.files.delete(source);
  };
  rm: RenderFileSystem["rm"] = async (path, options) => {
    this.event("remove", path);
    if (!this.files.delete(path) && !options?.force) throw missing();
  };
  lstat: RenderFileSystem["lstat"] = async path => { this.event("lstat", path); if (!this.files.has(path)) throw missing(); return { isFile: () => true }; };
  stat: RenderFileSystem["stat"] = async path => { this.event("stat", path); if (!this.files.has(path)) throw missing(); return { dev: 1n, ino: BigInt([...this.files.keys()].indexOf(path) + 1) }; };
  realpath: RenderFileSystem["realpath"] = async path => { this.event("realpath", path); return path; };
  access: RenderFileSystem["access"] = async path => { this.event("access", path); if (!this.files.has(path)) throw missing(); };
  mkdir: RenderFileSystem["mkdir"] = async path => { this.event("mkdir", path); };
  readFile: RenderFileSystem["readFile"] = async path => { this.event("read", path); const data = this.files.get(path); if (data === undefined) throw missing(); return data; };
  options = () => ({ fileSystem: this, randomId: () => "fixed" });
}

describe("output ownership and recovery", () => {
  test("rejects aliased output destinations before staging files", async () => {
    const fs = new MemoryFiles();
    fs.realpath = async path => path === second ? first : path;
    await expect(writeTextFilesAsSet(outputs, undefined, fs.options())).rejects.toThrow("distinct");
    expect(fs.files.size).toBe(0); expect(fs.operations).not.toContain("open");
  });
  test("does not delete a temporary file when exclusive open collides", async () => {
    const fs = new MemoryFiles(); fs.files.set(first, "original"); fs.files.set(temporary(first), "foreign");
    await expect(writeTextFileAtomically(first, "new", fs.options())).rejects.toMatchObject({ code: "EEXIST" });
    expect(fs.files.get(first)).toBe("original"); expect(fs.files.get(temporary(first))).toBe("foreign");
    expect(fs.operations).not.toContain("remove");
    expect(fs.operations).not.toContain("rename");
  });

  for (const phase of ["open", "write", "sync", "close", "rename"]) {
    test(`preserves original output and cleans owned files on ${phase} failure`, async () => {
      const fs = new MemoryFiles(); fs.files.set(first, "original");
      fs.before = operation => { if (operation === phase) throw new Error(`injected ${phase}`); };
      await expect(writeTextFileAtomically(first, "new", fs.options())).rejects.toThrow(`injected ${phase}`);
      expect([...fs.files]).toEqual([[first, "original"]]);
    });
  }

  for (const suffix of ["tmp", "bak"]) {
    test(`does not replace or remove an unowned ${suffix} during set preparation`, async () => {
      const fs = new MemoryFiles(); fs.files.set(first, "old first"); fs.files.set(second, "old second"); fs.files.set(temporary(second, suffix), "foreign");
      await expect(writeTextFilesAsSet(outputs, undefined, fs.options())).rejects.toMatchObject({ code: "EEXIST" });
      expect(Array.from(fs.files, ([path, content]) => [path, content]).sort()).toEqual([[first, "old first"], [second, "old second"], [temporary(second, suffix), "foreign"]].sort());
    });
  }

  for (const existing of [true, false]) {
    test(`restores the output set on second replacement failure with existing=${existing}`, async () => {
      const fs = new MemoryFiles();
      if (existing) { fs.files.set(first, "old first"); fs.files.set(second, "old second"); }
      fs.before = (operation, source, destination) => { if (operation === "rename" && source.endsWith(".tmp") && destination === second) throw new Error("second replacement"); };
      await expect(writeTextFilesAsSet(outputs, undefined, fs.options())).rejects.toThrow("second replacement");
      expect(Array.from(fs.files, ([path, content]) => [path, content]).sort()).toEqual(existing ? [[first, "old first"], [second, "old second"]].sort() : []);
    });
  }

  test("retains the original backup and reports failed recovery", async () => {
    const fs = new MemoryFiles(); fs.files.set(first, "old first"); fs.files.set(second, "old second");
    fs.before = (operation, source, destination) => {
      if (operation === "rename" && (destination === second || source.endsWith(".bak"))) throw new Error("replacement or recovery failure");
    };
    await expect(writeTextFilesAsSet(outputs, undefined, fs.options())).rejects.toBeInstanceOf(OutputSetRollbackError);
    expect(fs.files.get(temporary(first, "bak"))).toBe("old first");
    expect(fs.files.get(first)).toBe("new first"); expect(fs.files.get(second)).toBe("old second");
    expect(fs.files.has(temporary(second, "bak"))).toBe(false);
  });

  test("cancellation during preparation leaves existing outputs intact", async () => {
    const fs = new MemoryFiles(); const controller = new AbortController();
    fs.files.set(first, "old first"); fs.files.set(second, "old second");
    fs.before = (operation, path) => { if (operation === "sync" && path === temporary(second)) controller.abort(); };
    await expect(writeTextFilesAsSet(outputs, undefined, { ...fs.options(), signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(Array.from(fs.files, ([path, content]) => [path, content]).sort()).toEqual([[first, "old first"], [second, "old second"]].sort());
    expect(fs.operations).not.toContain("rename");
  });

  test("finishes the whole set when cancellation arrives after replacement starts", async () => {
    const fs = new MemoryFiles(); const controller = new AbortController();
    fs.files.set(first, "old first"); fs.files.set(second, "old second");
    fs.before = (operation, _source, destination) => { if (operation === "rename" && destination === first) controller.abort(); };
    await writeTextFilesAsSet(outputs, undefined, { ...fs.options(), signal: controller.signal });
    expect(Array.from(fs.files, ([path, content]) => [path, content]).sort()).toEqual([[first, "new first"], [second, "new second"]].sort());
  });

  test("does not hide a failed recovery behind cancellation in the report renderer", async () => {
    const fs = new MemoryFiles(); const controller = new AbortController();
    const inputPath = join(root, "profile.json"), html = join(root, "buildmarks-report.html"), json = join(root, "buildmarks-report.json");
    fs.files.set(inputPath, JSON.stringify(fixture)); fs.files.set(html, "old HTML"); fs.files.set(json, "old JSON");
    fs.before = (operation, source, destination) => {
      if (operation !== "rename") return;
      if (destination === html && source.endsWith(".tmp")) controller.abort();
      if (destination === json || source.endsWith(".bak")) throw new Error("replacement or recovery failure");
    };
    const result = await renderReportFiles(inputPath, root, { ...fs.options(), signal: controller.signal });
    expect(result.ok).toBe(false); expect(result.error).toContain("recovery was incomplete");
    expect(fs.files.get(temporary(html, "bak"))).toBe("old HTML");
    expect(fs.files.get(json)).toBe("old JSON");
  });
});

const input = join(root, "profile.json");
const localRenderers = [
  { name: "card", render: (options: LocalRenderOptions) => renderCardFile(input, first, options) },
  { name: "gaps", render: (options: LocalRenderOptions) => renderGapsCardFile(input, first, options) },
  { name: "repository", render: (options: LocalRenderOptions) => renderRepoCardFile(input, "usable-toolkit", first, options) },
  { name: "report", render: (options: LocalRenderOptions) => renderReportFiles(input, root, options) }
];

describe("renderer I/O injection", () => {
  for (const renderer of localRenderers) {
    test(`renders ${renderer.name} through injected I/O and a fixed time`, async () => {
      const fs = new MemoryFiles(); fs.files.set(input, JSON.stringify(fixture));
      const now = new Date("2027-05-28T00:00:00Z");
      const result = await renderer.render({ ...fs.options(), now });
      expect(result.ok).toBe(true); expect(fs.files.get(input)).toBe(JSON.stringify(fixture));
      expect(fs.operations).toContain("read"); expect(fs.operations).toContain("rename");
      if (renderer.name === "report") {
        const report = JSON.parse(fs.files.get(join(root, "buildmarks-report.json"))!);
        expect(report.profile.generatedAt).toBe(now.toISOString()); expect(report.gaps.generatedAt).toBe(now.toISOString());
      } else expect(fs.files.get(first)).toContain("<svg");
    });

    test(`cancels a pending ${renderer.name} input read without fallback writes`, async () => {
      const fs = new MemoryFiles(); fs.files.set(input, JSON.stringify(fixture)); fs.files.set(first, "old card");
      const controller = new AbortController();
      let ready!: () => void; const started = new Promise<void>(resolve => { ready = resolve; });
      fs.readFile = async () => { ready(); return new Promise(() => {}); };
      const operation = renderer.render({ ...fs.options(), signal: controller.signal }); void operation.catch(() => undefined);
      await started; controller.abort();
      await expect(operation).rejects.toMatchObject({ name: "AbortError" });
      expect(fs.files.get(first)).toBe("old card"); expect(fs.operations).not.toContain("open");
    });
  }

  const githubRenderers = [
    (options: LocalRenderOptions & { fetcher: () => Promise<Response> }) => renderGitHubCardFile("probe", first, options),
    (options: LocalRenderOptions & { fetcher: () => Promise<Response> }) => renderGitHubReportFiles("probe", root, options),
    (options: LocalRenderOptions & { fetcher: () => Promise<Response> }) => renderGitHubArtifacts("probe", first, root, options)
  ];
  for (const [index, render] of githubRenderers.entries()) {
    test(`GitHub renderer ${index} does not create fallback artifacts on cancellation`, async () => {
      const fs = new MemoryFiles(); const controller = new AbortController();
      await expect(render({ ...fs.options(), signal: controller.signal, fetcher: async () => { controller.abort(); return new Response("[]"); } })).rejects.toMatchObject({ name: "AbortError" });
      expect(fs.files.size).toBe(0); expect(fs.operations).not.toContain("open");
    });
  }

  test("cancels before touching any filesystem operation", async () => {
    for (const renderer of localRenderers) {
      const fs = new MemoryFiles(); const controller = new AbortController(); controller.abort();
      await expect(renderer.render({ ...fs.options(), signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
      expect(fs.operations).toEqual([]);
    }
  });
});
