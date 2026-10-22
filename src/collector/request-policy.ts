export const githubRequestPolicy = Object.freeze({
  timeoutMilliseconds: 10_000,
  maximumTimerMilliseconds: 2_147_483_647,
  retryCount: 1,
  retryBaseDelayMilliseconds: 150,
  retryStepDelayMilliseconds: 250,
  maximumPageSize: 100,
  maximumConcurrentRequests: 15,
  maximumQueuedRequests: 160
} as const);
