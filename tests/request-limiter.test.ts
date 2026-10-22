import { describe, expect, test } from "bun:test";
import { collectPublicGitHubProfile, createGitHubRequestLimiter } from "../src";

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
};

describe("shared GitHub request admission", () => {
  test("grants FIFO leases, removes cancelled waiters and rejects overflow", async () => {
    const limiter = createGitHubRequestLimiter({ maxConcurrentRequests: 1, maxQueuedRequests: 2 });
    const signal = new AbortController().signal;
    const release = await limiter.acquire(signal);
    const cancelled = new AbortController();
    const reason = new Error("caller stopped waiting");
    const first = limiter.acquire(cancelled.signal);
    const second = limiter.acquire(signal);
    void first.catch(() => {});
    expect(limiter.queuedCount).toBe(2);
    await expect(limiter.acquire(signal)).rejects.toMatchObject({ code: "github_request_queue_full" });
    cancelled.abort(reason);
    await expect(first).rejects.toBe(reason);
    expect(limiter.queuedCount).toBe(1);
    release(); release();
    const releaseSecond = await second;
    expect(limiter.activeCount).toBe(1); expect(limiter.queuedCount).toBe(0);
    releaseSecond(); expect(limiter.activeCount).toBe(0);
  });

  test("keeps admission through body consumption across simultaneous profiles", async () => {
    const limiter = createGitHubRequestLimiter({ maxConcurrentRequests: 1, maxQueuedRequests: 1 });
    const ready = deferred<void>();
    let body!: ReadableStreamDefaultController<Uint8Array>;
    let requests = 0;
    const fetcher = async () => {
      if (++requests > 1) return new Response("[]");
      return new Response(new ReadableStream<Uint8Array>({ start(controller) { body = controller; ready.resolve(); } }));
    };
    const first = collectPublicGitHubProfile("first", { fetcher, requestLimiter: limiter });
    await ready.promise;
    const second = collectPublicGitHubProfile("second", { fetcher, requestLimiter: limiter });
    expect(limiter.activeCount).toBe(1); expect(limiter.queuedCount).toBe(1); expect(requests).toBe(1);
    body.enqueue(new TextEncoder().encode("[]")); body.close();
    await Promise.all([first, second]);
    expect(requests).toBe(2); expect(limiter.activeCount).toBe(0); expect(limiter.queuedCount).toBe(0);
  });

  test("retry backoff releases its slot for other profiles", async () => {
    const limiter = createGitHubRequestLimiter({ maxConcurrentRequests: 1, maxQueuedRequests: 1 });
    const waiting = deferred<void>(); const resume = deferred<void>();
    let requests = 0;
    const first = collectPublicGitHubProfile("first", {
      requestLimiter: limiter,
      fetcher: async () => new Response("[]", { status: ++requests === 1 ? 503 : 200 }),
      runtime: { sleep: async () => { waiting.resolve(); await resume.promise; } }
    });
    await waiting.promise;
    expect(limiter.activeCount).toBe(0);
    await collectPublicGitHubProfile("second", { requestLimiter: limiter, fetcher: async () => new Response("[]") });
    resume.resolve(); await first;
    expect(requests).toBe(2); expect(limiter.activeCount).toBe(0);
  });

  test("total collection deadline cancels admission without starting HTTP work", async () => {
    const limiter = createGitHubRequestLimiter({ maxConcurrentRequests: 1 });
    const release = await limiter.acquire(new AbortController().signal);
    let expire!: () => void;
    let requests = 0;
    const operation = collectPublicGitHubProfile("queued", {
      requestLimiter: limiter, collectionTimeoutMilliseconds: 100,
      runtime: { scheduleTimeout: callback => { expire = callback; return () => {}; } },
      fetcher: async () => { requests++; return new Response("[]"); }
    });
    expire();
    await expect(operation).rejects.toMatchObject({ code: "github_collection_timeout" });
    expect(requests).toBe(0); expect(limiter.queuedCount).toBe(0);
    release(); expect(limiter.activeCount).toBe(0);
  });

  test("validates capacities and never admits a pre-cancelled request", async () => {
    for (const maxConcurrentRequests of [0, -1, 1.1, NaN, Infinity]) {
      expect(() => createGitHubRequestLimiter({ maxConcurrentRequests })).toThrow();
    }
    expect(() => createGitHubRequestLimiter({ maxQueuedRequests: -1 })).toThrow();
    const limiter = createGitHubRequestLimiter({ maxQueuedRequests: 0 });
    const caller = new AbortController(); caller.abort();
    await expect(limiter.acquire(caller.signal)).rejects.toBe(caller.signal.reason);
    expect(limiter.activeCount).toBe(0);
  });
});
