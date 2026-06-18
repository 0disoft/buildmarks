import type { ProfileInput, RepositoryInput, SignalGap, SignalDimension, UserSignalGapsReport } from "../shared/types";
import { codebaseShapeMetric } from "./codebase-shape";
import { validatePrivateRepositoryDisclosure } from "./private-disclosure";
import { scoreRepository } from "./score-repo";

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
  const eligibleRepositories = selectEligibleRepositories(input.repositories, options);
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
  repositories: readonly RepositoryInput[],
  options: AnalyzeSignalGapsOptions
): RepositoryInput[] {
  const eligibleRepositories = repositories.filter(isEligibleRepository);
  if (options.maxRepositories === undefined) {
    return eligibleRepositories;
  }

  const maxRepositories = resolveMaxRepositories(options.maxRepositories);
  return eligibleRepositories
    .map((repository) => ({
      repository,
      score: scoreRepository(repository, options)
    }))
    .sort((left, right) => right.score.weight * right.score.overall - left.score.weight * left.score.overall)
    .slice(0, maxRepositories)
    .map((item) => item.repository);
}

function buildGapLimitations(includesPrivateSignals: boolean): string[] {
  return [
    includesPrivateSignals
      ? "Owner-supplied private repository signals are included and are not independently verifiable from public GitHub."
      : "Public GitHub data only.",
    "These are improvement hints, not a developer ranking.",
    includesPrivateSignals
      ? "Employer work and non-GitHub maintenance are not inferred."
      : "Private work and non-GitHub maintenance are not inferred."
  ];
}

function repositorySignalGaps(repository: RepositoryInput): SignalGap[] {
  const gaps: SignalGap[] = [];

  pushGap(gaps, repository, "maintainability", [
    [!isPresentSignal(repository.hasTests), "tests"],
    [!isPresentSignal(repository.hasCi), "CI workflow"],
    [!isPresentSignal(repository.hasChangelog), "changelog"],
    [!isPresentSignal(repository.hasSecurityPolicy), "security policy"]
  ], "Tests, automation, and change history improve maintenance confidence.");

  pushGap(gaps, repository, "completeness", [
    [!isPresentSignal(repository.hasReadme), "README"],
    [!isPresentSignal(repository.hasUsageGuide), "usage guide"],
    [!isPresentSignal(repository.hasLicense), "license"],
    [!isPresentSignal(repository.hasDemoOrDocs), "docs or demo"]
  ], "Completeness signals help other people understand, run, and reuse the project.");

  pushGap(gaps, repository, "shipping", [
    [!isPresentSignal(repository.hasReleases), "release or tag"],
    [!isPresentSignal(repository.hasPackageArtifact), "package manifest"],
    [!isPresentSignal(repository.hasDemoOrDocs), "docs or demo"]
  ], "Shipping signals show the project is usable, not just browsable.");

  pushGap(gaps, repository, "usability", [
    [!isPresentSignal(repository.hasUsageGuide), "usage guide"],
    [!isPresentSignal(repository.hasDemoOrDocs), "docs or demo"],
    [!isPresentSignal(repository.hasPackageArtifact), "package manifest"],
    [codebaseShapeMetric(repository.codebaseShape?.exampleFileCount) === 0, "example or fixture files"]
  ], "Usability signals help someone run, try, and understand the project quickly.");

  pushGap(gaps, repository, "stewardship", [
    [!isPresentSignal(repository.hasContributing), "contribution guide"],
    [!isPresentSignal(repository.hasCodeOfConduct), "code of conduct"],
    [!isPresentSignal(repository.hasSecurityPolicy), "security policy"],
    [!isPresentSignal(repository.hasChangelog), "changelog"]
  ], "Stewardship signals show the project has clear ownership and care paths.");

  return gaps;
}

function pushGap(
  gaps: SignalGap[],
  repository: RepositoryInput,
  dimension: SignalDimension,
  checks: Array<[boolean, string]>,
  whyItMatters: string
): void {
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

function isEligibleRepository(repository: { isFork: unknown; isArchived: unknown }): boolean {
  return repository.isFork === false && repository.isArchived === false;
}

function isPresentSignal(value: unknown): boolean {
  return value === true;
}
