export function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw cancellationError(signal);
}

/** Preserve the public AbortError contract, including custom cancellation reasons. */
export function cancellationError(signal: AbortSignal): Error {
  if (isAbortError(signal.reason)) return signal.reason;
  const error = new Error("Buildmarks operation was cancelled.", { cause: signal.reason });
  error.name = "AbortError";
  return error;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/** Also settles when an injected operation fails to cooperate with cancellation. */
export async function runAbortable<T>(operation: () => Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  let abort = () => {};
  const aborted = new Promise<never>((_resolve, reject) => {
    abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
  });
  try {
    return await Promise.race([operation(), aborted]);
  } finally {
    signal.removeEventListener("abort", abort);
  }
}
