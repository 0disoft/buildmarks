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
  RepositoryVisibility,
  RepoSignal,
  SignalReportVisibility,
  SignalVisibilityDisclosure,
  SignalDimension,
  SignalGap,
  UserSignalGapsReport,
  UserSignalReport
} from "./shared/types";
export {
  dimensionLabels,
  privateLocalSignalVisibility,
  publicOnlySignalVisibility,
  signalDimensions
} from "./shared/types";
export { buildmarksVersion } from "./shared/version";
export { normalizePublicGitHubProfile } from "./collector/normalize-public-profile";
export {
  collectOwnerSuppliedGitHubProfile,
  collectPublicGitHubProfile,
  GitHubCollectorError,
  type CollectPublicGitHubProfileOptions,
  type GitHubCollectorErrorCode,
  type GitHubCollectorFetch
} from "./collector/github-client";
export {
  defaultGitHubCollectorPolicy,
  validateGitHubCollectorPolicy,
  type GitHubCollectorPolicy,
  type GitHubCollectorPolicyValidation
} from "./collector/policy";
export {
  privateLocalRepositorySignalContract,
  publicOnlyPrivateRepositorySignalContract,
  validatePrivateRepositorySignalContract,
  type PrivateRepositoryEvidenceKind,
  type PrivateRepositorySignalContract,
  type PrivateRepositorySignalContractValidation
} from "./collector/private-signal-contract";
export { scoreRepository } from "./scoring/score-repo";
export { scoreUserProfile, type ScoreUserProfileOptions } from "./scoring/score-user";
export { analyzeSignalGaps } from "./scoring/gaps";
export { classifySignalType } from "./scoring/signal-type";
export {
  renderFallbackCard,
  renderRepositorySignalCard,
  renderSignalGapsCard,
  renderUserSignalCard,
  type RenderCardOptions
} from "./renderer/svg";
export {
  createStaticReport,
  renderStaticReportHtml,
  type BuildmarksStaticReport,
  type CreateStaticReportOptions
} from "./reporter/static-report";
