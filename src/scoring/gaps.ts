import type { ProfileInput, RepositoryInput, SignalGap, SignalDimension, UserSignalGapsReport } from "../shared/types";

const maxGaps = 8;

export interface AnalyzeSignalGapsOptions {
  now?: Date;
}

export function analyzeSignalGaps(
  input: ProfileInput,
  options: AnalyzeSignalGapsOptions = {}
): UserSignalGapsReport {
  const generatedAt = input.generatedAt ?? (options.now ?? new Date()).toISOString();
  const eligibleRepositories = input.repositories.filter((repository) => !repository.isFork && !repository.isArchived);
  const gaps = eligibleRepositories.flatMap(repositorySignalGaps).slice(0, maxGaps);

  return {
    username: input.username,
    generatedAt,
    gaps,
    limitations: [
      "Public GitHub data only.",
      "These are improvement hints, not a developer ranking.",
      "Private work and non-GitHub maintenance are not inferred."
    ]
  };
}

function repositorySignalGaps(repository: RepositoryInput): SignalGap[] {
  const gaps: SignalGap[] = [];

  pushGap(gaps, repository, "maintainability", [
    [!repository.hasTests, "tests"],
    [!repository.hasCi, "CI workflow"],
    [!repository.hasChangelog, "changelog"],
    [!repository.hasSecurityPolicy, "security policy"]
  ], "Tests, automation, and change history improve maintenance confidence.");

  pushGap(gaps, repository, "completeness", [
    [!repository.hasReadme, "README"],
    [!repository.hasUsageGuide, "usage guide"],
    [!repository.hasLicense, "license"],
    [!repository.hasDemoOrDocs, "docs or demo"]
  ], "Completeness signals help other people understand, run, and reuse the project.");

  pushGap(gaps, repository, "shipping", [
    [!repository.hasReleases, "release or tag"],
    [!repository.hasPackageArtifact, "package manifest"],
    [!repository.hasDemoOrDocs, "docs or demo"]
  ], "Shipping signals show the project is usable, not just browsable.");

  pushGap(gaps, repository, "collaboration", [
    [!repository.hasContributing, "contribution guide"],
    [!repository.hasCodeOfConduct, "code of conduct"],
    [repository.issueResponseCount === 0, "public issue response trace"],
    [repository.pullRequestReviewCount === 0, "public review trace"]
  ], "Collaboration signals help external contributors participate.");

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
