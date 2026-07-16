import {
  dimensionLabels,
  signalDimensions,
  type AssessmentConfidence,
  type CriterionAssessment,
  type DimensionAssessment,
  type DimensionScoreV2,
  type Evidence,
  type RepositoryInput,
  type RepositoryKindAssessment,
  type RepositoryObservationKey,
  type ScoreAssessment,
  type SignalDimension
} from "../shared/types.js";
import { codebaseShapeMetric } from "./codebase-shape.js";
import { createEvidence } from "./evidence.js";
import {
  methodologyCriteria,
  minimumScoringCoverage,
  presenceOnlyScoreCap,
  type CriterionCheck,
  type CriterionDefinition
} from "./methodology-v2.js";

const RECENT_DAYS = 180;

export interface RepositoryAssessmentResult {
  dimensions: Record<SignalDimension, DimensionScoreV2>;
  overall: ScoreAssessment;
  evidenceLedger: Evidence[];
}

export function assessRepository(
  repository: RepositoryInput,
  repositoryKind: RepositoryKindAssessment,
  now: Date,
  outputRepositoryName: string
): RepositoryAssessmentResult {
  const dimensions = Object.fromEntries(
    signalDimensions.map((dimension) => {
      const definitions = methodologyCriteria.filter((criterion) => criterion.dimension === dimension);
      const assessment = assessDimension(repository, repositoryKind, now, outputRepositoryName, dimension, definitions);
      const evidence = assessment.criteria.flatMap((criterion) =>
        criterion.evidenceIds.map((id) => makeCriterionEvidence(id, outputRepositoryName, definitions))
      );

      return [
        dimension,
        {
          key: dimension,
          label: dimensionLabels[dimension],
          score: assessment.score ?? 0,
          maxScore: 100,
          evidence,
          assessment
        } satisfies DimensionScoreV2
      ];
    })
  ) as Record<SignalDimension, DimensionScoreV2>;

  const overall = aggregateScoreAssessments(
    signalDimensions.map((dimension) => dimensions[dimension].assessment)
  );
  const evidenceLedger = signalDimensions.flatMap((dimension) => dimensions[dimension].evidence);

  return { dimensions, overall, evidenceLedger };
}

export function aggregateScoreAssessments(
  assessments: readonly ScoreAssessment[],
  weights?: readonly number[]
): ScoreAssessment {
  const applicable = assessments
    .map((assessment, index) => ({ assessment, weight: Math.max(0, weights?.[index] ?? 1) }))
    .filter(({ assessment }) => assessment.applicability !== "not-applicable");
  const expected = applicable.reduce((total, { assessment }) => total + assessment.coverage.expected, 0);
  const observed = applicable.reduce((total, { assessment }) => total + assessment.coverage.observed, 0);
  const coverage = makeCoverage(observed, expected);
  const scored = applicable.filter(
    ({ assessment, weight }) => assessment.score !== null && weight > 0
  );

  if (applicable.length === 0) {
    return {
      score: null,
      confidence: null,
      coverage,
      applicability: "not-applicable"
    };
  }

  if (scored.length === 0 || coverage.ratio < minimumScoringCoverage) {
    return {
      score: null,
      confidence: confidenceFromCoverage(coverage.ratio),
      coverage,
      applicability: "unavailable"
    };
  }

  const totalWeight = scored.reduce((total, item) => total + item.weight, 0);
  const weightedScore = scored.reduce(
    (total, { assessment, weight }) => total + (assessment.score ?? 0) * weight,
    0
  );

  return {
    score: totalWeight === 0 ? null : clampScore(Math.round(weightedScore / totalWeight)),
    confidence: confidenceFromCoverage(coverage.ratio),
    coverage,
    applicability: "applicable"
  };
}

export function confidenceFromCoverage(ratio: number): AssessmentConfidence {
  if (ratio >= 0.85) {
    return "high";
  }
  if (ratio >= 0.6) {
    return "medium";
  }
  return "low";
}

function assessDimension(
  repository: RepositoryInput,
  repositoryKind: RepositoryKindAssessment,
  now: Date,
  outputRepositoryName: string,
  dimension: SignalDimension,
  definitions: readonly CriterionDefinition[]
): DimensionAssessment {
  const unavailable = new Set(repository.unavailableObservations ?? []);
  const criteria = definitions.map((definition) =>
    assessCriterion(repository, repositoryKind, now, outputRepositoryName, definition, unavailable)
  );
  const applicableCriteria = criteria.filter((criterion) => criterion.applicability !== "not-applicable");
  const observedCriteria = applicableCriteria.filter((criterion) => criterion.observed !== null);
  const coverage = makeCoverage(observedCriteria.length, applicableCriteria.length);

  if (applicableCriteria.length === 0) {
    return {
      dimension,
      score: null,
      confidence: null,
      coverage,
      applicability: "not-applicable",
      presenceOnlyCapApplied: false,
      criteria
    };
  }

  if (observedCriteria.length === 0 || coverage.ratio < minimumScoringCoverage) {
    return {
      dimension,
      score: null,
      confidence: confidenceFromCoverage(coverage.ratio),
      coverage,
      applicability: "unavailable",
      presenceOnlyCapApplied: false,
      criteria
    };
  }

  const pointsAvailable = observedCriteria.reduce((total, criterion) => total + criterion.pointsAvailable, 0);
  const pointsAwarded = observedCriteria.reduce((total, criterion) => total + criterion.pointsAwarded, 0);
  const rawScore = pointsAvailable === 0 ? 0 : clampScore(Math.round(pointsAwarded / pointsAvailable * 100));
  const hasCorroboratedPositive = definitions.some((definition) => {
    if (definition.dimension !== dimension || definition.basis !== "corroborated") {
      return false;
    }
    return criteria.some(
      (criterion) => criterion.criterionId === definition.id && criterion.observed === true
    );
  });
  const presenceOnlyCapApplied = rawScore > presenceOnlyScoreCap && !hasCorroboratedPositive;

  return {
    dimension,
    score: presenceOnlyCapApplied ? presenceOnlyScoreCap : rawScore,
    confidence: confidenceFromCoverage(coverage.ratio),
    coverage,
    applicability: "applicable",
    presenceOnlyCapApplied,
    criteria
  };
}

function assessCriterion(
  repository: RepositoryInput,
  repositoryKind: RepositoryKindAssessment,
  now: Date,
  outputRepositoryName: string,
  definition: CriterionDefinition,
  unavailable: ReadonlySet<RepositoryObservationKey>
): CriterionAssessment {
  if (!definition.applicableKinds.includes(repositoryKind.kind)) {
    return {
      criterionId: definition.id,
      dimension: definition.dimension,
      basis: definition.basis,
      applicability: "not-applicable",
      observed: null,
      pointsAwarded: 0,
      pointsAvailable: 0,
      evidenceIds: []
    };
  }

  const observed = definition.observations.some((key) => unavailable.has(key))
    ? null
    : evaluateCheck(definition.check, repository, now);
  const evidenceId = `${outputRepositoryName}:${definition.id}`;

  return {
    criterionId: definition.id,
    dimension: definition.dimension,
    basis: definition.basis,
    applicability: observed === null ? "unavailable" : "applicable",
    observed,
    pointsAwarded: observed === true ? definition.points : 0,
    pointsAvailable: observed === null ? 0 : definition.points,
    evidenceIds: observed === true ? [evidenceId] : []
  };
}

function makeCriterionEvidence(
  id: string,
  repositoryName: string,
  definitions: readonly CriterionDefinition[]
): Evidence {
  const criterionId = id.slice(repositoryName.length + 1);
  const definition = definitions.find((candidate) => candidate.id === criterionId);
  if (definition === undefined) {
    throw new Error(`Unknown scoring criterion: ${criterionId}`);
  }

  return createEvidence("positive", definition.label, definition.source, repositoryName, {
    id,
    criterionId: definition.id,
    dimension: definition.dimension,
    basis: definition.basis
  });
}

function evaluateCheck(check: CriterionCheck, repository: RepositoryInput, now: Date): boolean | null {
  switch (check) {
    case "readme":
      return observedBoolean(repository.hasReadme);
    case "license":
      return observedBoolean(repository.hasLicense);
    case "usage-guide":
      return observedBoolean(repository.hasUsageGuide);
    case "ci":
      return observedBoolean(repository.hasCi);
    case "tests":
      return observedBoolean(repository.hasTests);
    case "changelog":
      return observedBoolean(repository.hasChangelog);
    case "contributing":
      return observedBoolean(repository.hasContributing);
    case "code-of-conduct":
      return observedBoolean(repository.hasCodeOfConduct);
    case "security-policy":
      return observedBoolean(repository.hasSecurityPolicy);
    case "releases":
      return observedBoolean(repository.hasReleases);
    case "docs-or-demo":
      return observedBoolean(repository.hasDemoOrDocs);
    case "package-artifact":
      return observedBoolean(repository.hasPackageArtifact);
    case "test-surface":
      return testSurface(repository);
    case "compact-source-shape":
      return compactSourceShape(repository);
    case "examples":
      return exampleSurface(repository);
    case "recent-activity":
      return dateWithinDays(repository.pushedAt, now, RECENT_DAYS);
    case "established-history":
      return dateAtLeastDaysOld(repository.createdAt, now, RECENT_DAYS);
    case "tests-backed-by-ci":
      return allOf(observedBoolean(repository.hasTests), observedBoolean(repository.hasCi));
    case "tests-backed-by-files":
      return allOf(observedBoolean(repository.hasTests), testSurface(repository));
    case "release-notes-match-shipping":
      return allOf(observedBoolean(repository.hasReleases), observedBoolean(repository.hasChangelog));
    case "release-backed-by-package":
      return allOf(observedBoolean(repository.hasReleases), observedBoolean(repository.hasPackageArtifact));
    case "docs-backed-by-examples":
      return allOf(observedBoolean(repository.hasDemoOrDocs), exampleSurface(repository));
    case "readme-backed-by-usage":
      return allOf(observedBoolean(repository.hasReadme), observedBoolean(repository.hasUsageGuide));
    case "usage-backed-by-docs":
      return allOf(observedBoolean(repository.hasUsageGuide), observedBoolean(repository.hasDemoOrDocs));
    case "install-backed-by-examples":
      return allOf(observedBoolean(repository.hasPackageArtifact), exampleSurface(repository));
    case "sustained-history":
      return allOf(
        dateAtLeastDaysOld(repository.createdAt, now, RECENT_DAYS),
        dateWithinDays(repository.pushedAt, now, RECENT_DAYS)
      );
    case "community-guardrails":
      return allOf(observedBoolean(repository.hasContributing), observedBoolean(repository.hasCodeOfConduct));
    case "ownership-paths":
      return allOf(observedBoolean(repository.hasContributing), observedBoolean(repository.hasSecurityPolicy));
  }
}

function observedBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function allOf(...values: Array<boolean | null>): boolean | null {
  if (values.includes(false)) {
    return false;
  }
  return values.includes(null) ? null : true;
}

function testSurface(repository: RepositoryInput): boolean | null {
  const shape = repository.codebaseShape;
  if (shape === undefined) {
    return null;
  }
  const sourceFileCount = codebaseShapeMetric(shape.sourceFileCount);
  if (sourceFileCount === 0) {
    return false;
  }
  return codebaseShapeMetric(shape.testFileCount) >= 2 || codebaseShapeMetric(shape.testToSourceRatio) >= 0.08;
}

function compactSourceShape(repository: RepositoryInput): boolean | null {
  const shape = repository.codebaseShape;
  if (shape === undefined) {
    return null;
  }
  const sourceFileCount = codebaseShapeMetric(shape.sourceFileCount);
  const medianSourceFileBytes = codebaseShapeMetric(shape.medianSourceFileBytes);
  const p90SourceFileBytes = codebaseShapeMetric(shape.p90SourceFileBytes);
  const oversizedSourceFileCount = codebaseShapeMetric(shape.oversizedSourceFileCount);
  if (sourceFileCount < 4 || medianSourceFileBytes <= 0) {
    return false;
  }
  return medianSourceFileBytes <= 8_000 && p90SourceFileBytes <= 32_000 && oversizedSourceFileCount / sourceFileCount <= 0.1;
}

function exampleSurface(repository: RepositoryInput): boolean | null {
  if (repository.codebaseShape === undefined) {
    return null;
  }
  return codebaseShapeMetric(repository.codebaseShape.exampleFileCount) > 0;
}

function dateWithinDays(value: unknown, now: Date, days: number): boolean | null {
  const date = parseDate(value);
  if (date === null) {
    return null;
  }
  const age = now.getTime() - date.getTime();
  return age >= 0 && age <= days * 24 * 60 * 60 * 1000;
}

function dateAtLeastDaysOld(value: unknown, now: Date, days: number): boolean | null {
  const date = parseDate(value);
  if (date === null) {
    return null;
  }
  return now.getTime() - date.getTime() >= days * 24 * 60 * 60 * 1000;
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function makeCoverage(observed: number, expected: number) {
  return {
    observed,
    expected,
    ratio: expected === 0 ? 0 : Number((observed / expected).toFixed(3))
  };
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}
