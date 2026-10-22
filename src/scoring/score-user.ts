import { scoringCoveragePolicy } from "../shared/evidence-policy.js";
import { reportDisplayPolicy } from "../shared/report-policy.js";
import {
  dimensionLabels,
  scoringMethodologyVersion,
  signalDimensions,
  type DimensionScore,
  type Evidence,
  type ProfileInput,
  type RepoSignalV2,
  type RepositoryInput,
  type ResultStatus,
  type ScoreAssessment,
  type SignalDimension,
  type SignalType,
  type UserSignalReportV2
} from "../shared/types.js";
import { privateLocalPublicCommitWarning } from "../shared/private-local-warning.js";
import { resolveEvaluationTime } from "../shared/evaluation-time.js";
import { aggregateScoreAssessments } from "./assessment.js";
import { resolveCollectionCounts } from "./collection-counts.js";
import { classifySignalType } from "./signal-type.js";
import { validatePrivateRepositoryDisclosure } from "./private-disclosure.js";
import { normalizeProfileRepositories } from "../shared/repository-identity.js";
import {
  repositoryOverallWeights,
  scoreRepository,
  type ScoreRepoOptions
} from "./score-repo.js";


export interface ScoreUserProfileOptions extends ScoreRepoOptions {
  maxRepositories?: number;
}

interface EvaluatedRepository {
  input: RepositoryInput;
  scored: RepoSignalV2;
}

export function scoreUserProfile(
  input: ProfileInput,
  options: ScoreUserProfileOptions = {}
): UserSignalReportV2 {
  validatePrivateRepositoryDisclosure(input);
  input = normalizeProfileRepositories(input);
  const now = resolveEvaluationTime(options.now, input.generatedAt);
  const generatedAt = now.toISOString();
  const displayLimit = resolveMaxRepositories(options.maxRepositories);
  const collection = prepareProfileCollection(input);
  const evaluated = collection.completeTreeRepositories.map((repository) => ({
    input: repository,
    scored: scoreRepository(repository, { ...options, now })
  }));
  const displayed = selectDisplayedRepositories(evaluated, displayLimit);
  const assessment = assessProfile(evaluated, collection);
  const evidenceLedger = evaluated.flatMap(({ scored }) => scored.evidenceLedger);
  return {
    username: input.username,
    generatedAt,
    ...(input.activityWindowDays === undefined ? {} : { activityWindowDays: input.activityWindowDays }),
    ...(input.signalVisibility ? { signalVisibility: { ...input.signalVisibility } } : {}),
    methodologyVersion: scoringMethodologyVersion,
    ...assessment,
    selection: {
      strategy: "kind-stratified",
      eligibleCount: collection.eligibleRepositories.length,
      evaluatedCount: evaluated.length,
      displayedCount: displayed.length,
      displayLimit,
      attemptedCount: collection.collectionAttemptCount,
      missedCount: collection.collectionFailureCount + collection.truncatedRepositoryCount,
      checkedRatio: collection.collectionCheckedRatio
    },
    topRepos: displayed.map(({ scored }) => scored),
    evidence: collectProfileHighlights(evidenceLedger),
    evidenceLedger,
    limitations: buildLimitations(input, collection, evaluated.length, displayed.length, assessment)
  };
}

function prepareProfileCollection(input: ProfileInput) {
  const eligibleRepositories = input.repositories.filter(isEligibleRepository);
  const completeTreeRepositories = eligibleRepositories.filter(
    (repository) => repository.codebaseShape?.treeTruncated !== true
  );
  const truncatedRepositoryCount = eligibleRepositories.length - completeTreeRepositories.length;
  const { failed: collectionFailureCount, attempted: collectionAttemptCount } = resolveCollectionCounts(input);
  const collectionStatus = resolveCollectionStatus(
    collectionAttemptCount,
    collectionFailureCount,
    truncatedRepositoryCount
  );
  const collectionCheckedRatio = resolveCollectionCheckedRatio(
    collectionAttemptCount,
    collectionFailureCount,
    truncatedRepositoryCount
  );
  return {
    eligibleRepositories, completeTreeRepositories, truncatedRepositoryCount,
    collectionAttemptCount, collectionFailureCount, collectionStatus, collectionCheckedRatio
  };
}

type ProfileCollection = ReturnType<typeof prepareProfileCollection>;

function assessProfile(evaluated: readonly EvaluatedRepository[], collection: ProfileCollection) {
  const { collectionStatus, collectionCheckedRatio } = collection;
  const dimensionAssessments = Object.fromEntries(
    signalDimensions.map((dimension) => [
      dimension,
      aggregateScoreAssessments(
        evaluated.map(({ scored }) => scored.dimensions[dimension].assessment)
      )
    ])
  ) as Record<SignalDimension, ScoreAssessment>;
  const dimensions = Object.fromEntries(
    signalDimensions.map((dimension) => [dimension, dimensionAssessments[dimension].score ?? 0])
  ) as Record<SignalDimension, number>;
  const overallAssessment = aggregateScoreAssessments(
    signalDimensions.map((dimension) => dimensionAssessments[dimension]),
    signalDimensions.map((dimension) => repositoryOverallWeights[dimension])
  );
  const evidenceStatus = resolveEvidenceStatus(collectionStatus, overallAssessment);
  const unavailableDimensions = signalDimensions.filter(
    (dimension) => dimensionAssessments[dimension].applicability === "unavailable"
  );
  const notApplicableDimensions = signalDimensions.filter(
    (dimension) => dimensionAssessments[dimension].applicability === "not-applicable"
  );
  const signalType = classifySignalType(dimensions);
  const applicableDimensionCount = signalDimensions.length - notApplicableDimensions.length;
  const resultStatus = resolveResultStatus(
    evidenceStatus,
    overallAssessment,
    applicableDimensionCount,
    collectionCheckedRatio
  );
  return {
    evidenceStatus,
    ...(evidenceStatus === "insufficient"
      ? { unavailableDimensions: [...signalDimensions] }
      : unavailableDimensions.length > 0
        ? { unavailableDimensions }
        : {}),
    ...(notApplicableDimensions.length > 0 ? { notApplicableDimensions } : {}),
    overall: overallAssessment.score ?? 0,
    signalType,
    dimensions,
    dimensionAssessments,
    assessment: overallAssessment,
    confidence: overallAssessment.confidence,
    coverage: overallAssessment.coverage,
    resultStatus,
  };
}

function selectDisplayedRepositories(
  repositories: readonly EvaluatedRepository[],
  limit: number
): EvaluatedRepository[] {
  const ranked = [...repositories].sort(compareEvaluatedRepositories);
  if (ranked.length <= limit) {
    return ranked;
  }

  const representatives: EvaluatedRepository[] = [];
  const representedKinds = new Set<string>();
  for (const repository of ranked) {
    const kind = repository.scored.repositoryKind.kind;
    if (representedKinds.has(kind)) {
      continue;
    }
    representatives.push(repository);
    representedKinds.add(kind);
  }

  const selected = representatives.slice(0, limit);
  const selectedKeys = new Set(selected.map(repositoryKey));
  for (const repository of ranked) {
    if (selected.length >= limit) {
      break;
    }
    if (selectedKeys.has(repositoryKey(repository))) {
      continue;
    }
    selected.push(repository);
    selectedKeys.add(repositoryKey(repository));
  }

  return selected.sort(compareEvaluatedRepositories);
}

function compareEvaluatedRepositories(
  left: EvaluatedRepository,
  right: EvaluatedRepository
): number {
  const scoreDifference = right.scored.overall - left.scored.overall;
  if (scoreDifference !== 0) {
    return scoreDifference;
  }
  return repositoryKey(left).localeCompare(repositoryKey(right));
}

function repositoryKey(repository: EvaluatedRepository): string {
  return `${repository.input.owner}/${repository.input.name}`.toLowerCase();
}

function collectProfileHighlights(details: readonly Evidence[]): Evidence[] {
  const seen = new Set<string>();
  const preferred = [
    ...details.filter((item) => item.basis === "corroborated"),
    ...details.filter((item) => item.basis !== "corroborated")
  ];

  return preferred.filter((item) => {
    const key = `${item.criterionId ?? item.label}:${item.repo ?? ""}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  }).slice(0, reportDisplayPolicy.profileHighlightLimit);
}

function buildLimitations(
  input: ProfileInput, collection: ProfileCollection, evaluated: number, displayed: number,
  assessment: ReturnType<typeof assessProfile>
): string[] {
  return [
    ...buildScopeLimitations(input.signalVisibility?.privateRepositoriesIncluded === true),
    ...buildCollectionLimitations(input, collection),
    ...buildSelectionLimitations(input.repositories.length, collection.eligibleRepositories.length, evaluated, displayed),
    ...buildAssessmentLimitations(assessment.assessment, assessment.signalType)
  ];
}

function buildScopeLimitations(includesPrivateRepositories: boolean): string[] {
  const limitations = [
    includesPrivateRepositories
      ? "This result includes owner-supplied private repositories that cannot be checked independently on public GitHub."
      : "This result only reflects repositories visible on public GitHub.",
    includesPrivateRepositories
      ? "Employer work, off-GitHub review, and design work are outside this snapshot."
      : "Private work, employer work, off-GitHub review, and design work are outside this snapshot.",
    "Raw commit totals, contribution streaks, follower counts, and language percentages do not raise the score."
  ];

  if (includesPrivateRepositories) {
    limitations.push(privateLocalPublicCommitWarning);
    limitations.push(
      "Private-local cards use the same project checks as public cards, while keeping private file contents out of the output."
    );
  }

  return limitations;
}

function buildCollectionLimitations(input: ProfileInput, collection: ProfileCollection): string[] {
  const { activityWindowDays, activityAggregatesDeferred } = input;
  const { truncatedRepositoryCount, collectionFailureCount: repositoryCollectionFailureCount } = collection;
  const limitations: string[] = [];
  if (activityWindowDays !== undefined) {
    limitations.push(`Only repositories active within the last ${activityWindowDays} days were collected.`);
  }

  if (truncatedRepositoryCount > 0) {
    const repositoryLabel = truncatedRepositoryCount === 1 ? "repository" : "repositories";
    const verb = truncatedRepositoryCount === 1 ? "was" : "were";
    limitations.push(
      `${truncatedRepositoryCount} ${repositoryLabel} had an incomplete GitHub file tree and ${verb} left out of the calculation.`
    );
  }

  if (activityAggregatesDeferred === true) {
    limitations.push(
      "Issue replies, pull request reviews, and outside contributors are not folded into this version's score."
    );
  }

  if (repositoryCollectionFailureCount > 0) {
    const failedRepositoryLabel = repositoryCollectionFailureCount === 1 ? "repository" : "repositories";
    limitations.push(
      `${repositoryCollectionFailureCount} ${failedRepositoryLabel} could not be read from GitHub and ${repositoryCollectionFailureCount === 1 ? "was" : "were"} left out.`
    );
  }

  return limitations;
}

function buildSelectionLimitations(total: number, eligible: number, evaluated: number, displayed: number): string[] {
  const limitations: string[] = [];
  if (eligible === 0) {
    limitations.push("No eligible repositories were available for review.");
  }

  if (total !== eligible) {
    limitations.push("Forked and archived repositories are left out by default.");
  }

  if (evaluated > displayed) {
    const displayedRepositoryLabel = displayed === 1 ? "repository" : "repositories";
    const evaluatedRepositoryLabel = evaluated === 1 ? "repository" : "repositories";
    limitations.push(
      `The card shows ${displayed} representative ${displayedRepositoryLabel}, while the profile calculation uses all ${evaluated} reviewed ${evaluatedRepositoryLabel}.`
    );
  }

  return limitations;
}

function buildAssessmentLimitations(overallAssessment: ScoreAssessment, signalType: SignalType): string[] {
  const limitations: string[] = [];
  if (overallAssessment.coverage.expected > 0 && overallAssessment.coverage.ratio < 1) {
    limitations.push(
      `Buildmarks checked ${Math.round(overallAssessment.coverage.ratio * 100)}% of the project details used for this result.`
    );
  }

  if (signalType !== "General Signal Profile") {
    limitations.push("The profile label is a short description of the visible project mix, not a claim about the person behind it.");
  }

  return limitations;
}

function resolveCollectionStatus(
  attempted: number,
  failed: number,
  truncated: number
): "complete" | "partial" | "insufficient" {
  const unavailable = failed + truncated;
  if (attempted <= 0 || unavailable >= attempted || unavailable / attempted >= scoringCoveragePolicy.maximumUnavailableCollectionRatio) {
    return "insufficient";
  }
  return unavailable > 0 ? "partial" : "complete";
}

function resolveCollectionCheckedRatio(attempted: number, failed: number, truncated: number): number {
  if (attempted <= 0) {
    return 0;
  }
  const checked = Math.max(0, attempted - failed - truncated);
  return Math.min(1, checked / attempted);
}

function resolveEvidenceStatus(
  collectionStatus: "complete" | "partial" | "insufficient",
  assessment: ScoreAssessment
): "complete" | "partial" | "insufficient" {
  if (collectionStatus === "insufficient" || assessment.score === null) {
    return "insufficient";
  }
  if (collectionStatus === "partial" || assessment.coverage.ratio < 1) {
    return "partial";
  }
  return "complete";
}

function resolveResultStatus(
  evidenceStatus: "complete" | "partial" | "insufficient",
  assessment: ScoreAssessment,
  applicableDimensionCount: number,
  collectionCheckedRatio: number
): ResultStatus {
  if (evidenceStatus === "insufficient" || assessment.score === null) {
    return "unavailable";
  }
  if (
    assessment.coverage.ratio < scoringCoveragePolicy.confirmedAssessmentCoverage ||
    collectionCheckedRatio < scoringCoveragePolicy.confirmedCollectionCoverage ||
    applicableDimensionCount < scoringCoveragePolicy.minimumConfirmedDimensions
  ) {
    return "provisional";
  }
  return "confirmed";
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
    return reportDisplayPolicy.defaultRepositoryLimit;
  }
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("maxRepositories must be a positive integer.");
  }
  return value;
}

function isEligibleRepository(repository: { isFork: unknown; isArchived: unknown }): boolean {
  return repository.isFork === false && repository.isArchived === false;
}
