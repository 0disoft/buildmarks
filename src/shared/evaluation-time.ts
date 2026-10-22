/** Explicit time overrides a saved snapshot; otherwise a snapshot can be replayed. */
export function resolveEvaluationTime(now?: Date, generatedAt?: string): Date {
  const value = now ?? (generatedAt === undefined ? new Date() : new Date(generatedAt));
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new Error("Evaluation time must be a valid Date or generatedAt timestamp.");
  }
  return new Date(value.getTime());
}
