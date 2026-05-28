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
  const eligibleRepositories = input.repositories.filter((repository) => !repository.isFork && !repository.isArchived);
  const topRepos = eligibleRepositories
    .map((repository) => scoreRepository(repository, options))
    .sort((left, right) => right.weight * right.overall - left.weight * left.overall)
    .slice(0, MAX_REPOSITORIES);

  const dimensions = averageDimensions(topRepos);
  const overall = Math.round(
    signalDimensions.reduce((total, dimension) => total + dimensions[dimension], 0) /
      signalDimensions.length
  );

  return {
    username: input.username,
    generatedAt,
    overall,
    signalType: classifySignalType(dimensions),
    dimensions,
    topRepos,
    evidence: collectProfileEvidence(topRepos),
    limitations: buildLimitations(input.repositories.length, eligibleRepositories.length, topRepos.length)
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

  for (const dimension of signalDimensions) {
    const weighted = repositories.reduce(
      (total, repository) => total + repository.dimensions[dimension].score * cappedWeight(repository, totalWeight),
      0
    );
    const cappedTotal = repositories.reduce((total, repository) => total + cappedWeight(repository, totalWeight), 0);
    empty[dimension] = cappedTotal === 0 ? 0 : Math.round(weighted / cappedTotal);
  }

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

function buildLimitations(total: number, eligible: number, scored: number): string[] {
  const limitations = [
    "Public GitHub data only.",
    "Private repositories, employer work, code review outside GitHub, and design work are not inferred.",
    "Raw commit counts, contribution streaks, follower counts, and language percentages are not primary scores."
  ];

  if (total !== eligible) {
    limitations.push("Forked and archived repositories are excluded by default.");
  }

  if (eligible > scored) {
    limitations.push(`Only the strongest ${scored} eligible repositories are summarized in this card.`);
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
