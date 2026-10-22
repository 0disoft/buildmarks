import { describe, expect, test } from "bun:test";
import { collectPublicGitHubProfile, createGitHubRequestLimiter, normalizePublicGitHubProfile, scoreUserProfile } from "../src";
import { readBoundedText } from "../src/collector/response-body";
import { fetchWithTimeout } from "../src/collector/request-timeout";

const signal = () => new AbortController().signal;
const encoder = new TextEncoder();
const json = (value: unknown) => new Response(JSON.stringify(value));

describe("GitHub payload limits", () => {
  for (const [label, response] of [
    ["404", () => new Response("{}", { status: 404 })],
    ["409", () => new Response("{}", { status: 409 })],
    ["null", () => json(null)],
    ["invalid entry", () => json({ tree: [{ path: 123 }] })],
    ["invalid truncation", () => json({ tree: [], truncated: "true" })]
  ] as const) {
    test(`does not turn an unreadable tree (${label}) into complete evidence`, async () => {
      const now = new Date("2026-05-28T00:00:00Z");
      const collected = await collectPublicGitHubProfile("probe", { now, fetcher: async url => {
        const path = new URL(url).pathname;
        if (path.includes("/users/")) return json([{ owner: { login: "probe" }, name: "one", private: false, fork: false, archived: false, stargazers_count: 0, forks_count: 0, pushed_at: now.toISOString(), default_branch: "main" }]);
        if (path.includes("/git/trees/")) return response();
        if (path.endsWith("/community/profile")) return json({ files: {} });
        if (path.endsWith("/readme")) return new Response("Usage");
        return json([]);
      } });
      expect(collected.repositories).toHaveLength(0);
      expect(collected.repositoryCollectionFailureCount).toBe(1);
      expect(collected.repositoryCollectionFailures?.[0]?.operation).toBe("tree");
      expect(scoreUserProfile(normalizePublicGitHubProfile(collected), { now }).evidenceStatus).toBe("insufficient");
    });
  }

  for (const limit of [3, 4, 5]) {
    test(`counts UTF-8 bytes at the ${limit}-byte boundary`, async () => {
      const response = new Response("😀");
      if (limit < 4) await expect(readBoundedText(response, limit, signal())).rejects.toMatchObject({ code: "github_response_too_large" });
      else expect(await readBoundedText(response, limit, signal())).toBe("😀");
    });
  }

  test("rejects oversized declared length before consuming the stream", async () => {
    const response = new Response("[]", { headers: { "content-length": "1000" } });
    await expect(readBoundedText(response, 10, signal())).rejects.toMatchObject({ code: "github_response_too_large" });
    expect(response.bodyUsed).toBe(false);
    await response.body!.cancel();
  });

  test("counts streamed chunks even when Content-Length understates the body", async () => {
    let cancelled = false;
    const response = new Response(new ReadableStream({ start(controller) {
      controller.enqueue(encoder.encode("abcd")); controller.enqueue(encoder.encode("ef"));
    }, cancel() { cancelled = true; } }), { headers: { "content-length": "1" } });
    await expect(readBoundedText(response, 5, signal())).rejects.toMatchObject({ code: "github_response_too_large" });
    expect(cancelled).toBe(true); expect(response.body?.locked).toBe(false);
  });

  test("preserves split UTF-8, BOM and buffer growth", async () => {
    const content = `\uFEFF${"a".repeat(20_000)}😀`;
    const bytes = encoder.encode(content);
    const response = new Response(new ReadableStream({ start(controller) {
      controller.enqueue(bytes.subarray(0, bytes.length - 2));
      controller.enqueue(bytes.subarray(bytes.length - 2)); controller.close();
    } }));
    expect(await readBoundedText(response, bytes.length, signal())).toBe(content.slice(1));
  });

  test("cancels a locked stalled reader on deadline without waiting for cleanup", async () => {
    let expire!: () => void; let cancelled = false;
    let ready!: () => void; const started = new Promise<void>(resolve => { ready = resolve; });
    const operation = fetchWithTimeout(async () => new Response(new ReadableStream({ cancel() { cancelled = true; return new Promise(() => {}); } })), "https://example.invalid", {
      headers: {}, signal: signal(), timeoutMilliseconds: 100,
      scheduleTimeout: callback => { expire = callback; return () => {}; }
    }, (response, requestSignal) => { ready(); return readBoundedText(response, 100, requestSignal); });
    await started; expire();
    await expect(operation).rejects.toMatchObject({ name: "TimeoutError" });
    expect(cancelled).toBe(true);
  });

  test("fails before parsing oversized JSON, with no retry and no held lease", async () => {
    const limiter = createGitHubRequestLimiter({ maxConcurrentRequests: 1 }); let requests = 0;
    await expect(collectPublicGitHubProfile("probe", {
      requestLimiter: limiter, maxResponseBytes: 2,
      fetcher: async () => { requests++; return new Response("invalid JSON"); }
    })).rejects.toMatchObject({ code: "github_response_too_large" });
    expect(requests).toBe(1); expect(limiter.activeCount).toBe(0);
  });

  for (const entries of [1, 2, 3]) {
    test(`tree limit=2 preserves incomplete collection status for ${entries} entries`, async () => {
      const now = new Date("2026-10-22T00:00:00Z");
      const profile = await collectPublicGitHubProfile("probe", {
        now, maxTreeEntries: 2,
        fetcher: async url => {
          const path = new URL(url).pathname;
          if (path.includes("/users/")) return json([{ owner: { login: "probe" }, name: "one", private: false, fork: false, archived: false, stargazers_count: 0, forks_count: 0, created_at: now.toISOString(), pushed_at: now.toISOString(), default_branch: "main" }]);
          if (path.includes("/git/trees/")) return json({ tree: Array.from({ length: entries }, (_, index) => ({ path: `src/file${index}.ts`, type: "blob", size: 10 })), truncated: false });
          if (path.endsWith("/community/profile")) return json({ files: {} });
          if (path.endsWith("/readme")) return new Response("Usage example");
          return json([]);
        }
      });
      expect(profile.repositories).toHaveLength(entries > 2 ? 0 : 1);
      if (entries > 2) {
        expect(profile.repositoryCollectionFailures).toEqual([{ code: "github_tree_too_large", operation: "tree", count: 1 }]);
        expect(scoreUserProfile(normalizePublicGitHubProfile(profile), { now }).evidenceStatus).toBe("insufficient");
      }
    });
  }

  test("validates payload limits before I/O", async () => {
    for (const value of [0, -1, 1.1, NaN, Infinity]) {
      for (const key of ["maxResponseBytes", "maxTreeEntries"]) {
        let requests = 0;
        await expect(collectPublicGitHubProfile("probe", { [key]: value, fetcher: async () => { requests++; return json([]); } }))
          .rejects.toMatchObject({ code: "invalid_policy" });
        expect(requests).toBe(0);
      }
    }
  });
});
