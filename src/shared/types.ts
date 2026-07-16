export const signalDimensions = [
  "maintainability",
  "completeness",
  "usability",
  "shipping",
  "consistency",
  "stewardship"
] as const;

export type SignalDimension = (typeof signalDimensions)[number];

export const scoringMethodologyVersion = "2.0.1" as const;

export type ScoringMethodologyVersion = typeof scoringMethodologyVersion;

export const repositoryKinds = [
  "library",
  "application",
  "cli",
  "documentation",
  "monorepo",
  "experiment",
  "general"
] as const;

export type RepositoryKind = (typeof repositoryKinds)[number];

export type RepositoryKindSource = "declared" | "detected" | "inferred" | "fallback";

export const repositoryObservationKeys = [
  "readme",
  "license",
  "usageGuide",
  "ci",
  "tests",
  "changelog",
  "contributing",
  "codeOfConduct",
  "securityPolicy",
  "releases",
  "demoOrDocs",
  "packageArtifact",
  "codebaseShape",
  "createdAt",
  "pushedAt"
] as const;

export type RepositoryObservationKey = (typeof repositoryObservationKeys)[number];

export type AssessmentApplicability = "applicable" | "not-applicable" | "unavailable";

export type AssessmentConfidence = "low" | "medium" | "high";

export type AssessmentBasis = "presence" | "corroborated" | "shape" | "history";

export interface AssessmentCoverage {
  observed: number;
  expected: number;
  ratio: number;
}

export interface ScoreAssessment {
  score: number | null;
  confidence: AssessmentConfidence | null;
  coverage: AssessmentCoverage;
  applicability: AssessmentApplicability;
}

export interface CriterionAssessment {
  criterionId: string;
  dimension: SignalDimension;
  basis: AssessmentBasis;
  applicability: AssessmentApplicability;
  observed: boolean | null;
  pointsAwarded: number;
  pointsAvailable: number;
  evidenceIds: string[];
}

export interface DimensionAssessment extends ScoreAssessment {
  dimension: SignalDimension;
  presenceOnlyCapApplied: boolean;
  criteria: CriterionAssessment[];
}

export interface RepositoryKindAssessment {
  kind: RepositoryKind;
  source: RepositoryKindSource;
  confidence: AssessmentConfidence;
}

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
  completeness: "Project Readiness",
  usability: "Ease of Use",
  shipping: "Shipping",
  consistency: "Consistency",
  stewardship: "Project Care"
};

export const signalTypeDisplayLabels: Record<SignalType, string> = {
  "Maintainer-Builder": "Built to Last",
  "Productized Builder": "Ready to Use",
  Builder: "Well Rounded",
  "Steady Shipper": "Ships Steadily",
  "Well-Documented Project": "Easy to Pick Up",
  "General Signal Profile": "Project Snapshot"
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
  id?: string;
  criterionId?: string;
  dimension?: SignalDimension;
  basis?: AssessmentBasis;
}

export interface RepositoryInput {
  owner: string;
  name: string;
  url?: string;
  visibility?: RepositoryVisibility;
  redactedName?: boolean;
  repositoryKind?: RepositoryKind;
  repositoryKindSource?: RepositoryKindSource;
  repositoryKindConfidence?: AssessmentConfidence;
  unavailableObservations?: RepositoryObservationKey[];
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

export type RepositoryCollectionOperation =
  | "community_profile"
  | "readme"
  | "releases"
  | "tags"
  | "tree"
  | "unknown";

export interface RepositoryCollectionFailureSummary {
  code: string;
  operation: RepositoryCollectionOperation;
  status?: number;
  count: number;
}

export interface CollectedGitHubRepository {
  owner: string;
  name: string;
  url?: string;
  visibility?: RepositoryVisibility;
  redactedName?: boolean;
  repositoryKind?: RepositoryKind;
  repositoryKindSource?: RepositoryKindSource;
  repositoryKindConfidence?: AssessmentConfidence;
  unavailableObservations?: RepositoryObservationKey[];
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
  repositoryCollectionAttemptCount?: number;
  repositoryCollectionFailures?: RepositoryCollectionFailureSummary[];
  signalVisibility?: SignalVisibilityDisclosure;
  repositories: CollectedGitHubRepository[];
}

export interface ProfileInput {
  username: string;
  generatedAt?: string;
  activityWindowDays?: number;
  activityAggregatesDeferred?: boolean;
  repositoryCollectionFailureCount?: number;
  repositoryCollectionAttemptCount?: number;
  repositoryCollectionFailures?: RepositoryCollectionFailureSummary[];
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
  cardLabel: "Public GitHub projects",
  reportVisibility: "public-safe"
} satisfies SignalVisibilityDisclosure;

export const privateLocalSignalVisibility = {
  scope: "public-and-owner-supplied-private",
  privateRepositoriesIncluded: true,
  privateRepositoryNamesRedacted: true,
  independentlyVerifiable: false,
  cardLabel: "Public + Private Projects",
  reportVisibility: "private-local"
} satisfies SignalVisibilityDisclosure;

const legacyCardLabels = new Map([
  [publicOnlySignalVisibility.cardLabel, "Public GitHub signals"],
  [privateLocalSignalVisibility.cardLabel, "Public + Private Signals"]
]);

export function isSupportedCardLabel(actual: string, expected: string): boolean {
  return actual === expected || legacyCardLabels.get(expected) === actual;
}

export interface DimensionScore {
  key: SignalDimension;
  label: string;
  score: number;
  maxScore: 100;
  evidence: Evidence[];
  assessment?: DimensionAssessment;
}

export interface DimensionScoreV2 extends DimensionScore {
  assessment: DimensionAssessment;
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
  methodologyVersion?: ScoringMethodologyVersion;
  repositoryKind?: RepositoryKindAssessment;
  assessment?: ScoreAssessment;
  evidenceLedger?: Evidence[];
}

export interface RepoSignalV2 extends RepoSignal {
  methodologyVersion: ScoringMethodologyVersion;
  repositoryKind: RepositoryKindAssessment;
  dimensions: Record<SignalDimension, DimensionScoreV2>;
  assessment: ScoreAssessment;
  evidenceLedger: Evidence[];
}

export interface RepositorySelectionSummary {
  strategy: "kind-stratified";
  eligibleCount: number;
  evaluatedCount: number;
  displayedCount: number;
  displayLimit: number;
  attemptedCount: number;
  missedCount: number;
  checkedRatio: number;
}

export type ResultStatus = "confirmed" | "provisional" | "unavailable";

export interface UserSignalReport {
  username: string;
  generatedAt: string;
  activityWindowDays?: number;
  signalVisibility?: SignalVisibilityDisclosure;
  unavailableDimensions?: SignalDimension[];
  evidenceStatus?: "complete" | "partial" | "insufficient";
  overall: number;
  signalType: SignalType;
  dimensions: Record<SignalDimension, number>;
  topRepos: RepoSignal[];
  evidence: Evidence[];
  limitations: string[];
  methodologyVersion?: ScoringMethodologyVersion;
  confidence?: AssessmentConfidence | null;
  coverage?: AssessmentCoverage;
  assessment?: ScoreAssessment;
  dimensionAssessments?: Record<SignalDimension, ScoreAssessment>;
  notApplicableDimensions?: SignalDimension[];
  selection?: RepositorySelectionSummary;
  resultStatus?: ResultStatus;
  evidenceLedger?: Evidence[];
}

export interface UserSignalReportV2 extends UserSignalReport {
  methodologyVersion: ScoringMethodologyVersion;
  confidence: AssessmentConfidence | null;
  coverage: AssessmentCoverage;
  assessment: ScoreAssessment;
  dimensionAssessments: Record<SignalDimension, ScoreAssessment>;
  selection: RepositorySelectionSummary;
  resultStatus: ResultStatus;
  evidenceLedger: Evidence[];
  topRepos: RepoSignalV2[];
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
