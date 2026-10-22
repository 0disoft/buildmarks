import { GitHubCollectorError } from "./github-errors.js";
import { githubRequestPolicy } from "./request-policy.js";

export interface GitHubRequestLimiter {
  readonly activeCount: number;
  readonly queuedCount: number;
  acquire(signal: AbortSignal): Promise<() => void>;
}

interface Waiter {
  signal: AbortSignal;
  abort: () => void;
  resolve: (release: () => void) => void;
  reject: (error: unknown) => void;
}

/** Share one instance across collectors to bound transport work and FIFO queue memory. */
export function createGitHubRequestLimiter(options: {
  maxConcurrentRequests?: number;
  maxQueuedRequests?: number;
} = {}): GitHubRequestLimiter {
  const concurrency = options.maxConcurrentRequests ?? githubRequestPolicy.maximumConcurrentRequests;
  const queueLimit = options.maxQueuedRequests ?? githubRequestPolicy.maximumQueuedRequests;
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || !Number.isSafeInteger(queueLimit) || queueLimit < 0) {
    throw new GitHubCollectorError("invalid_policy", "Request concurrency must be a positive safe integer and queue capacity a non-negative safe integer.");
  }
  let active = 0;
  const queue = new Map<symbol, Waiter>();

  const lease = () => {
    active++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      active--;
      drain();
    };
  };
  const drain = () => {
    while (active < concurrency && queue.size > 0) {
      const [key, waiter] = queue.entries().next().value!;
      queue.delete(key);
      waiter.signal.removeEventListener("abort", waiter.abort);
      if (waiter.signal.aborted) waiter.reject(waiter.signal.reason);
      else waiter.resolve(lease());
    }
  };

  return {
    get activeCount() { return active; },
    get queuedCount() { return queue.size; },
    async acquire(signal) {
      signal.throwIfAborted();
      if (active < concurrency && queue.size === 0) return lease();
      if (queue.size >= queueLimit) {
        throw new GitHubCollectorError("github_request_queue_full", "GitHub request queue is full; retry collection after active work finishes.");
      }
      return new Promise((resolve, reject) => {
        const key = Symbol();
        const abort = () => { queue.delete(key); reject(signal.reason); };
        queue.set(key, { signal, abort, resolve, reject });
        signal.addEventListener("abort", abort, { once: true });
      });
    }
  };
}

// Process-local admission control; separate workers may inject a shared coordinator.
export const defaultGitHubRequestLimiter = createGitHubRequestLimiter();
