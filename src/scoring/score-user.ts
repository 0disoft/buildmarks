import {
  dimensionLabels,
  signalDimensions,
  type DimensionScore,
  type Evidence,
  type ProfileInput,
  type RepoSignal,
  type SignalDimension,
  type SignalType,
  type UserSignalReport
} from "../shared/types";
import { classifySignalType } from "./signal-type";
import { scoreRepository, type ScoreRepoOptions } from "./score-repo";

const MAX_REPOSITORIES = 12;
const MAX_SINGLE_REPO_SHARE = 0.35;

export interface ScoreUserProfileOptions extends ScoreRepoOptions {
  maxRepositories?: number;
}

export function scoreUserProfile(
  input: ProfileInput,
  options: ScoreUserProfileOptions = {}
): UserSignalReport {
  const generatedAt = input.generatedAt ?? (options.now ?? new Date()).toISOString();
  const includesPrivateSignals = input.signalVisibility?.privateRepositoriesIncluded === true;
  const maxRepositories = resolveMaxRepositories(options.maxRepositories);
  const eligibleRepositories = input.repositories.filter((repository) => !repository.isFork && !repository.isArchived);
  const hasTruncatedFileTree = eligibleRepositories.some((repository) => repository.codebaseShape?.treeTruncated === true);
  const topRepos = eligibleRepositories
    .map((repository) => scoreRepository(repository, options))
    .sort((left, right) => right.weight * right.overall - left.weight * left.overall)
    .slice(0, maxRepositories);

  const dimensions = averageDimensions(topRepos);
  const signalType = classifySignalType(dimensions);
  const overallDimensions = includesPrivateSignals
    ? signalDimensions.filter((dimension) => dimension !== "externalValidation")
    : signalDimensions;
  const contextualOverallDimensions = signalType === "Independent Builder"
    ? overallDimensions.filter((dimension) => dimension !== "collaboration")
    : overallDimensions;
  const overall = Math.round(
    contextualOverallDimensions.reduce((total, dimension) => total + dimensions[dimension], 0) /
      contextualOverallDimensions.length
  );

  return {
    username: input.username,
    generatedAt,
    ...(input.activityWindowDays === undefined ? {} : { activityWindowDays: input.activityWindowDays }),
    ...(input.signalVisibility ? { signalVisibility: input.signalVisibility } : {}),
    ...(includesPrivateSignals ? { unavailableDimensions: ["externalValidation" as const] } : {}),
    overall,
    signalType,
    dimensions,
    topRepos,
    evidence: collectProfileEvidence(topRepos),
    limitations: buildLimitations(
      input.repositories.length,
      eligibleRepositories.length,
      topRepos.length,
      includesPrivateSignals,
      signalType,
      input.activityWindowDays,
      hasTruncatedFileTree,
      input.activityAggregatesDeferred === true,
      input.repositoryCollectionFailureCount ?? 0
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

  const cappedWeights = capRepositoryWeights(repositories);
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

function capRepositoryWeights(repositories: readonly RepoSignal[]): number[] {
  const weights = repositories.map((repository) => Math.max(0, repository.weight));
  if (weights.length === 0) {
    return [];
  }

  const maxShare = Math.max(MAX_SINGLE_REPO_SHARE, 1 / weights.length);
  let cappedWeights = weights;

  for (let iteration = 0; iteration < 32; iteration += 1) {
    const cappedTotal = cappedWeights.reduce((total, weight) => total + weight, 0);
    if (cappedTotal <= 0) {
      return cappedWeights;
    }

    const maxWeight = cappedTotal * maxShare;
    let changed = false;
    const nextWeights = cappedWeights.map((weight) => {
      const nextWeight = Math.min(weight, maxWeight);
      if (Math.abs(nextWeight - weight) > 0.000001) {
        changed = true;
      }
      return nextWeight;
    });

    cappedWeights = nextWeights;
    if (!changed) {
      return cappedWeights;
    }
  }

  return cappedWeights;
}

function collectProfileEvidence(repositories: readonly RepoSignal[]): Evidence[] {
  return repositories.flatMap((repository) => repository.evidence).slice(0, 6);
}

function buildLimitations(
  total: number,
  eligible: number,
  scored: number,
  includesPrivateSignals: boolean,
  signalType: SignalType,
  activityWindowDays: number | undefined,
  hasTruncatedFileTree: boolean,
  activityAggregatesDeferred: boolean,
  repositoryCollectionFailureCount: number
): string[] {
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

  if (signalType === "Independent Builder") {
    limitations.push("Public collaboration is treated as context for independent-builder profiles.");
  }

  if (activityWindowDays !== undefined) {
    limitations.push(`Repositories are filtered to activity within the last ${activityWindowDays} days.`);
  }

  if (hasTruncatedFileTree) {
    limitations.push("Some GitHub repository file trees were truncated, so file-based signals may be incomplete.");
  }

  if (activityAggregatesDeferred) {
    limitations.push("Live GitHub issue, pull request, and external contributor aggregates are deferred in this version.");
  }

  if (repositoryCollectionFailureCount > 0) {
    limitations.push(
      `${repositoryCollectionFailureCount} repositories could not be collected from GitHub and were omitted from this report.`
    );
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

function resolveMaxRepositories(value: number | undefined): number {
  if (value === undefined) {
    return MAX_REPOSITORIES;
  }

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("maxRepositories must be a positive integer.");
  }

  return value;
}
