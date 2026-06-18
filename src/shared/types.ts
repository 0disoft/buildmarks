export const signalDimensions = [
  "maintainability",
  "completeness",
  "usability",
  "shipping",
  "consistency",
  "stewardship"
] as const;

export type SignalDimension = (typeof signalDimensions)[number];

export const signalTypes = [
  "Maintainer-Builder",
  "Productized Builder",
  "Builder",
  "Steady Shipper",
  "Well-Documented Project",
  "General Signal Profile"
] as const;

export type SignalType = (typeof signalTypes)[number];

export const dimensionLabels: Record<SignalDimension, string> = {
  maintainability: "Maintainability",
  completeness: "Project Completeness",
  usability: "Usability Surface",
  shipping: "Shipping Evidence",
  consistency: "Consistency",
  stewardship: "Project Stewardship"
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
  visibility?: RepositoryVisibility;
  redactedName?: boolean;
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
  codebaseShape?: CodebaseShapeSignals;
  issueResponseCount: number;
  pullRequestReviewCount: number;
  externalContributorCount: number;
}

export interface CodebaseShapeSignals {
  sourceFileCount: number;
  testFileCount: number;
  exampleFileCount: number;
  medianSourceFileBytes: number;
  p90SourceFileBytes: number;
  oversizedSourceFileCount: number;
  testToSourceRatio: number;
  treeTruncated?: boolean;
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
  codebaseShape: CodebaseShapeSignals;
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
  visibility?: RepositoryVisibility;
  redactedName?: boolean;
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
  activityWindowDays?: number;
  activityAggregatesDeferred?: boolean;
  repositoryCollectionFailureCount?: number;
  signalVisibility?: SignalVisibilityDisclosure;
  repositories: CollectedGitHubRepository[];
}

export interface ProfileInput {
  username: string;
  generatedAt?: string;
  activityWindowDays?: number;
  activityAggregatesDeferred?: boolean;
  repositoryCollectionFailureCount?: number;
  signalVisibility?: SignalVisibilityDisclosure;
  repositories: RepositoryInput[];
}

export type RepositoryVisibility = "public" | "private";

export type ProfileSignalScope =
  | "public-only"
  | "public-and-owner-supplied-private";

export type SignalReportVisibility = "public-safe" | "private-local";

export interface SignalVisibilityDisclosure {
  scope: ProfileSignalScope;
  privateRepositoriesIncluded: boolean;
  privateRepositoryNamesRedacted: boolean;
  independentlyVerifiable: boolean;
  cardLabel: string;
  reportVisibility: SignalReportVisibility;
}

export const publicOnlySignalVisibility = {
  scope: "public-only",
  privateRepositoriesIncluded: false,
  privateRepositoryNamesRedacted: false,
  independentlyVerifiable: true,
  cardLabel: "Public GitHub signals",
  reportVisibility: "public-safe"
} satisfies SignalVisibilityDisclosure;

export const privateLocalSignalVisibility = {
  scope: "public-and-owner-supplied-private",
  privateRepositoriesIncluded: true,
  privateRepositoryNamesRedacted: true,
  independentlyVerifiable: false,
  cardLabel: "Public + Private Signals",
  reportVisibility: "private-local"
} satisfies SignalVisibilityDisclosure;

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
  signalVisibility?: SignalVisibilityDisclosure;
  dimensions: Record<SignalDimension, DimensionScore>;
  overall: number;
  weight: number;
  evidence: Evidence[];
}

export interface UserSignalReport {
  username: string;
  generatedAt: string;
  activityWindowDays?: number;
  signalVisibility?: SignalVisibilityDisclosure;
  unavailableDimensions?: SignalDimension[];
  overall: number;
  signalType: SignalType;
  dimensions: Record<SignalDimension, number>;
  topRepos: RepoSignal[];
  evidence: Evidence[];
  limitations: string[];
}

export interface SignalGap {
  repository: string;
  dimension: SignalDimension;
  missing: string[];
  whyItMatters: string;
}

export interface UserSignalGapsReport {
  username: string;
  generatedAt: string;
  signalVisibility?: SignalVisibilityDisclosure;
  gaps: SignalGap[];
  limitations: string[];
}
