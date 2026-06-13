import type {
  CodebaseShapeSignals,
  CollectedGitHubProfile,
  ProfileInput,
  RepositoryInput
} from "../shared/types";

export function normalizePublicGitHubProfile(profile: CollectedGitHubProfile): ProfileInput {
  return {
    username: profile.username,
    generatedAt: profile.collectedAt,
    ...(profile.activityWindowDays === undefined ? {} : { activityWindowDays: profile.activityWindowDays }),
    ...(profile.activityAggregatesDeferred === undefined
      ? {}
      : { activityAggregatesDeferred: profile.activityAggregatesDeferred }),
    ...(profile.repositoryCollectionFailureCount === undefined
      ? {}
      : { repositoryCollectionFailureCount: profile.repositoryCollectionFailureCount }),
    ...(profile.signalVisibility ? { signalVisibility: profile.signalVisibility } : {}),
    repositories: profile.repositories.map(normalizePublicGitHubRepository)
  };
}

function normalizePublicGitHubRepository(repository: CollectedGitHubProfile["repositories"][number]): RepositoryInput {
  return {
    owner: repository.owner,
    name: repository.name,
    url: repository.url,
    ...(repository.visibility ? { visibility: repository.visibility } : {}),
    ...(repository.redactedName === undefined ? {} : { redactedName: repository.redactedName }),
    isFork: repository.isFork,
    isArchived: repository.isArchived,
    stars: repository.stars,
    forks: repository.forks,
    createdAt: repository.createdAt,
    pushedAt: repository.pushedAt,
    hasReadme: repository.files.hasReadme,
    hasLicense: repository.files.hasLicense,
    hasUsageGuide: repository.files.hasUsageGuide,
    hasCi: repository.files.hasCi,
    hasTests: repository.files.hasTests,
    hasChangelog: repository.files.hasChangelog,
    hasContributing: repository.files.hasContributing,
    hasCodeOfConduct: repository.files.hasCodeOfConduct,
    hasSecurityPolicy: repository.files.hasSecurityPolicy,
    hasReleases: repository.hasReleasesOrTags,
    hasDemoOrDocs: repository.files.hasDemoOrDocs,
    hasPackageArtifact: repository.files.hasPackageArtifact,
    codebaseShape: repository.files.codebaseShape ?? emptyCodebaseShape(),
    issueResponseCount: repository.activity.issueResponseCount,
    pullRequestReviewCount: repository.activity.pullRequestReviewCount,
    externalContributorCount: repository.activity.externalContributorCount
  };
}

function emptyCodebaseShape(): CodebaseShapeSignals {
  return {
    sourceFileCount: 0,
    testFileCount: 0,
    exampleFileCount: 0,
    medianSourceFileBytes: 0,
    p90SourceFileBytes: 0,
    oversizedSourceFileCount: 0,
    testToSourceRatio: 0
  };
}
