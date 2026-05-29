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
  SignalGap,
  UserSignalGapsReport,
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
export { analyzeSignalGaps } from "./scoring/gaps";
export { classifySignalType } from "./scoring/signal-type";
export {
  renderFallbackCard,
  renderRepositorySignalCard,
  renderSignalGapsCard,
  renderUserSignalCard
} from "./renderer/svg";
export {
  createStaticReport,
  renderStaticReportHtml,
  type BuildmarksStaticReport
} from "./reporter/static-report";
