import { describe, expect, test } from "bun:test";
import { collectPublicGitHubProfile } from "../src";
import { redactErrorCause } from "../src/collector/github-errors";
import { readWithRetry } from "../src/collector/read-retry";
import { fetchWithTimeout } from "../src/collector/request-timeout";

describe("read failure isolation", () => {
  test("preserves the transport cause after exactly one retry", async () => {
    const socket = Object.assign(new Error("socket closed"), { code: "ECONNRESET" });
    const failure = new TypeError("fetch failed", { cause: socket });
    let requests = 0;
    await expect(collectPublicGitHubProfile("probe", {
      fetcher: async () => { requests++; throw failure; }, runtime: { sleep: async () => {} }
    })).rejects.toMatchObject({ code: "github_request_failed", cause: failure });
    expect(requests).toBe(2);
  });

  for (const failure of [new TypeError("Cannot read properties of undefined"), new SyntaxError("Invalid JSON"), new Error("adapter bug")]) {
    test(`does not retry permanent adapter errors: ${failure.name}`, async () => {
      let requests = 0;
      await expect(collectPublicGitHubProfile("probe", {
        fetcher: async () => { requests++; throw failure; }
      })).rejects.toBe(failure);
      expect(requests).toBe(1);
    });
  }

  test("does not replay a read when the retry scheduler fails", async () => {
    const failure = new Error("scheduler failed");
    let requests = 0;
    await expect(readWithRetry(async () => { requests++; return { retry: true }; }, async () => { throw failure; }, new AbortController().signal))
      .rejects.toBe(failure);
    expect(requests).toBe(1);
  });

  test("keeps a custom caller cancellation reason without retrying", async () => {
    const caller = new AbortController();
    const reason = new Error("caller disconnected");
    let ready!: () => void;
    const started = new Promise<void>(resolve => { ready = resolve; });
    let requests = 0;
    const operation = collectPublicGitHubProfile("probe", {
      signal: caller.signal, fetcher: async () => { requests++; ready(); return new Promise(() => {}); }
    });
    void operation.catch(() => {});
    await started;
    caller.abort(reason);
    await expect(operation).rejects.toMatchObject({ name: "AbortError", cause: reason });
    expect(requests).toBe(1);
  });

  test("distinguishes a request timeout from parent cancellation", async () => {
    const reason = new Error("parent stopped");
    const caller = new AbortController();
    const operation = fetchWithTimeout(async () => new Promise(() => {}), "https://example.invalid", {
      headers: {}, signal: caller.signal, timeoutMilliseconds: 10000
    }, response => response.text());
    caller.abort(reason);
    await expect(operation).rejects.toBe(reason);
  });

  test("redacts nested diagnostic causes without mutating the original", () => {
    const socket = Object.assign(new Error("secret-project socket"), { code: "ECONNRESET", token: "never copy metadata" });
    const failure = new TypeError("secret-project failed", { cause: socket });
    const copy = redactErrorCause(failure, value => value.replaceAll("secret-project", "Private repository")) as Error;
    expect(copy.name).toBe("TypeError");
    expect(copy.message).not.toContain("secret-project");
    expect(copy.stack).not.toContain("secret-project");
    expect(copy.cause).toMatchObject({ code: "ECONNRESET", message: "Private repository socket" });
    expect(copy.cause).not.toHaveProperty("token");
    expect(socket.message).toBe("secret-project socket");
  });
});
