export type CleanupErrorHandler = (error: unknown) => void | Promise<void>;

/** Diagnostics must not replace the primary failure or keep a cancelled call alive. */
export function reportCleanupError(error: unknown, handler?: CleanupErrorHandler): void {
  try {
    void Promise.resolve(handler?.(error)).catch(() => undefined);
  } catch {
    // A diagnostic observer is best-effort; it never owns operation completion.
  }
}
