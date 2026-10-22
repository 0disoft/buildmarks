import type { ProfileInput } from "../shared/types.js";

/** Counts describe every eligible repository returned plus failed collection attempts. */
export function resolveCollectionCounts(input: ProfileInput) {
  const returned = input.repositories.filter((repository) => repository.isFork === false && repository.isArchived === false).length;
  const failed = input.repositoryCollectionFailureCount ?? 0;
  const attempted = input.repositoryCollectionAttemptCount ?? returned + failed;
  for (const [name, value] of [["repositoryCollectionFailureCount", failed], ["repositoryCollectionAttemptCount", attempted]] as const) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a non-negative safe integer.`);
  }
  if (!Number.isSafeInteger(returned + failed) || attempted !== returned + failed) {
    throw new Error("repositoryCollectionAttemptCount must equal eligible repositories plus repositoryCollectionFailureCount.");
  }
  return { failed, attempted };
}
