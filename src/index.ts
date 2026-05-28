export type {
  DimensionScore,
  Evidence,
  ProfileInput,
  RepositoryInput,
  RepoSignal,
  SignalDimension,
  UserSignalReport
} from "./shared/types";
export { dimensionLabels, signalDimensions } from "./shared/types";
export { scoreRepository } from "./scoring/score-repo";
export { scoreUserProfile } from "./scoring/score-user";
export { classifySignalType } from "./scoring/signal-type";
export { renderFallbackCard, renderUserSignalCard } from "./renderer/svg";
