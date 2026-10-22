import { isOutputLockError } from "./output-lock.js";

/** Never trigger a fallback write after incomplete cleanup or an uncertain output state. */
export class OutputCleanupError extends AggregateError {
  constructor(readonly committed: boolean, failures: readonly unknown[], cause?: unknown) {
    const details = [cause, ...failures].filter(value => value !== undefined)
      .map(value => value instanceof Error ? value.message : "unknown failure").join("; ");
    super(failures, `Output ${committed ? "was committed, but cleanup failed" : "failed and cleanup was incomplete"}: ${details}`, { cause });
    this.name = "OutputCleanupError";
  }
}

export class OutputInspectionError extends Error {
  constructor(cause: unknown) {
    super("Cannot determine whether existing output is accessible; no fallback was written.", { cause });
    this.name = "OutputInspectionError";
  }
}

export function isOutputSafetyError(error: unknown): boolean {
  return isOutputLockError(error) || error instanceof OutputCleanupError || error instanceof OutputInspectionError;
}
