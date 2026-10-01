import { methodologyCriteria, type CriterionCheck } from "../scoring/methodology-v2.js";
import type { RepoSignal, SignalDimension, SignalType } from "../shared/types.js";

export interface CardProject {
  name: string;
  private: boolean;
  facts: string[];
}

const criteria = new Map(methodologyCriteria.map((criterion) => [criterion.id, criterion]));
const facts: Partial<Record<CriterionCheck, { group: string; label: string }>> = {
  "tests-backed-by-ci": { group: "tests", label: "Tests + workflow" },
  "tests-backed-by-files": { group: "tests", label: "Test files found" },
  tests: { group: "tests", label: "Tests found" },
  ci: { group: "automation", label: "Workflow found" },
  "release-notes-match-shipping": { group: "shipping", label: "Release + changelog" },
  "release-backed-by-package": { group: "shipping", label: "Release + manifest" },
  releases: { group: "shipping", label: "Release or tag found" },
  "readme-backed-by-usage": { group: "docs", label: "README + usage" },
  "usage-backed-by-docs": { group: "docs", label: "Usage + docs" },
  "docs-backed-by-examples": { group: "docs", label: "Docs + examples" },
  "install-backed-by-examples": { group: "examples", label: "Manifest + examples" },
  "usage-guide": { group: "docs", label: "Usage guide found" },
  readme: { group: "docs", label: "README found" },
  "docs-or-demo": { group: "docs", label: "Docs or demo reference" },
  examples: { group: "examples", label: "Examples found" },
  "package-artifact": { group: "package", label: "Manifest found" },
  "security-policy": { group: "security", label: "Security guide found" },
  "community-guardrails": { group: "community", label: "Community guides" },
  contributing: { group: "community", label: "Contribution guide" },
  license: { group: "license", label: "License found" }
};
const preferredDimensions: Record<SignalType, readonly SignalDimension[]> = {
  "Maintainer-Builder": ["maintainability", "stewardship"],
  "Productized Builder": ["usability", "completeness"],
  Builder: ["completeness", "shipping"],
  "Steady Shipper": ["shipping", "consistency"],
  "Well-Documented Project": ["usability", "completeness"],
  "General Signal Profile": []
};

/** Select display examples from the report's existing sample without changing scores. */
export function selectCardProjects(repositories: readonly RepoSignal[], signalType: SignalType): CardProject[] {
  const preferred = Object.hasOwn(preferredDimensions, signalType) ? preferredDimensions[signalType] : [];
  const candidates = repositories.flatMap((repository) => {
    if (repository.assessment?.score === null || repository.assessment?.applicability === "unavailable") return [];
    const seen = new Set<string>();
    const details = (repository.evidenceLedger ?? repository.evidence).flatMap((evidence) => {
      const criterion = evidence.criterionId === undefined ? undefined : criteria.get(evidence.criterionId);
      const fact = criterion === undefined ? undefined : facts[criterion.check];
      if (evidence.level !== "positive" || criterion === undefined || fact === undefined) return [];
      return [{ ...fact, preferred: preferred.includes(criterion.dimension), combined: criterion.basis === "corroborated", id: criterion.id }];
    }).sort((left, right) => Number(right.preferred) - Number(left.preferred)
      || Number(right.combined) - Number(left.combined) || compareText(left.id, right.id))
      .filter((detail) => {
        if (seen.has(detail.group)) return false;
        seen.add(detail.group);
        return true;
      });
    if (details.length === 0) return [];
    return [{ repository, details, key: `${repository.owner}/${repository.name}`.toLowerCase() }];
  }).sort((left, right) => Number(right.details.some((detail) => detail.preferred)) - Number(left.details.some((detail) => detail.preferred))
    || Math.min(right.details.length, 2) - Math.min(left.details.length, 2) || compareText(left.key, right.key));
  const unique = candidates.filter((candidate, index) => candidates.findIndex((other) => other.key === candidate.key) === index);
  const first = unique[0];
  if (first === undefined) return [];
  const otherKind = unique.slice(1).find((candidate) => candidate.repository.repositoryKind?.kind !== first.repository.repositoryKind?.kind);
  const second = otherKind ?? unique[1];
  let privateOrdinal = 0;
  return [first, ...(second === undefined ? [] : [second])].map(({ repository, details }, index) => {
    const isPrivate = repository.signalVisibility?.privateRepositoriesIncluded === true;
    return {
      name: isPrivate ? `Private project ${++privateOrdinal}` : `${repository.owner}/${repository.name}`,
      private: isPrivate,
      facts: details.slice(0, index === 0 ? 2 : 1).map((detail) => detail.label)
    };
  });
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
