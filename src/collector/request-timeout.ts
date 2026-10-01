import type { GitHubCollectorFetch } from "./github-client.js";

/** Keep cancellation and the deadline active until the response is consumed. */
export async function fetchWithTimeout<T>(
  fetcher: GitHubCollectorFetch,
  url: string,
  options: { headers: Record<string, string>; timeoutMilliseconds: number; signal: AbortSignal },
  consume: (response: Response) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  const abortFromBatch = () => controller.abort();
  let abortRequest: (() => void) | undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    abortRequest = () => reject(new DOMException("GitHub request was aborted before its response was consumed.", "AbortError"));
    controller.signal.addEventListener("abort", abortRequest, { once: true });
  });
  if (options.signal.aborted) controller.abort();
  else options.signal.addEventListener("abort", abortFromBatch, { once: true });
  const timeout = setTimeout(() => controller.abort(), options.timeoutMilliseconds);

  try {
    const request = async () => {
      controller.signal.throwIfAborted();
      const response = await fetcher(url, { headers: options.headers, signal: controller.signal });
      controller.signal.throwIfAborted();
      return consume(response);
    };
    return await Promise.race([request(), aborted]);
  } finally {
    clearTimeout(timeout);
    options.signal.removeEventListener("abort", abortFromBatch);
    if (abortRequest !== undefined) controller.signal.removeEventListener("abort", abortRequest);
  }
}
