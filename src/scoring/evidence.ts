import type { Evidence, EvidenceLevel, EvidenceSource } from "../shared/types";

type EvidenceMetadata = Pick<Evidence, "id" | "criterionId" | "dimension" | "basis">;

export function createEvidence(
  level: EvidenceLevel,
  label: string,
  source: EvidenceSource,
  repo?: string,
  metadata: Partial<EvidenceMetadata> = {}
): Evidence {
  return repo === undefined
    ? { level, label, source, ...metadata }
    : { level, label, source, repo, ...metadata };
}
