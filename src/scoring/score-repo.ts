import {
  dimensionLabels,
  signalDimensions,
  type DimensionScore,
  type Evidence,
  type RepositoryInput,
  type RepoSignal,
  type SignalDimension
} from "../shared/types";
import { createEvidence } from "./evidence";

const RECENT_DAYS = 180;

type ScoredPart = {
  passed: boolean;
  points: number;
  evidence: Evidence;
};

export interface ScoreRepoOptions {
  now?: Date;
}

export function scoreRepository(
  repository: RepositoryInput,
  options: ScoreRepoOptions = {}
): RepoSignal {
  const now = options.now ?? new Date();
  const dimensions = {
    completeness: scoreBooleanDimension("completeness", [
      part(repository.hasReadme, 3, "README found", "file", repository.name),
      part(repository.hasUsageGuide, 4, "README includes usage guidance", "file", repository.name),
      part(repository.hasLicense, 2, "License file found", "file", repository.name),
      part(repository.hasReleases, 3, "Release or tag found", "release", repository.name),
      part(repository.hasDemoOrDocs, 3, "Demo or documentation link found", "repository", repository.name),
      part(repository.hasPackageArtifact, 3, "Package or installable artifact found", "repository", repository.name)
    ]),
    maintainability: scoreBooleanDimension("maintainability", [
      part(repository.hasTests, 5, "Test signal found", "file", repository.name),
      part(repository.hasCi, 5, "CI workflow found", "workflow", repository.name),
      part(repository.hasChangelog, 3, "Changelog or release notes found", "file", repository.name),
      part(repository.hasContributing, 2, "Contribution guide found", "file", repository.name),
      part(repository.hasCodeOfConduct, 1, "Code of conduct found", "file", repository.name),
      part(repository.hasSecurityPolicy, 1, "Security policy found", "file", repository.name),
      part(wasRecentlyPushed(repository.pushedAt, now), 3, "Recent maintenance activity", "repository", repository.name)
    ]),
    collaboration: scoreBooleanDimension("collaboration", [
      part(repository.pullRequestReviewCount > 0, 4, "Public PR review activity", "pull_request", repository.name),
      part(repository.issueResponseCount > 0, 4, "Public issue response activity", "issue", repository.name),
      part(repository.hasContributing, 3, "Contribution guide found", "file", repository.name),
      part(repository.hasCodeOfConduct, 2, "Code of conduct found", "file", repository.name),
      part(repository.externalContributorCount > 0, 4, "External contributor activity", "repository", repository.name),
      part(repository.pullRequestReviewCount >= 3, 3, "Multiple public reviews found", "pull_request", repository.name)
    ]),
    shipping: scoreBooleanDimension("shipping", [
      part(repository.hasReleases, 4, "Release or tag found", "release", repository.name),
      part(repository.hasPackageArtifact, 3, "Package or installable artifact found", "repository", repository.name),
      part(repository.hasDemoOrDocs, 3, "Demo or documentation link found", "repository", repository.name),
      part(wasRecentlyPushed(repository.pushedAt, now), 2, "Recent shipping or maintenance activity", "repository", repository.name),
      part(repository.hasSecurityPolicy, 1, "Security policy found", "file", repository.name)
    ]),
    consistency: scoreBooleanDimension("consistency", [
      part(hasLivedAtLeast(repository.createdAt, now, RECENT_DAYS), 4, "Public history over 180 days", "repository", repository.name),
      part(wasRecentlyPushed(repository.pushedAt, now), 3, "Repository has recent public activity", "repository", repository.name),
      part(repository.hasChangelog, 1, "Changelog found", "file", repository.name),
      part(repository.hasReleases, 2, "Release found", "release", repository.name)
    ]),
    externalValidation: scoreExternalValidation(repository)
  } satisfies Record<SignalDimension, DimensionScore>;

  const overall = weightedOverall(dimensions);
  const weight = repoWeight(dimensions);

  return {
    owner: repository.owner,
    name: repository.name,
    url: repository.url,
    dimensions,
    overall,
    weight,
    evidence: collectTopEvidence(dimensions)
  };
}

function part(
  passed: boolean,
  points: number,
  label: string,
  source: Evidence["source"],
  repo: string
): ScoredPart {
  return {
    passed,
    points,
    evidence: createEvidence(passed ? "positive" : "neutral", label, source, repo)
  };
}

function scoreBooleanDimension(
  key: SignalDimension,
  parts: readonly ScoredPart[]
): DimensionScore {
  const max = parts.reduce((total, item) => total + item.points, 0);
  const raw = parts.reduce((total, item) => total + (item.passed ? item.points : 0), 0);

  return {
    key,
    label: dimensionLabels[key],
    score: max === 0 ? 0 : Math.round((raw / max) * 100),
    maxScore: 100,
    evidence: parts.filter((item) => item.passed).map((item) => item.evidence)
  };
}

function scoreExternalValidation(repository: RepositoryInput): DimensionScore {
  const starScore = logCap(repository.stars, 500) * 30;
  const forkScore = logCap(repository.forks, 100) * 20;
  const contributorScore = logCap(repository.externalContributorCount, 20) * 30;
  const responseScore = logCap(repository.issueResponseCount, 20) * 10;
  const reviewScore = logCap(repository.pullRequestReviewCount, 20) * 10;
  const score = Math.round(starScore + forkScore + contributorScore + responseScore + reviewScore);

  return {
    key: "externalValidation",
    label: dimensionLabels.externalValidation,
    score: clampScore(score),
    maxScore: 100,
    evidence: [
      createEvidence(
        "neutral",
        "Stars, forks, and public participation use strict caps",
        "repository",
        repository.name
      )
    ]
  };
}

function weightedOverall(dimensions: Record<SignalDimension, DimensionScore>): number {
  const score =
    clampScore(dimensions.maintainability.score) * 0.25 +
    clampScore(dimensions.completeness.score) * 0.2 +
    clampScore(dimensions.collaboration.score) * 0.2 +
    clampScore(dimensions.shipping.score) * 0.15 +
    clampScore(dimensions.consistency.score) * 0.1 +
    clampScore(dimensions.externalValidation.score) * 0.1;

  return clampScore(Math.round(score));
}

function repoWeight(dimensions: Record<SignalDimension, DimensionScore>): number {
  return Number(
    (
      1 +
      clampScore(dimensions.completeness.score) / 100 * 0.3 +
      clampScore(dimensions.maintainability.score) / 100 * 0.3 +
      clampScore(dimensions.shipping.score) / 100 * 0.25 +
      clampScore(dimensions.externalValidation.score) / 100 * 0.15
    ).toFixed(3)
  );
}

function collectTopEvidence(dimensions: Record<SignalDimension, DimensionScore>): Evidence[] {
  return signalDimensions.flatMap((dimension) => dimensions[dimension].evidence).slice(0, 5);
}

function logCap(value: number, cap: number): number {
  const sanitizedValue = Number.isFinite(value) ? Math.max(0, value) : 0;
  const sanitizedCap = Number.isFinite(cap) && cap > 0 ? cap : 1;
  return Math.min(1, Math.log1p(sanitizedValue) / Math.log1p(sanitizedCap));
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, value));
}

function wasRecentlyPushed(value: string | null, now: Date): boolean {
  const date = parseDate(value);
  if (date === null) {
    return false;
  }

  return now.getTime() - date.getTime() <= RECENT_DAYS * 24 * 60 * 60 * 1000;
}

function hasLivedAtLeast(value: string | null, now: Date, days: number): boolean {
  const date = parseDate(value);
  if (date === null) {
    return false;
  }

  return now.getTime() - date.getTime() >= days * 24 * 60 * 60 * 1000;
}

function parseDate(value: string | null): Date | null {
  if (value === null) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
