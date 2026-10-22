export const detailedCardSize = Object.freeze({ width: 760, height: 420 } as const);
export const compactCardSize = Object.freeze({ width: 420, publicHeight: 280, privateHeight: 304, fallbackHeight: 200 } as const);

export const cardDisplayPolicy = Object.freeze({
  detailedHighlightLimit: 3,
  contextHighlightLimit: 4,
  gapLimit: 4,
  rankedFactLimit: 2,
  leadProjectFactLimit: 2,
  secondaryProjectFactLimit: 1
} as const);
