export function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Buildmarks operation was cancelled.", "AbortError");
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/** Also settles when an injected operation fails to cooperate with cancellation. */
export async function runAbortable<T>(operation: () => Promise<T>, signal: AbortSignal): Promise<T> {
  throwIfCancelled(signal);
  let abort = () => {};
  const aborted = new Promise<never>((_resolve, reject) => {
    abort = () => reject(new DOMException("Buildmarks operation was cancelled.", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
  });
  try {
    return await Promise.race([operation(), aborted]);
  } finally {
    signal.removeEventListener("abort", abort);
  }
}
