export const signalDimensions = [
  "maintainability",
  "completeness",
  "collaboration",
  "shipping",
  "consistency",
  "externalValidation"
] as const;

export type SignalDimension = (typeof signalDimensions)[number];

export const dimensionLabels: Record<SignalDimension, string> = {
  maintainability: "Maintainability",
  completeness: "Project Completeness",
  collaboration: "Collaboration",
  shipping: "Shipping Evidence",
  consistency: "Consistency",
  externalValidation: "External Validation"
};

export type EvidenceLevel = "positive" | "neutral" | "negative";

export type EvidenceSource =
  | "repository"
  | "file"
  | "workflow"
  | "release"
  | "issue"
  | "pull_request"
  | "config";

export interface Evidence {
  level: EvidenceLevel;
  label: string;
  source: EvidenceSource;
  repo?: string;
}

export interface RepositoryInput {
  owner: string;
  name: string;
  url?: string;
  isFork: boolean;
  isArchived: boolean;
  stars: number;
  forks: number;
  createdAt: string | null;
  pushedAt: string | null;
  hasReadme: boolean;
  hasLicense: boolean;
  hasUsageGuide: boolean;
  hasCi: boolean;
  hasTests: boolean;
  hasChangelog: boolean;
  hasContributing: boolean;
  hasCodeOfConduct: boolean;
  hasSecurityPolicy: boolean;
  hasReleases: boolean;
  hasDemoOrDocs: boolean;
  hasPackageArtifact: boolean;
  issueResponseCount: number;
  pullRequestReviewCount: number;
  externalContributorCount: number;
}

export interface CollectedRepositoryFileSignals {
  hasReadme: boolean;
  hasLicense: boolean;
  hasUsageGuide: boolean;
  hasCi: boolean;
  hasTests: boolean;
  hasChangelog: boolean;
  hasContributing: boolean;
  hasCodeOfConduct: boolean;
  hasSecurityPolicy: boolean;
  hasDemoOrDocs: boolean;
  hasPackageArtifact: boolean;
}

export interface CollectedRepositoryActivitySignals {
  issueResponseCount: number;
  pullRequestReviewCount: number;
  externalContributorCount: number;
}

export interface CollectedGitHubRepository {
  owner: string;
  name: string;
  url?: string;
  isFork: boolean;
  isArchived: boolean;
  stars: number;
  forks: number;
  createdAt: string | null;
  pushedAt: string | null;
  hasReleasesOrTags: boolean;
  files: CollectedRepositoryFileSignals;
  activity: CollectedRepositoryActivitySignals;
}

export interface CollectedGitHubProfile {
  username: string;
  collectedAt?: string;
  repositories: CollectedGitHubRepository[];
}

export interface ProfileInput {
  username: string;
  generatedAt?: string;
  repositories: RepositoryInput[];
}

export interface DimensionScore {
  key: SignalDimension;
  label: string;
  score: number;
  maxScore: 100;
  evidence: Evidence[];
}

export interface RepoSignal {
  owner: string;
  name: string;
  url?: string;
  dimensions: Record<SignalDimension, DimensionScore>;
  overall: number;
  weight: number;
  evidence: Evidence[];
}

export interface UserSignalReport {
  username: string;
  generatedAt: string;
  overall: number;
  signalType: string;
  dimensions: Record<SignalDimension, number>;
  topRepos: RepoSignal[];
  evidence: Evidence[];
  limitations: string[];
}
