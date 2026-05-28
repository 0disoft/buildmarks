import type { Evidence, EvidenceLevel, EvidenceSource } from "../shared/types";

export function createEvidence(
  level: EvidenceLevel,
  label: string,
  source: EvidenceSource,
  repo?: string
): Evidence {
  return repo === undefined
    ? { level, label, source }
    : { level, label, source, repo };
}
