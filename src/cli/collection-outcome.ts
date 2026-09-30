import { access } from "node:fs/promises";
import type { ProfileInput, UserSignalReport } from "../shared/types.js";

export class InsufficientEvidenceError extends Error {
  constructor(profile: ProfileInput) {
    const attempted = profile.repositoryCollectionAttemptCount ?? profile.repositories.length;
    const failed = profile.repositoryCollectionFailureCount ?? 0;
    const truncated = profile.repositories.filter((repository) => repository.codebaseShape?.treeTruncated === true).length;
    const summaries = profile.repositoryCollectionFailures ?? [];
    const detail = summaries.length === 0
      ? "no safe failure details were recorded"
      : summaries.map((failure) =>
        `${failure.code}/${failure.operation}${failure.status === undefined ? "" : `/status-${failure.status}`}=${failure.count}`
      ).join(", ");
    super(`Not enough complete repository data: attempted=${attempted}, failed=${failed}, truncated=${truncated}; ${detail}.`);
    this.name = "InsufficientEvidenceError";
  }
}

export function assertSufficientEvidence(profile: ProfileInput, report: UserSignalReport): void {
  if (report.evidenceStatus === "insufficient") {
    throw new InsufficientEvidenceError(profile);
  }
}

export async function hasExistingOutput(paths: readonly string[]): Promise<boolean> {
  for (const path of paths) {
    try {
      await access(path);
      return true;
    } catch (error) {
      // Permission and I/O failures are not proof that a destination is absent.
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        return true;
      }
    }
  }
  return false;
}
