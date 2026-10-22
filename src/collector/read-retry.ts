import { githubRequestPolicy } from "./request-policy.js";

export type ReadAttempt<T> = { retry: true } | { retry: false; value: T };

/** Only GitHub reads use this policy. Writes and retry-wait failures never enter it. */
export async function readWithRetry<T>(
  run: (attempt: number) => Promise<ReadAttempt<T>>,
  wait: (attempt: number) => Promise<void>,
  signal: AbortSignal
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    signal.throwIfAborted();
    try {
      const result = await run(attempt);
      if (!result.retry) return result.value;
    } catch (error) {
      signal.throwIfAborted();
      if (!isTransientReadError(error) || attempt >= githubRequestPolicy.retryCount) throw error;
    }
    if (attempt >= githubRequestPolicy.retryCount) throw new Error("Read retry budget exhausted.");
    await wait(attempt);
  }
}

const transientCodes = new Set([
  "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN", "ENETUNREACH", "EHOSTUNREACH", "EPIPE",
  "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT", "UND_ERR_SOCKET"
]);

export function isTransientReadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === "AbortError" || error instanceof SyntaxError) return false;
  if (error.name === "TimeoutError") return true;
  const code = (error as Error & { code?: unknown }).code;
  if (typeof code === "string" && transientCodes.has(code)) return true;
  const causeCode = error.cause && typeof error.cause === "object" && "code" in error.cause ? error.cause.code : undefined;
  if (typeof causeCode === "string" && transientCodes.has(causeCode)) return true;
  // Native fetch implementations do not all expose a structured network cause.
  return error instanceof TypeError && /^(fetch failed|failed to fetch|network request failed|load failed|terminated)$/i.test(error.message);
}
