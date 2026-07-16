import type { ProfileInput, RepositoryInput, SignalGap, SignalDimension, UserSignalGapsReport } from "../shared/types.js";
import { codebaseShapeMetric } from "./codebase-shape.js";
import { validatePrivateRepositoryDisclosure } from "./private-disclosure.js";
import { resolveRepositoryKind } from "./repository-kind.js";
import { scoreUserProfile } from "./score-user.js";

const maxGaps = 8;

export interface AnalyzeSignalGapsOptions {
  maxRepositories?: number;
  now?: Date;
}

export function analyzeSignalGaps(
  input: ProfileInput,
  options: AnalyzeSignalGapsOptions = {}
): UserSignalGapsReport {
  validatePrivateRepositoryDisclosure(input);

  const generatedAt = input.generatedAt ?? (options.now ?? new Date()).toISOString();
  const eligibleRepositories = selectEligibleRepositories(input, options);
  const gaps = eligibleRepositories.flatMap(repositorySignalGaps).slice(0, maxGaps);

  return {
    username: input.username,
    generatedAt,
    ...(input.signalVisibility ? { signalVisibility: input.signalVisibility } : {}),
    gaps,
    limitations: buildGapLimitations(input.signalVisibility?.privateRepositoriesIncluded === true)
  };
}

function selectEligibleRepositories(
  input: ProfileInput,
  options: AnalyzeSignalGapsOptions
): RepositoryInput[] {
  const repositories = input.repositories;
  const eligibleRepositories = repositories.filter(isEligibleRepository);
  if (options.maxRepositories === undefined) {
    return eligibleRepositories;
  }

  const maxRepositories = resolveMaxRepositories(options.maxRepositories);
  const displayedNames = new Set(
    scoreUserProfile(
      {
        username: "gap-selection",
        ...(input.signalVisibility ? { signalVisibility: input.signalVisibility } : {}),
        repositories: eligibleRepositories
      },
      { ...options, maxRepositories }
    ).topRepos.map((repository) => repository.name)
  );
  return eligibleRepositories.filter((repository) => displayedNames.has(repository.name));
}

function buildGapLimitations(includesPrivateSignals: boolean): string[] {
  return [
    includesPrivateSignals
      ? "These suggestions include owner-supplied private repositories that cannot be checked independently on public GitHub."
      : "These suggestions only reflect repositories visible on public GitHub.",
    "These are practical project suggestions, not a developer ranking.",
    includesPrivateSignals
      ? "Employer work and non-GitHub maintenance are not inferred."
      : "Private work and non-GitHub maintenance are not inferred."
  ];
}

function repositorySignalGaps(repository: RepositoryInput): SignalGap[] {
  const gaps: SignalGap[] = [];
  const kind = resolveRepositoryKind(repository).kind;

  pushGap(gaps, repository, "maintainability", [
    [kind !== "documentation" && isMissingBooleanObservation(repository, "tests", repository.hasTests), "tests"],
    [isMissingBooleanObservation(repository, "ci", repository.hasCi), "CI workflow"],
    [isMissingBooleanObservation(repository, "changelog", repository.hasChangelog), "changelog"],
    [isMissingBooleanObservation(repository, "securityPolicy", repository.hasSecurityPolicy), "security policy"]
  ], "Tests, automation, and a visible change history make the project easier to maintain.", kind !== "experiment");

  pushGap(gaps, repository, "completeness", [
    [isMissingBooleanObservation(repository, "readme", repository.hasReadme), "README"],
    [isMissingBooleanObservation(repository, "usageGuide", repository.hasUsageGuide), "usage guide"],
    [isMissingBooleanObservation(repository, "license", repository.hasLicense), "license"],
    [isMissingBooleanObservation(repository, "demoOrDocs", repository.hasDemoOrDocs), "docs or demo"]
  ], "A clear starting point helps other people understand, run, and reuse the project.");

  pushGap(gaps, repository, "shipping", [
    [isMissingBooleanObservation(repository, "releases", repository.hasReleases), "release or tag"],
    [kind !== "application" && isMissingBooleanObservation(repository, "packageArtifact", repository.hasPackageArtifact), "package manifest"],
    [isMissingBooleanObservation(repository, "demoOrDocs", repository.hasDemoOrDocs), "docs or demo"]
  ], "A release trail shows that the project can be used, not merely browsed.", kind !== "documentation" && kind !== "experiment");

  pushGap(gaps, repository, "usability", [
    [isMissingBooleanObservation(repository, "usageGuide", repository.hasUsageGuide), "usage guide"],
    [isMissingBooleanObservation(repository, "demoOrDocs", repository.hasDemoOrDocs), "docs or demo"],
    [kind !== "application" && kind !== "documentation" && isMissingBooleanObservation(repository, "packageArtifact", repository.hasPackageArtifact), "package manifest"],
    [!isObservationUnavailable(repository, "codebaseShape") && codebaseShapeMetric(repository.codebaseShape?.exampleFileCount) === 0, "example or fixture files"]
  ], "Clear instructions and examples help someone try the project without guesswork.");

  pushGap(gaps, repository, "stewardship", [
    [isMissingBooleanObservation(repository, "contributing", repository.hasContributing), "contribution guide"],
    [isMissingBooleanObservation(repository, "codeOfConduct", repository.hasCodeOfConduct), "code of conduct"],
    [isMissingBooleanObservation(repository, "securityPolicy", repository.hasSecurityPolicy), "security policy"],
    [isMissingBooleanObservation(repository, "changelog", repository.hasChangelog), "changelog"]
  ], "Contribution and security guidance make ownership and support paths easier to find.", kind !== "experiment");

  return gaps;
}

function isMissingBooleanObservation(
  repository: RepositoryInput,
  key: NonNullable<RepositoryInput["unavailableObservations"]>[number],
  value: unknown
): boolean {
  return !isObservationUnavailable(repository, key) && !isPresentSignal(value);
}

function isObservationUnavailable(
  repository: RepositoryInput,
  key: NonNullable<RepositoryInput["unavailableObservations"]>[number]
): boolean {
  return repository.unavailableObservations?.includes(key) === true;
}

function pushGap(
  gaps: SignalGap[],
  repository: RepositoryInput,
  dimension: SignalDimension,
  checks: Array<[boolean, string]>,
  whyItMatters: string,
  applicable = true
): void {
  if (!applicable) {
    return;
  }
  const missing = checks.flatMap(([condition, label]) => (condition ? [label] : []));
  if (missing.length === 0) {
    return;
  }

  gaps.push({
    repository: repository.name,
    dimension,
    missing,
    whyItMatters
  });
}

function resolveMaxRepositories(value: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("maxRepositories must be a positive integer.");
  }

  return value;
}

function isEligibleRepository(repository: RepositoryInput): boolean {
  return repository.isFork === false && repository.isArchived === false && repository.codebaseShape?.treeTruncated !== true;
}

function isPresentSignal(value: unknown): boolean {
  return value === true;
}
