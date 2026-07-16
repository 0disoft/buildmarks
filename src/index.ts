export type {
  AssessmentApplicability,
  AssessmentBasis,
  AssessmentConfidence,
  AssessmentCoverage,
  CollectedGitHubProfile,
  CollectedGitHubRepository,
  CollectedRepositoryActivitySignals,
  CollectedRepositoryFileSignals,
  CodebaseShapeSignals,
  CriterionAssessment,
  DimensionAssessment,
  DimensionScore,
  DimensionScoreV2,
  Evidence,
  ProfileInput,
  ProfileSignalScope,
  RepositoryInput,
  RepositoryKind,
  RepositoryKindAssessment,
  RepositoryKindSource,
  RepositoryObservationKey,
  RepositorySelectionSummary,
  RepositoryCollectionFailureSummary,
  RepositoryCollectionOperation,
  RepositoryVisibility,
  RepoSignal,
  RepoSignalV2,
  ResultStatus,
  ScoreAssessment,
  ScoringMethodologyVersion,
  SignalReportVisibility,
  SignalType,
  SignalVisibilityDisclosure,
  SignalDimension,
  SignalGap,
  UserSignalGapsReport,
  UserSignalReport,
  UserSignalReportV2
} from "./shared/types.js";
export {
  dimensionLabels,
  privateLocalSignalVisibility,
  publicOnlySignalVisibility,
  repositoryKinds,
  repositoryObservationKeys,
  scoringMethodologyVersion,
  signalTypeDisplayLabels,
  signalDimensions,
  signalTypes
} from "./shared/types.js";
export { buildmarksVersion } from "./shared/version.js";
export { normalizePublicGitHubProfile } from "./collector/normalize-public-profile.js";
export {
  collectOwnerSuppliedGitHubProfile,
  collectPublicGitHubProfile,
  GitHubCollectorError,
  type CollectPublicGitHubProfileOptions,
  type GitHubCollectorErrorCode,
  type GitHubCollectorFetch
} from "./collector/github-client.js";
export {
  defaultGitHubCollectorPolicy,
  privateLocalGitHubCollectorPolicy,
  validateGitHubCollectorPolicy,
  type GitHubCollectorPolicy,
  type GitHubCollectorPolicyMode,
  type GitHubCollectorPolicyValidation
} from "./collector/policy.js";
export {
  privateLocalRepositorySignalContract,
  publicOnlyPrivateRepositorySignalContract,
  validatePrivateRepositorySignalContract,
  type PrivateRepositoryEvidenceKind,
  type PrivateRepositorySignalContract,
  type PrivateRepositorySignalContractValidation
} from "./collector/private-signal-contract.js";
export { repositoryOverallWeights, scoreRepository } from "./scoring/score-repo.js";
export {
  methodologyCriteria,
  minimumScoringCoverage,
  presenceOnlyScoreCap,
  type CriterionCheck,
  type CriterionDefinition
} from "./scoring/methodology-v2.js";
export { detectRepositoryKindFromPaths, resolveRepositoryKind } from "./scoring/repository-kind.js";
export { scoreUserProfile, type ScoreUserProfileOptions } from "./scoring/score-user.js";
export { analyzeSignalGaps } from "./scoring/gaps.js";
export { classifySignalType } from "./scoring/signal-type.js";
export {
  renderFallbackCard,
  renderRepositorySignalCard,
  renderSignalGapsCard,
  renderUserSignalCard,
  type RenderCardOptions
} from "./renderer/svg.js";
export {
  createStaticReport,
  renderStaticReportHtml,
  type BuildmarksStaticReport,
  type BuildmarksStaticReportV2,
  type CreateStaticReportOptions
} from "./reporter/static-report.js";
