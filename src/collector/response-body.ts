import { GitHubCollectorError } from "./github-errors.js";
import { reportCleanupError, type CleanupErrorHandler } from "../shared/cleanup-diagnostics.js";

/** Count decoded transport bytes before JSON parsing, even without a trusted length header. */
export async function readBoundedText(
  response: Response, maximumBytes: number, signal: AbortSignal, onCleanupError?: CleanupErrorHandler
): Promise<string> {
  signal.throwIfAborted();
  const length = response.headers.get("content-length");
  if (length !== null && /^\d+$/.test(length) && Number(length) > maximumBytes) throw tooLarge(maximumBytes);
  if (response.body === null) return "";
  const reader = response.body.getReader();
  const cancel = (reason: unknown) => { void reader.cancel(reason).catch(error => reportCleanupError(error, onCleanupError)); };
  const abort = () => cancel(signal.reason);
  signal.addEventListener("abort", abort, { once: true });
  let buffer = new Uint8Array(0);
  let size = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      if (value.byteLength > maximumBytes - size) throw tooLarge(maximumBytes);
      const required = size + value.byteLength;
      if (required > buffer.byteLength) {
        const expanded = new Uint8Array(Math.min(maximumBytes, Math.max(required, buffer.byteLength * 2, 16_384)));
        expanded.set(buffer.subarray(0, size));
        buffer = expanded;
      }
      buffer.set(value, size);
      size = required;
    }
    return new TextDecoder().decode(buffer.subarray(0, size));
  } catch (error) {
    if (!signal.aborted) cancel(error);
    throw error;
  } finally {
    signal.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}

function tooLarge(maximumBytes: number): GitHubCollectorError {
  return new GitHubCollectorError("github_response_too_large", `GitHub response exceeded the ${maximumBytes}-byte limit.`);
}
