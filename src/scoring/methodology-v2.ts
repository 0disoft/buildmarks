import {
  repositoryKinds,
  scoringMethodologyVersion,
  type AssessmentBasis,
  type RepositoryKind,
  type RepositoryObservationKey,
  type SignalDimension
} from "../shared/types.js";

export { scoringMethodologyVersion };

export const presenceOnlyScoreCap = 40;
export const minimumScoringCoverage = 0.5;

export type CriterionCheck =
  | "readme"
  | "license"
  | "usage-guide"
  | "ci"
  | "tests"
  | "changelog"
  | "contributing"
  | "code-of-conduct"
  | "security-policy"
  | "releases"
  | "docs-or-demo"
  | "package-artifact"
  | "test-surface"
  | "compact-source-shape"
  | "examples"
  | "recent-activity"
  | "established-history"
  | "tests-backed-by-ci"
  | "tests-backed-by-files"
  | "release-notes-match-shipping"
  | "release-backed-by-package"
  | "docs-backed-by-examples"
  | "readme-backed-by-usage"
  | "usage-backed-by-docs"
  | "install-backed-by-examples"
  | "sustained-history"
  | "community-guardrails"
  | "ownership-paths";

export interface CriterionDefinition {
  id: string;
  dimension: SignalDimension;
  basis: AssessmentBasis;
  points: number;
  check: CriterionCheck;
  label: string;
  source: "repository" | "file" | "workflow" | "release" | "config";
  applicableKinds: readonly RepositoryKind[];
  observations: readonly RepositoryObservationKey[];
}

const allKinds = [...repositoryKinds] as const;
const maintainedKinds = without("experiment");
const codeKinds = only("library", "application", "cli", "monorepo", "general");
const packagedKinds = only("library", "cli", "monorepo", "general");
const shippedKinds = only("library", "application", "cli", "monorepo", "general");

export const methodologyCriteria = [
  criterion("maintainability.tests", "maintainability", "presence", 8, "tests", "Tests found", "file", codeKinds, ["tests"]),
  criterion("maintainability.ci", "maintainability", "presence", 8, "ci", "Automation workflow found", "workflow", maintainedKinds, ["ci"]),
  criterion("maintainability.changelog", "maintainability", "presence", 6, "changelog", "Change history found", "file", maintainedKinds, ["changelog"]),
  criterion("maintainability.test-surface", "maintainability", "shape", 6, "test-surface", "At least two test files or an 8% test-to-source file ratio found", "file", codeKinds, ["codebaseShape"]),
  criterion("maintainability.compact-shape", "maintainability", "shape", 5, "compact-source-shape", "Source file sizes fit the configured size thresholds", "file", codeKinds, ["codebaseShape"]),
  criterion("maintainability.examples", "maintainability", "presence", 4, "examples", "Examples or fixtures found", "file", maintainedKinds, ["codebaseShape"]),
  criterion("maintainability.contributing", "maintainability", "presence", 4, "contributing", "Contribution guide found", "file", maintainedKinds, ["contributing"]),
  criterion("maintainability.conduct", "maintainability", "presence", 3, "code-of-conduct", "Code of conduct found", "file", maintainedKinds, ["codeOfConduct"]),
  criterion("maintainability.security", "maintainability", "presence", 4, "security-policy", "Security contact path found", "file", maintainedKinds, ["securityPolicy"]),
  criterion("maintainability.recent", "maintainability", "history", 6, "recent-activity", "Maintained within the last 180 days", "repository", maintainedKinds, ["pushedAt"]),
  criterion("maintainability.tests-ci", "maintainability", "corroborated", 20, "tests-backed-by-ci", "Tests and an automation workflow both found", "workflow", codeKinds, ["tests", "ci"]),
  criterion("maintainability.tests-files", "maintainability", "corroborated", 12, "tests-backed-by-files", "Tests found alongside the configured test-file share", "file", codeKinds, ["tests", "codebaseShape"]),
  criterion("maintainability.release-notes", "maintainability", "corroborated", 14, "release-notes-match-shipping", "Release or tag and change history both found", "release", shippedKinds, ["releases", "changelog"]),

  criterion("completeness.readme", "completeness", "presence", 10, "readme", "README found", "file", allKinds, ["readme"]),
  criterion("completeness.usage", "completeness", "presence", 12, "usage-guide", "Setup or usage guidance found", "file", allKinds, ["usageGuide"]),
  criterion("completeness.license", "completeness", "presence", 8, "license", "License found", "file", allKinds, ["license"]),
  criterion("completeness.release", "completeness", "presence", 8, "releases", "Release or tag found", "release", shippedKinds, ["releases"]),
  criterion("completeness.docs", "completeness", "presence", 8, "docs-or-demo", "Documentation or demo reference found", "repository", allKinds, ["demoOrDocs"]),
  criterion("completeness.package", "completeness", "presence", 8, "package-artifact", "Project manifest found", "config", packagedKinds, ["packageArtifact"]),
  criterion("completeness.readme-usage", "completeness", "corroborated", 20, "readme-backed-by-usage", "README and setup or usage guidance both found", "file", allKinds, ["readme", "usageGuide"]),
  criterion("completeness.release-package", "completeness", "corroborated", 16, "release-backed-by-package", "Release or tag and project manifest both found", "release", packagedKinds, ["releases", "packageArtifact"]),
  criterion("completeness.docs-examples", "completeness", "corroborated", 10, "docs-backed-by-examples", "Documentation or demo and examples or fixtures both found", "file", maintainedKinds, ["demoOrDocs", "codebaseShape"]),

  criterion("usability.readme", "usability", "presence", 10, "readme", "README found", "file", allKinds, ["readme"]),
  criterion("usability.usage", "usability", "presence", 14, "usage-guide", "Practical usage guidance found", "file", allKinds, ["usageGuide"]),
  criterion("usability.docs", "usability", "presence", 10, "docs-or-demo", "Documentation or demo reference found", "repository", allKinds, ["demoOrDocs"]),
  criterion("usability.package", "usability", "presence", 8, "package-artifact", "Project manifest found", "config", packagedKinds, ["packageArtifact"]),
  criterion("usability.examples", "usability", "presence", 8, "examples", "Examples or fixtures found", "file", maintainedKinds, ["codebaseShape"]),
  criterion("usability.docs-usage", "usability", "corroborated", 24, "usage-backed-by-docs", "Usage guidance and documentation or demo both found", "file", allKinds, ["usageGuide", "demoOrDocs"]),
  criterion("usability.install-examples", "usability", "corroborated", 18, "install-backed-by-examples", "Project manifest and examples or fixtures both found", "file", packagedKinds, ["packageArtifact", "codebaseShape"]),
  criterion("usability.docs-examples", "usability", "corroborated", 8, "docs-backed-by-examples", "Documentation or demo and examples or fixtures both found", "file", maintainedKinds, ["demoOrDocs", "codebaseShape"]),

  criterion("shipping.release", "shipping", "presence", 14, "releases", "Release or tag found", "release", shippedKinds, ["releases"]),
  criterion("shipping.package", "shipping", "presence", 10, "package-artifact", "Project manifest found", "config", packagedKinds, ["packageArtifact"]),
  criterion("shipping.docs", "shipping", "presence", 8, "docs-or-demo", "Documentation or demo reference found", "repository", shippedKinds, ["demoOrDocs"]),
  criterion("shipping.recent", "shipping", "history", 8, "recent-activity", "Shipping or maintenance activity found within 180 days", "repository", shippedKinds, ["pushedAt"]),
  criterion("shipping.release-package", "shipping", "corroborated", 34, "release-backed-by-package", "Release or tag and project manifest both found", "release", packagedKinds, ["releases", "packageArtifact"]),
  criterion("shipping.release-notes", "shipping", "corroborated", 26, "release-notes-match-shipping", "Release or tag and change history both found", "release", shippedKinds, ["releases", "changelog"]),

  criterion("consistency.history", "consistency", "history", 16, "established-history", "Public project history spans at least 180 days", "repository", maintainedKinds, ["createdAt"]),
  criterion("consistency.recent", "consistency", "history", 14, "recent-activity", "Project activity found within the last 180 days", "repository", maintainedKinds, ["pushedAt"]),
  criterion("consistency.changelog", "consistency", "presence", 10, "changelog", "Change history found", "file", maintainedKinds, ["changelog"]),
  criterion("consistency.release", "consistency", "presence", 10, "releases", "Release or tag found", "release", shippedKinds, ["releases"]),
  criterion("consistency.sustained", "consistency", "corroborated", 30, "sustained-history", "The project is both established and recently maintained", "repository", maintainedKinds, ["createdAt", "pushedAt"]),
  criterion("consistency.release-notes", "consistency", "corroborated", 20, "release-notes-match-shipping", "Release or tag and change history both found", "release", shippedKinds, ["releases", "changelog"]),

  criterion("stewardship.license", "stewardship", "presence", 10, "license", "License found", "file", maintainedKinds, ["license"]),
  criterion("stewardship.security", "stewardship", "presence", 10, "security-policy", "Security contact path found", "file", maintainedKinds, ["securityPolicy"]),
  criterion("stewardship.contributing", "stewardship", "presence", 10, "contributing", "Contribution guide found", "file", maintainedKinds, ["contributing"]),
  criterion("stewardship.conduct", "stewardship", "presence", 8, "code-of-conduct", "Code of conduct found", "file", maintainedKinds, ["codeOfConduct"]),
  criterion("stewardship.changelog", "stewardship", "presence", 8, "changelog", "Change history found", "file", maintainedKinds, ["changelog"]),
  criterion("stewardship.recent", "stewardship", "history", 8, "recent-activity", "Project care is visible within the last 180 days", "repository", maintainedKinds, ["pushedAt"]),
  criterion("stewardship.community", "stewardship", "corroborated", 20, "community-guardrails", "Contribution and conduct guidance both found", "file", maintainedKinds, ["contributing", "codeOfConduct"]),
  criterion("stewardship.ownership", "stewardship", "corroborated", 14, "ownership-paths", "Contribution and security guidance both found", "file", maintainedKinds, ["contributing", "securityPolicy"]),
  criterion("stewardship.release-notes", "stewardship", "corroborated", 12, "release-notes-match-shipping", "Release or tag and change history both found", "release", shippedKinds, ["releases", "changelog"])
] as const satisfies readonly CriterionDefinition[];

function criterion(
  id: string,
  dimension: SignalDimension,
  basis: AssessmentBasis,
  points: number,
  check: CriterionCheck,
  label: string,
  source: CriterionDefinition["source"],
  applicableKinds: readonly RepositoryKind[],
  observations: readonly RepositoryObservationKey[]
): CriterionDefinition {
  return { id, dimension, basis, points, check, label, source, applicableKinds, observations };
}

function only(...kinds: RepositoryKind[]): readonly RepositoryKind[] {
  return kinds;
}

function without(...excluded: RepositoryKind[]): readonly RepositoryKind[] {
  const excludedKinds = new Set(excluded);
  return repositoryKinds.filter((kind) => !excludedKinds.has(kind));
}
