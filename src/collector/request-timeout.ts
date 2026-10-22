import { githubRequestPolicy } from "./request-policy.js";
import type { GitHubCollectorFetch } from "./github-client.js";
import { scheduleTimeout, type TimeoutScheduler } from "./runtime.js";
import { reportCleanupError, type CleanupErrorHandler } from "../shared/cleanup-diagnostics.js";

/** Keep cancellation and the deadline active until the response is consumed. */
export async function fetchWithTimeout<T>(
  fetcher: GitHubCollectorFetch,
  url: string,
  options: { headers: Record<string, string>; timeoutMilliseconds: number; signal: AbortSignal; scheduleTimeout?: TimeoutScheduler; onCleanupError?: CleanupErrorHandler },
  consume: (response: Response) => Promise<T>
): Promise<T> {
  options.signal.throwIfAborted();
  if (!Number.isSafeInteger(options.timeoutMilliseconds) || options.timeoutMilliseconds <= 0 || options.timeoutMilliseconds > githubRequestPolicy.maximumTimerMilliseconds) {
    throw new Error(`Request timeout must be a positive integer at most ${githubRequestPolicy.maximumTimerMilliseconds} milliseconds.`);
  }
  const controller = new AbortController();
  const abortFromBatch = () => controller.abort(options.signal.reason);
  let abortRequest: (() => void) | undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    abortRequest = () => reject(controller.signal.reason);
    controller.signal.addEventListener("abort", abortRequest, { once: true });
  });
  // Timer setup can fail before Promise.race attaches its rejection handler.
  void aborted.catch(() => undefined);
  if (options.signal.aborted) abortFromBatch();
  else options.signal.addEventListener("abort", abortFromBatch, { once: true });
  let cancelTimeout = () => {};
  let response: Response | undefined;
  let completed = false;

  try {
    cancelTimeout = (options.scheduleTimeout ?? scheduleTimeout)(() => controller.abort(
      new DOMException("GitHub request timed out before its response was consumed.", "TimeoutError")
    ), options.timeoutMilliseconds);
    const request = async () => {
      controller.signal.throwIfAborted();
      const received = await fetcher(url, { headers: options.headers, signal: controller.signal });
      response = received;
      try {
        controller.signal.throwIfAborted();
        return await consume(received);
      } finally {
        // A non-cooperative adapter may return headers after the outer call ended.
        if (controller.signal.aborted) cancelResponseBody(received, options.onCleanupError);
      }
    };
    const result = await Promise.race([request(), aborted]);
    completed = true;
    return result;
  } finally {
    // Settle the original result before aborting, so cleanup cannot replace it.
    if (!completed || (response?.body !== null && response?.bodyUsed === false)) {
      controller.abort();
      cancelResponseBody(response, options.onCleanupError);
    }
    cancelTimeout();
    options.signal.removeEventListener("abort", abortFromBatch);
    if (abortRequest !== undefined) controller.signal.removeEventListener("abort", abortRequest);
  }
}

function cancelResponseBody(response: Response | undefined, handler?: CleanupErrorHandler): void {
  if (response?.body && !response.body.locked) {
    // Abort owns transport cancellation; a custom stream's cleanup must not hang it.
    void response.body.cancel().catch(error => reportCleanupError(error, handler));
  }
}
