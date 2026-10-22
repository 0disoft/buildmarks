export type TimeoutScheduler = (callback: () => void, milliseconds: number) => () => void;

export interface GitHubCollectorRuntime {
  scheduleTimeout: TimeoutScheduler;
  sleep(milliseconds: number, signal: AbortSignal): Promise<void>;
}

export const scheduleTimeout: TimeoutScheduler = (callback, milliseconds) => {
  const timer = setTimeout(callback, milliseconds);
  return () => clearTimeout(timer);
};

export function resolveCollectorRuntime(runtime: Partial<GitHubCollectorRuntime> = {}): GitHubCollectorRuntime {
  const schedule = runtime.scheduleTimeout ?? scheduleTimeout;
  return {
    scheduleTimeout: schedule,
    sleep: runtime.sleep ?? ((milliseconds, signal) => new Promise<void>((resolve, reject) => {
      if (signal.aborted) { reject(new DOMException("Retry wait was cancelled.", "AbortError")); return; }
      const abort = () => { cancel(); signal.removeEventListener("abort", abort); reject(new DOMException("Retry wait was cancelled.", "AbortError")); };
      const cancel = schedule(() => { signal.removeEventListener("abort", abort); resolve(); }, milliseconds);
      signal.addEventListener("abort", abort, { once: true });
    }))
  };
}
