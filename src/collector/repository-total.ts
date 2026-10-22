/** Account-wide owned repositories, including forks, archives and private repos. */
export function readTotalOwnedRepositoryCount(value: unknown, username: string): number | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const user = value as Record<string, unknown>;
  if (typeof user.login !== "string" || user.login.toLowerCase() !== username.toLowerCase()) return undefined;
  const publicCount = user.public_repos;
  const privateCount = user.owned_private_repos;
  // Missing private counts mean unknown, not zero. total_private_repos may include collaborations.
  if (typeof publicCount !== "number" || !Number.isSafeInteger(publicCount) || publicCount < 0
    || typeof privateCount !== "number" || !Number.isSafeInteger(privateCount) || privateCount < 0) return undefined;
  const total = publicCount + privateCount;
  return Number.isSafeInteger(total) ? total : undefined;
}
