import {
  privateLocalSignalVisibility,
  publicOnlySignalVisibility,
  type SignalVisibilityDisclosure
} from "../shared/types";

export type PrivateRepositoryEvidenceKind =
  | "repository-metadata"
  | "file-presence"
  | "aggregate-codebase-shape"
  | "release-or-tag-presence"
  | "aggregate-issue-pr-traces";

export interface PrivateRepositorySignalContract {
  enabled: boolean;
  mode: "public-only" | "private-local";
  localOnly: boolean;
  requiresExplicitToken: boolean;
  hostedUploadAllowed: boolean;
  recommendedToken: "fine-grained-read-only-selected-repositories";
  allowedEvidence: readonly PrivateRepositoryEvidenceKind[];
  prohibitedEvidence: readonly string[];
  disclosure: SignalVisibilityDisclosure;
}

export interface PrivateRepositorySignalContractValidation {
  ok: boolean;
  errors: string[];
}

export const publicOnlyPrivateRepositorySignalContract = {
  enabled: false,
  mode: "public-only",
  localOnly: true,
  requiresExplicitToken: false,
  hostedUploadAllowed: false,
  recommendedToken: "fine-grained-read-only-selected-repositories",
  allowedEvidence: [],
  prohibitedEvidence: [
    "private repositories",
    "private contributions",
    "file contents",
    "commit messages",
    "issue titles or bodies",
    "pull request titles or bodies",
    "raw commit count",
    "follower count",
    "language percentage",
    "employer, seniority, compensation, hiring, or ranking inference"
  ],
  disclosure: publicOnlySignalVisibility
} satisfies PrivateRepositorySignalContract;

export const privateLocalRepositorySignalContract = {
  enabled: true,
  mode: "private-local",
  localOnly: true,
  requiresExplicitToken: true,
  hostedUploadAllowed: false,
  recommendedToken: "fine-grained-read-only-selected-repositories",
  allowedEvidence: [
    "repository-metadata",
    "file-presence",
    "aggregate-codebase-shape",
    "release-or-tag-presence",
    "aggregate-issue-pr-traces"
  ],
  prohibitedEvidence: [
    "file contents",
    "commit messages",
    "issue titles or bodies",
    "pull request titles or bodies",
    "private contribution graph inference",
    "raw commit count",
    "follower count",
    "language percentage",
    "employer, seniority, compensation, hiring, or ranking inference"
  ],
  disclosure: privateLocalSignalVisibility
} satisfies PrivateRepositorySignalContract;

export function validatePrivateRepositorySignalContract(
  contract: PrivateRepositorySignalContract
): PrivateRepositorySignalContractValidation {
  const errors: string[] = [];

  if (contract.enabled && contract.mode !== "private-local") {
    errors.push("Private repository signals must use private-local mode when enabled.");
  }

  if (contract.enabled && !contract.localOnly) {
    errors.push("Private repository signals must remain local-only.");
  }

  if (contract.enabled && !contract.requiresExplicitToken) {
    errors.push("Private repository signals must require an explicitly supplied token.");
  }

  if (contract.hostedUploadAllowed) {
    errors.push("Private repository signals must not allow hosted upload by default.");
  }

  if (contract.enabled && contract.allowedEvidence.length === 0) {
    errors.push("Private repository signals must declare allowed evidence kinds.");
  }

  if (contract.enabled && !contract.disclosure.privateRepositoriesIncluded) {
    errors.push("Private repository cards must disclose that private repositories are included.");
  }

  if (contract.enabled && !contract.disclosure.privateRepositoryNamesRedacted) {
    errors.push("Private repository cards must redact repository names by default.");
  }

  if (contract.enabled && contract.disclosure.independentlyVerifiable) {
    errors.push("Private repository cards must state that private evidence is not independently verifiable.");
  }

  if (contract.enabled && contract.disclosure.reportVisibility !== "private-local") {
    errors.push("Private repository reports must default to private-local visibility.");
  }

  if (!contract.enabled && !isPublicOnlyDisclosure(contract.disclosure)) {
    errors.push("Public-only repository cards must use the public-only disclosure.");
  }

  for (const prohibited of ["raw commit count", "follower count", "language percentage"]) {
    if (!contract.prohibitedEvidence.includes(prohibited)) {
      errors.push(`Private repository contract must prohibit ${prohibited}.`);
    }
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

function isPublicOnlyDisclosure(disclosure: SignalVisibilityDisclosure): boolean {
  return (
    disclosure.scope === publicOnlySignalVisibility.scope &&
    disclosure.privateRepositoriesIncluded === publicOnlySignalVisibility.privateRepositoriesIncluded &&
    disclosure.privateRepositoryNamesRedacted === publicOnlySignalVisibility.privateRepositoryNamesRedacted &&
    disclosure.independentlyVerifiable === publicOnlySignalVisibility.independentlyVerifiable &&
    disclosure.cardLabel === publicOnlySignalVisibility.cardLabel &&
    disclosure.reportVisibility === publicOnlySignalVisibility.reportVisibility
  );
}
