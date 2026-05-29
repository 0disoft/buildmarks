export type {
  CollectedGitHubProfile,
  CollectedGitHubRepository,
  CollectedRepositoryActivitySignals,
  CollectedRepositoryFileSignals,
  DimensionScore,
  Evidence,
  ProfileInput,
  RepositoryInput,
  RepoSignal,
  SignalDimension,
  UserSignalReport
} from "./shared/types";
export { dimensionLabels, signalDimensions } from "./shared/types";
export { normalizePublicGitHubProfile } from "./collector/normalize-public-profile";
export {
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
export { scoreRepository } from "./scoring/score-repo";
export { scoreUserProfile } from "./scoring/score-user";
export { classifySignalType } from "./scoring/signal-type";
export { renderFallbackCard, renderUserSignalCard } from "./renderer/svg";
