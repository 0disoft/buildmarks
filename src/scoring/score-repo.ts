import {
  privateLocalSignalVisibility,
  scoringMethodologyVersion,
  signalDimensions,
  type RepoSignalV2,
  type RepositoryInput,
  type SignalDimension
} from "../shared/types.js";
import { assessRepository } from "./assessment.js";
import { validatePrivateRepositoryRecord } from "./private-disclosure.js";
import { resolveRepositoryKind } from "./repository-kind.js";

export const repositoryOverallWeights = {
  maintainability: 0.25,
  completeness: 0.2,
  usability: 0.15,
  shipping: 0.15,
  consistency: 0.1,
  stewardship: 0.15
} satisfies Record<SignalDimension, number>;

export interface ScoreRepoOptions {
  now?: Date;
}

export function scoreRepository(
  repository: RepositoryInput,
  options: ScoreRepoOptions = {}
): RepoSignalV2 {
  validatePrivateRepositoryRecord(repository);

  const now = options.now ?? new Date();
  const includesPrivateRepositories = isPrivateRepository(repository);
  const owner = includesPrivateRepositories ? "Private owner" : repository.owner;
  const repositoryKind = resolveRepositoryKind(repository);
  const assessed = assessRepository(repository, repositoryKind, now, repository.name);
  const weightedOverall = weightedRepositoryOverall(assessed.dimensions);
  const overallAssessment = {
    ...assessed.overall,
    score: assessed.overall.score === null ? null : weightedOverall
  };
  const overall = overallAssessment.score ?? 0;

  return {
    owner,
    name: repository.name,
    ...(repository.url === undefined ? {} : { url: repository.url }),
    ...(includesPrivateRepositories ? { signalVisibility: privateLocalSignalVisibility } : {}),
    methodologyVersion: scoringMethodologyVersion,
    repositoryKind,
    dimensions: assessed.dimensions,
    assessment: overallAssessment,
    overall,
    weight: 1,
    evidence: collectSummaryDetails(assessed.evidenceLedger),
    evidenceLedger: assessed.evidenceLedger
  };
}

function collectSummaryDetails(details: RepoSignalV2["evidenceLedger"]): RepoSignalV2["evidence"] {
  const preferred = details.filter((item) => item.basis === "corroborated");
  const remaining = details.filter((item) => item.basis !== "corroborated");
  return [...preferred, ...remaining].slice(0, 5);
}

function isPrivateRepository(repository: RepositoryInput): boolean {
  return repository.visibility === "private" || repository.redactedName === true;
}

export function weightedRepositoryOverall(
  dimensions: RepoSignalV2["dimensions"]
): number {
  const applicable = signalDimensions.filter(
    (dimension) => dimensions[dimension].assessment.score !== null
  );
  const totalWeight = applicable.reduce(
    (total, dimension) => total + repositoryOverallWeights[dimension],
    0
  );
  if (totalWeight === 0) {
    return 0;
  }
  return Math.round(
    applicable.reduce(
      (total, dimension) =>
        total + (dimensions[dimension].assessment.score ?? 0) * repositoryOverallWeights[dimension],
      0
    ) / totalWeight
  );
}
