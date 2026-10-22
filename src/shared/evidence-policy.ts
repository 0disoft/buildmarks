export const scoringCoveragePolicy = Object.freeze({
  minimumScoringCoverage: 0.5,
  mediumConfidenceCoverage: 0.6,
  highConfidenceCoverage: 0.85,
  confirmedAssessmentCoverage: 0.85,
  confirmedCollectionCoverage: 0.85,
  minimumConfirmedDimensions: 4,
  maximumUnavailableCollectionRatio: 0.5,
  presenceOnlyScoreCap: 40
} as const);

/** Collection and assessment must agree on file sizes and stored ratio precision. */
export const codebaseShapePolicy = Object.freeze({
  minimumTestFiles: 2,
  minimumTestToSourceRatio: 0.08,
  minimumSourceFiles: 4,
  maximumMedianSourceFileBytes: 8_000,
  maximumP90SourceFileBytes: 32_000,
  maximumOversizedSourceFileRatio: 0.1,
  storedRatioDecimalPlaces: 3,
  // Half of the last stored decimal place, plus a small floating-point allowance.
  storedRatioTolerance: 0.000500001
} as const);

export const repositoryHistoryPolicy = Object.freeze({
  recentActivityDays: 180,
  establishedHistoryDays: 180
} as const);
