export type {
  CollectedGitHubProfile,
  CollectedGitHubRepository,
  CollectedRepositoryActivitySignals,
  CollectedRepositoryFileSignals,
  CodebaseShapeSignals,
  DimensionScore,
  Evidence,
  ProfileInput,
  ProfileSignalScope,
  RepositoryInput,
  RepositoryCollectionFailureSummary,
  RepositoryCollectionOperation,
  RepositoryVisibility,
  RepoSignal,
  SignalReportVisibility,
  SignalType,
  SignalVisibilityDisclosure,
  SignalDimension,
  SignalGap,
  UserSignalGapsReport,
  UserSignalReport
} from "./shared/types.js";
export {
  dimensionLabels,
  privateLocalSignalVisibility,
  publicOnlySignalVisibility,
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
  type CreateStaticReportOptions
} from "./reporter/static-report.js";
