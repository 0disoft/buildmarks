import {
  dimensionLabels,
  signalDimensions,
  type DimensionScore,
  type Evidence,
  type ProfileInput,
  type RepoSignal,
  type SignalDimension,
  type UserSignalReport
} from "../shared/types";
import { classifySignalType } from "./signal-type";
import { scoreRepository, type ScoreRepoOptions } from "./score-repo";

const MAX_REPOSITORIES = 8;
const MAX_SINGLE_REPO_SHARE = 0.35;

export function scoreUserProfile(
  input: ProfileInput,
  options: ScoreRepoOptions = {}
): UserSignalReport {
  const generatedAt = input.generatedAt ?? (options.now ?? new Date()).toISOString();
  const includesPrivateSignals = input.signalVisibility?.privateRepositoriesIncluded === true;
  const eligibleRepositories = input.repositories.filter((repository) => !repository.isFork && !repository.isArchived);
  const topRepos = eligibleRepositories
    .map((repository) => scoreRepository(repository, options))
    .sort((left, right) => right.weight * right.overall - left.weight * left.overall)
    .slice(0, MAX_REPOSITORIES);

  const dimensions = averageDimensions(topRepos);
  const overallDimensions = includesPrivateSignals
    ? signalDimensions.filter((dimension) => dimension !== "externalValidation")
    : signalDimensions;
  const overall = Math.round(
    overallDimensions.reduce((total, dimension) => total + dimensions[dimension], 0) /
      overallDimensions.length
  );

  return {
    username: input.username,
    generatedAt,
    ...(input.signalVisibility ? { signalVisibility: input.signalVisibility } : {}),
    ...(includesPrivateSignals ? { unavailableDimensions: ["externalValidation" as const] } : {}),
    overall,
    signalType: classifySignalType(dimensions),
    dimensions,
    topRepos,
    evidence: collectProfileEvidence(topRepos),
    limitations: buildLimitations(
      input.repositories.length,
      eligibleRepositories.length,
      topRepos.length,
      includesPrivateSignals
    )
  };
}

function averageDimensions(repositories: readonly RepoSignal[]): Record<SignalDimension, number> {
  const empty = Object.fromEntries(signalDimensions.map((dimension) => [dimension, 0])) as Record<
    SignalDimension,
    number
  >;

  if (repositories.length === 0) {
    return empty;
  }

  const totalWeight = repositories.reduce((total, repository) => total + repository.weight, 0);
  const cappedWeights = repositories.map((repository) => cappedWeight(repository, totalWeight));
  const cappedTotal = cappedWeights.reduce((total, weight) => total + weight, 0);

  signalDimensions.forEach((dimension) => {
    const weighted = repositories.reduce(
      (total, repository, index) => total + repository.dimensions[dimension].score * (cappedWeights[index] ?? 0),
      0
    );
    empty[dimension] = cappedTotal === 0 ? 0 : Math.round(weighted / cappedTotal);
  });

  return empty;
}

function cappedWeight(repository: RepoSignal, totalWeight: number): number {
  if (totalWeight <= 0) {
    return repository.weight;
  }

  return Math.min(repository.weight, totalWeight * MAX_SINGLE_REPO_SHARE);
}

function collectProfileEvidence(repositories: readonly RepoSignal[]): Evidence[] {
  return repositories.flatMap((repository) => repository.evidence).slice(0, 6);
}

function buildLimitations(total: number, eligible: number, scored: number, includesPrivateSignals: boolean): string[] {
  const limitations = [
    includesPrivateSignals
      ? "Owner-supplied private repository signals are included and are not independently verifiable from public GitHub."
      : "Public GitHub data only.",
    includesPrivateSignals
      ? "Employer work, code review outside GitHub, and design work are not inferred."
      : "Private repositories, employer work, code review outside GitHub, and design work are not inferred.",
    "Raw commit counts, contribution streaks, follower counts, and language percentages are not scored directly."
  ];

  if (includesPrivateSignals) {
    limitations.push("Public adoption is shown as N/A because private repository adoption is not publicly verifiable.");
  }

  if (total !== eligible) {
    limitations.push("Forked and archived repositories are excluded by default.");
  }

  if (eligible > scored) {
    limitations.push(`Only the highest-signal ${scored} eligible repositories are summarized in this card.`);
  }

  return limitations;
}

export function makeEmptyDimensionScore(key: SignalDimension): DimensionScore {
  return {
    key,
    label: dimensionLabels[key],
    score: 0,
    maxScore: 100,
    evidence: []
  };
}
