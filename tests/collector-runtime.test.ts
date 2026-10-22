import { describe, expect, test } from "bun:test";
import { collectOwnerSuppliedGitHubProfile, collectPublicGitHubProfile, defaultGitHubCollectorPolicy, type GitHubCollectorFetch, type TimeoutScheduler } from "../src";
import { fetchWithTimeout } from "../src/collector/request-timeout";
import { resolveCollectorRuntime } from "../src/collector/runtime";

const now = new Date("2026-05-28T00:00:00Z");
const day = 86_400_000;
const json = (value: unknown, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json", ...headers } });
const repository = (name: string, pushed: string | null = now.toISOString()) => ({ name, owner: { login: "probe" }, private: false, fork: false, archived: false, stargazers_count: 0, forks_count: 0, created_at: "2025-01-01T00:00:00Z", pushed_at: pushed, default_branch: "main", html_url: `https://github.com/probe/${name}`, homepage: null });
function fakeGitHub(repositories = [repository("one")]): GitHubCollectorFetch {
  return async url => {
    const path = new URL(url).pathname;
    if (path === "/users/probe/repos" || path === "/user/repos") return json(repositories);
    if (path === "/user") return json({ login: "probe" });
    if (path.endsWith("/community/profile")) return json({ files: {} });
    if (path.endsWith("/readme")) return new Response("Usage: run the example");
    if (path.includes("/git/trees/")) return json({ truncated: false, tree: [{ path: "src/main.ts", type: "blob", size: 100 }] });
    if (path.endsWith("/releases") || path.endsWith("/tags")) return json([]);
    throw new Error(`Unexpected mock request ${path}`);
  };
}

class ManualClock {
  now = 0;
  tasks = new Map<symbol, { at: number; callback: () => void }>();
  schedule: TimeoutScheduler = (callback, milliseconds) => {
    const key = Symbol();
    this.tasks.set(key, { at: this.now + milliseconds, callback });
    return () => { this.tasks.delete(key); };
  };
  advance(milliseconds: number) {
    this.now += milliseconds;
    for (const [key, task] of [...this.tasks]) {
      if (task.at <= this.now) { this.tasks.delete(key); task.callback(); }
    }
  }
}

describe("collector runtime injection", () => {
  test("cancels a sibling retry wait without starting another attempt", async () => {
    const clock = new ManualClock();
    let retryStarted!: () => void;
    const waiting = new Promise<void>(resolve => { retryStarted = resolve; });
    let retryCancelled = false;
    let releaseRequests = 0;
    const base = fakeGitHub();
    const profile = await collectPublicGitHubProfile("probe", {
      now,
      runtime: {
        scheduleTimeout: clock.schedule,
        sleep: async (_milliseconds, signal) => new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => { retryCancelled = true; reject(new DOMException("cancelled", "AbortError")); }, { once: true });
          retryStarted();
        })
      },
      fetcher: async (url, init) => {
        if (url.endsWith("/community/profile")) { await waiting; return json({}, 403); }
        if (new URL(url).pathname.endsWith("/releases")) { releaseRequests++; return json({}, 503); }
        return base(url, init);
      }
    });
    expect(profile.repositoryCollectionFailures).toEqual([{ code: "github_request_failed", operation: "community_profile", status: 403, count: 1 }]);
    expect(retryCancelled).toBe(true);
    expect(releaseRequests).toBe(1);
    expect(clock.tasks.size).toBe(0);
  });

  for (const failingPath of ["/community/profile", "/tags"]) {
    test(`settles failed repository siblings before advancing after ${failingPath}`, async () => {
      const clock = new ManualClock();
      const caller = new AbortController();
      const base = fakeGitHub([repository("one"), repository("two")]);
      let active = 0;
      let started = 0;
      let releaseFailure!: () => void;
      const siblingsStarted = new Promise<void>(resolve => { releaseFailure = resolve; });
      const profile = await collectPublicGitHubProfile("probe", {
        now, signal: caller.signal, runtime: { scheduleTimeout: clock.schedule },
        policy: { ...defaultGitHubCollectorPolicy, limits: { ...defaultGitHubCollectorPolicy.limits, maxConcurrentRepositoryCollections: 1 } },
        fetcher: async (url, init) => {
          if (url.includes("/two/")) {
            expect(active).toBe(0);
            return base(url, init);
          }
          if (!url.includes("/one/")) return base(url, init);
          if (new URL(url).pathname.endsWith(failingPath)) {
            await siblingsStarted;
            return json({}, 403);
          }
          active++;
          if (++started === 4) releaseFailure();
          if (url.endsWith("/readme")) {
            return new Response(new ReadableStream({ start(controller) {
              init.signal!.addEventListener("abort", () => {
                active--;
                controller.error(new DOMException("cancelled", "AbortError"));
              }, { once: true });
            } }));
          }
          return new Promise((_resolve, reject) => {
            init.signal!.addEventListener("abort", () => {
              active--;
              reject(new DOMException("cancelled", "AbortError"));
            }, { once: true });
          });
        }
      });
      expect(profile.repositories.map(repository => repository.name)).toEqual(["two"]);
      expect(profile.repositoryCollectionFailures).toEqual([{
        code: "github_request_failed", operation: failingPath === "/tags" ? "tags" : "community_profile", status: 403, count: 1
      }]);
      expect(active).toBe(0);
      expect(clock.tasks.size).toBe(0);
      caller.abort();
      expect(active).toBe(0);
    });
  }

  for (const offset of [-1, 0, 1]) {
    test(`uses a fixed collection time at the 365-day boundary ${offset}ms`, async () => {
      const profile = await collectPublicGitHubProfile("probe", { now, fetcher: fakeGitHub([repository("edge", new Date(now.getTime() - 365 * day + offset).toISOString())]) });
      expect(profile.collectedAt).toBe(now.toISOString());
      expect(profile.repositories).toHaveLength(offset >= 0 ? 1 : 0);
    });
  }

  for (const collect of [collectPublicGitHubProfile, collectOwnerSuppliedGitHubProfile]) {
    test(`does not request or attach timers when ${collect.name} starts cancelled`, async () => {
      const controller = new AbortController(); controller.abort();
      let requests = 0;
      const clock = new ManualClock();
      await expect(collect("probe", { token: "mock", signal: controller.signal, runtime: { scheduleTimeout: clock.schedule }, fetcher: async () => { requests++; return json([]); } })).rejects.toMatchObject({ name: "AbortError" });
      expect(requests).toBe(0);
      expect(clock.tasks.size).toBe(0);
    });
  }

  test("excludes future, missing and invalid activity timestamps", async () => {
    const profile = await collectPublicGitHubProfile("probe", { now, fetcher: fakeGitHub([repository("future", new Date(now.getTime() + 1).toISOString()), repository("missing", null), repository("invalid", "invalid")]) });
    expect(profile.repositories).toHaveLength(0);
    expect(profile.repositoryCollectionAttemptCount).toBe(0);
  });

  test("does not schedule the next repository after caller cancellation", async () => {
    const controller = new AbortController(); const calls: string[] = [];
    const fetcher = fakeGitHub([repository("one"), repository("two")]);
    await expect(collectPublicGitHubProfile("probe", {
      now, signal: controller.signal,
      policy: { ...defaultGitHubCollectorPolicy, limits: { ...defaultGitHubCollectorPolicy.limits, maxConcurrentRepositoryCollections: 1 } },
      fetcher: async (url, init) => {
        calls.push(url);
        if (url.includes("/one/git/trees/")) controller.abort();
        return fetcher(url, init);
      }
    })).rejects.toMatchObject({ name: "AbortError" });
    expect(calls.some(url => url.includes("/two/"))).toBe(false);
  });

  for (const stage of ["headers", "body", "retry"] as const) {
    test(`caller cancellation terminates ${stage} without another request`, async () => {
      const controller = new AbortController();
      let ready!: () => void;
      const started = new Promise<void>(resolve => { ready = resolve; });
      let requests = 0;
      const clock = new ManualClock();
      const operation = collectPublicGitHubProfile("probe", {
        now, signal: controller.signal,
        runtime: { scheduleTimeout: clock.schedule, sleep: async () => { ready(); return new Promise(() => {}); } },
        fetcher: async () => {
          requests++;
          if (stage === "retry") return json({}, 503);
          ready();
          if (stage === "headers") return new Promise(() => {});
          return new Response(new ReadableStream<Uint8Array>());
        }
      });
      void operation.catch(() => undefined);
      await started;
      controller.abort();
      await expect(operation).rejects.toMatchObject({ name: "AbortError" });
      expect(requests).toBe(1);
      expect(clock.tasks.size).toBe(0);
    });
  }

  for (const status of [429, 403]) {
    test(`fails immediately on rate limit ${status} instead of violating Retry-After`, async () => {
      let requests = 0; let waits = 0;
      await expect(collectPublicGitHubProfile("probe", { now, runtime: { sleep: async () => { waits++; } }, fetcher: async () => { requests++; return json({}, status, { "retry-after": "60" }); } })).rejects.toMatchObject({ code: "github_rate_limited", rateLimitReset: "60" });
      expect(requests).toBe(1); expect(waits).toBe(0);
    });
  }

  test("injects retry waits and counts retried requests in the same budget", async () => {
    for (const budget of [1, 2]) {
      let requests = 0; const waits: number[] = [];
      const operation = collectPublicGitHubProfile("probe", {
        now, policy: { ...defaultGitHubCollectorPolicy, limits: { ...defaultGitHubCollectorPolicy.limits, maxApiRequestsPerProfile: budget } },
        runtime: { sleep: async milliseconds => { waits.push(milliseconds); } },
        fetcher: async () => { requests++; return requests === 1 ? json({}, 503) : json([]); }
      });
      if (budget === 1) await expect(operation).rejects.toMatchObject({ code: "github_request_budget_exhausted" });
      else expect((await operation).repositories).toHaveLength(0);
      expect(requests).toBe(budget); expect(waits).toEqual([150]);
    }
  });

  test("preserves a rate-limit failure when response cleanup fails", async () => {
    let requests = 0; let waits = 0;
    await expect(collectPublicGitHubProfile("probe", {
      now, runtime: { sleep: async () => { waits++; } },
      fetcher: async () => {
        requests++;
        return new Response(new ReadableStream({ cancel() { throw new Error("injected cleanup failure"); } }), { status: 429, headers: { "retry-after": "60" } });
      }
    })).rejects.toMatchObject({ code: "github_rate_limited", rateLimitReset: "60" });
    expect(requests).toBe(1); expect(waits).toBe(0);
  });

  test("enforces the shared budget under concurrent repository requests", async () => {
    for (const budget of [10, 11, 12]) {
      let requests = 0; const fetcher = fakeGitHub([repository("one"), repository("two")]);
      const operation = collectPublicGitHubProfile("probe", { now, policy: { ...defaultGitHubCollectorPolicy, limits: { ...defaultGitHubCollectorPolicy.limits, maxApiRequestsPerProfile: budget } }, fetcher: async (url, init) => { requests++; return fetcher(url, init); } });
      const profile = await operation;
      expect(profile.repositories).toHaveLength(budget < 11 ? 1 : 2);
      if (budget < 11) expect(profile.repositoryCollectionFailureCount).toBe(1);
      expect(requests).toBe(Math.min(budget, 11));
    }
  });

  test("rejects invalid request deadlines before fetching", async () => {
    for (const timeoutMilliseconds of [0, -1, NaN, Infinity, 2_147_483_648]) {
      let requests = 0;
      await expect(collectPublicGitHubProfile("probe", { timeoutMilliseconds, fetcher: async () => { requests++; return json([]); } })).rejects.toMatchObject({ code: "invalid_policy" });
      expect(requests).toBe(0);
    }
  });

  test("default retry sleep releases its timer when cancelled", async () => {
    const clock = new ManualClock(); const controller = new AbortController();
    const runtime = resolveCollectorRuntime({ scheduleTimeout: clock.schedule });
    const waiting = runtime.sleep(150, controller.signal);
    void waiting.catch(() => undefined);
    expect(clock.tasks.size).toBe(1);
    controller.abort();
    await expect(waiting).rejects.toMatchObject({ name: "AbortError" });
    expect(clock.tasks.size).toBe(0);
  });
});

describe("deterministic response deadlines", () => {
  for (const collect of [collectPublicGitHubProfile, collectOwnerSuppliedGitHubProfile]) {
    for (const stage of ["headers", "body", "retry"] as const) {
      test(`${collect.name} shares its total deadline across ${stage}`, async () => {
        const clock = new ManualClock();
        let ready!: () => void;
        const started = new Promise<void>(resolve => { ready = resolve; });
        let requests = 0;
        let requestSignal: AbortSignal | null | undefined;
        const operation = collect("probe", {
          token: "mock", collectionTimeoutMilliseconds: 100, timeoutMilliseconds: 1000,
          runtime: { scheduleTimeout: clock.schedule, sleep: async () => { ready(); return new Promise(() => {}); } },
          fetcher: async (_url, init) => {
            requests++; requestSignal = init.signal;
            if (stage === "retry") return json({}, 503);
            ready();
            return stage === "headers" ? new Promise(() => {}) : new Response(new ReadableStream());
          }
        });
        void operation.catch(() => {});
        await started;
        clock.advance(99); expect(requestSignal?.aborted).toBe(stage === "retry");
        clock.advance(1);
        await expect(operation).rejects.toMatchObject({ code: "github_collection_timeout", cause: { name: "TimeoutError" } });
        expect(requests).toBe(1); expect(requestSignal?.aborted).toBe(true); expect(clock.tasks.size).toBe(0);
      });
    }
  }

  test("does not reset the total deadline for a new page", async () => {
    const clock = new ManualClock(); let requests = 0;
    await expect(collectPublicGitHubProfile("probe", {
      collectionTimeoutMilliseconds: 100, timeoutMilliseconds: 1000, runtime: { scheduleTimeout: clock.schedule },
      fetcher: async () => {
        requests++; clock.advance(60);
        return json(requests === 1 ? Array.from({ length: 30 }, (_, index) => ({ ...repository(`fork-${index}`), fork: true })) : []);
      }
    })).rejects.toMatchObject({ code: "github_collection_timeout" });
    expect(requests).toBe(2); expect(clock.tasks.size).toBe(0);
  });

  test("treats a total deadline during repository details as fatal, not partial evidence", async () => {
    const clock = new ManualClock(); const base = fakeGitHub();
    let ready!: () => void; const started = new Promise<void>(resolve => { ready = resolve; });
    const operation = collectPublicGitHubProfile("probe", {
      now, collectionTimeoutMilliseconds: 100, runtime: { scheduleTimeout: clock.schedule },
      fetcher: async (url, init) => {
        if (url.includes("/one/")) { ready(); return new Promise(() => {}); }
        return base(url, init);
      }
    });
    void operation.catch(() => {});
    await started; clock.advance(100);
    await expect(operation).rejects.toMatchObject({ code: "github_collection_timeout" });
    expect(clock.tasks.size).toBe(0);
  });

  test("removes the total deadline after successful collection", async () => {
    const clock = new ManualClock();
    await collectPublicGitHubProfile("probe", { now, collectionTimeoutMilliseconds: 100, runtime: { scheduleTimeout: clock.schedule }, fetcher: fakeGitHub() });
    expect(clock.tasks.size).toBe(0);
  });

  test("a per-attempt timeout can recover within the shared total deadline", async () => {
    const clock = new ManualClock(); let requests = 0;
    let ready!: () => void; const started = new Promise<void>(resolve => { ready = resolve; });
    const operation = collectPublicGitHubProfile("probe", {
      collectionTimeoutMilliseconds: 1000, timeoutMilliseconds: 100,
      runtime: { scheduleTimeout: clock.schedule, sleep: async () => {} },
      fetcher: async () => { requests++; ready(); return requests === 1 ? new Promise(() => {}) : json([]); }
    });
    await started;
    clock.advance(100);
    expect((await operation).repositories).toHaveLength(0);
    expect(requests).toBe(2); expect(clock.tasks.size).toBe(0);
  });

  test("caller cancellation removes the total timer and retains its reason", async () => {
    const clock = new ManualClock(); const caller = new AbortController(); const reason = new Error("caller stopped");
    const operation = collectPublicGitHubProfile("probe", {
      signal: caller.signal, collectionTimeoutMilliseconds: 1000,
      runtime: { scheduleTimeout: clock.schedule }, fetcher: async () => new Promise(() => {})
    });
    caller.abort(reason);
    await expect(operation).rejects.toMatchObject({ name: "AbortError", cause: reason });
    expect(clock.tasks.size).toBe(0);
  });

  test("validates the total deadline before attaching timers or fetching", async () => {
    for (const collectionTimeoutMilliseconds of [0, -1, 1.5, NaN, Infinity, 2_147_483_648]) {
      const clock = new ManualClock(); let requests = 0;
      await expect(collectPublicGitHubProfile("probe", {
        collectionTimeoutMilliseconds, runtime: { scheduleTimeout: clock.schedule }, fetcher: async () => { requests++; return json([]); }
      })).rejects.toMatchObject({ code: "invalid_policy" });
      expect(requests).toBe(0); expect(clock.tasks.size).toBe(0);
    }
  });

  for (const status of [404, 429, 503]) {
    test(`body cleanup failure does not change HTTP ${status} handling`, async () => {
      const failure = new Error("broken stream cleanup"); const reported: unknown[] = [];
      let requests = 0;
      const base = fakeGitHub();
      const operation = collectPublicGitHubProfile("probe", {
        now, runtime: { sleep: async () => {}, onCleanupError: error => { reported.push(error); throw new Error("observer failed"); } },
        fetcher: async (url, init) => {
          if (status === 404 && !url.endsWith("/community/profile")) return base(url, init);
          requests++;
          return new Response(new ReadableStream({ cancel() { throw failure; } }), { status });
        }
      });
      if (status === 404) expect((await operation).repositories).toHaveLength(1);
      else await expect(operation).rejects.toMatchObject({ code: status === 429 ? "github_rate_limited" : "github_request_failed", status });
      await Promise.resolve();
      expect(requests).toBe(status === 503 ? 2 : 1); expect(reported).toContain(failure);
    });
  }

  test("preserves timer setup failure without starting a request or leaking an abort rejection", async () => {
    const error = new Error("timer setup failed");
    const parent = new AbortController();
    let requests = 0;
    await expect(fetchWithTimeout(async () => { requests++; return json([]); }, "https://example.invalid", {
      headers: {}, signal: parent.signal, timeoutMilliseconds: 10000,
      scheduleTimeout: () => { throw error; }
    }, response => response.json())).rejects.toBe(error);
    parent.abort();
    await Promise.resolve();
    expect(requests).toBe(0);
  });

  for (const status of [403, 503]) {
    test(`releases unread HTTP ${status} bodies while preserving the response error`, async () => {
      const clock = new ManualClock();
      const signals: AbortSignal[] = [];
      let cancelled = 0;
      await expect(collectPublicGitHubProfile("probe", {
        now, runtime: { scheduleTimeout: clock.schedule, sleep: async () => {} },
        fetcher: async (_url, init) => {
          signals.push(init.signal!);
          return new Response(new ReadableStream({ cancel() { cancelled++; } }), { status });
        }
      })).rejects.toMatchObject({ code: "github_request_failed", status });
      expect(cancelled).toBe(status === 503 ? 2 : 1);
      expect(signals.at(-1)?.aborted).toBe(true);
      expect(clock.tasks.size).toBe(0);
    });
  }

  test("does not wait for a broken body cleanup or replace the original failure", async () => {
    const error = Object.freeze(new Error("original consumer error"));
    let signal: AbortSignal | null | undefined;
    await expect(fetchWithTimeout(async (_url, init) => {
      signal = init.signal;
      return new Response(new ReadableStream({ cancel: () => new Promise(() => {}) }));
    }, "https://example.invalid", { headers: {}, signal: new AbortController().signal, timeoutMilliseconds: 10000 }, async () => {
      throw error;
    })).rejects.toBe(error);
    expect(signal?.aborted).toBe(true);
  });

  test("cancels a late response from an adapter that ignored cancellation", async () => {
    const clock = new ManualClock();
    let deliver!: (response: Response) => void;
    let cancelled = false;
    const operation = fetchWithTimeout(() => new Promise(resolve => { deliver = resolve; }), "https://example.invalid", {
      headers: {}, signal: new AbortController().signal, timeoutMilliseconds: 10000, scheduleTimeout: clock.schedule
    }, response => response.text());
    void operation.catch(() => undefined);
    clock.advance(10000);
    await expect(operation).rejects.toMatchObject({ name: "TimeoutError" });
    deliver(new Response(new ReadableStream({ cancel() { cancelled = true; } })));
    await Promise.resolve();
    expect(cancelled).toBe(true);
    expect(clock.tasks.size).toBe(0);
  });

  for (const stage of ["headers", "json", "text"] as const) {
    test(`deadline at 9999/10000ms covers ${stage} and releases hooks`, async () => {
      const clock = new ManualClock();
      let ready!: () => void;
      const started = new Promise<void>(resolve => { ready = resolve; });
      let requestSignal: AbortSignal | null | undefined;
      const operation = fetchWithTimeout(async (_url, init) => {
        requestSignal = init.signal;
        if (stage === "headers") { ready(); return new Promise(() => {}); }
        return new Response(new ReadableStream<Uint8Array>());
      }, "https://example.invalid", { headers: {}, signal: new AbortController().signal, timeoutMilliseconds: 10000, scheduleTimeout: clock.schedule }, response => {
        ready(); return stage === "json" ? response.json() : response.text();
      });
      void operation.catch(() => undefined);
      await started;
      clock.advance(9999); expect(requestSignal?.aborted).toBe(false);
      clock.advance(1); await expect(operation).rejects.toMatchObject({ name: "TimeoutError" });
      expect(requestSignal?.aborted).toBe(true); expect(clock.tasks.size).toBe(0);
    });
  }
  test("a consumed response removes its deadline and cancellation hooks", async () => {
    const clock = new ManualClock(); const caller = new AbortController();
    let requestSignal: AbortSignal | null | undefined;
    expect(await fetchWithTimeout(async (_url, init) => { requestSignal = init.signal; return new Response("ok"); }, "https://example.invalid", { headers: {}, signal: caller.signal, timeoutMilliseconds: 10000, scheduleTimeout: clock.schedule }, response => response.text())).toBe("ok");
    caller.abort(); clock.advance(10001);
    expect(requestSignal?.aborted).toBe(false); expect(clock.tasks.size).toBe(0);
  });
});
