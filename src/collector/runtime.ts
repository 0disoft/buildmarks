import type { CleanupErrorHandler } from "../shared/cleanup-diagnostics.js";

export type TimeoutScheduler = (callback: () => void, milliseconds: number) => () => void;

export interface GitHubCollectorRuntime {
  scheduleTimeout: TimeoutScheduler;
  sleep(milliseconds: number, signal: AbortSignal): Promise<void>;
  onCleanupError?: CleanupErrorHandler;
}

export const scheduleTimeout: TimeoutScheduler = (callback, milliseconds) => {
  const timer = setTimeout(callback, milliseconds);
  return () => clearTimeout(timer);
};

export function resolveCollectorRuntime(runtime: Partial<GitHubCollectorRuntime> = {}): GitHubCollectorRuntime {
  const schedule = runtime.scheduleTimeout ?? scheduleTimeout;
  return {
    scheduleTimeout: schedule,
    ...(runtime.onCleanupError === undefined ? {} : { onCleanupError: runtime.onCleanupError }),
    sleep: runtime.sleep ?? ((milliseconds, signal) => new Promise<void>((resolve, reject) => {
      if (signal.aborted) { reject(signal.reason); return; }
      const abort = () => { cancel(); signal.removeEventListener("abort", abort); reject(signal.reason); };
      const cancel = schedule(() => { signal.removeEventListener("abort", abort); resolve(); }, milliseconds);
      signal.addEventListener("abort", abort, { once: true });
    }))
  };
}
