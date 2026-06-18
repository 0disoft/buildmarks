import {
  privateLocalSignalVisibility,
  publicOnlySignalVisibility,
  type ProfileInput,
  type RepositoryInput,
  type SignalVisibilityDisclosure
} from "../shared/types";

export function validatePrivateRepositoryDisclosure(input: ProfileInput): void {
  const privateRepositories = input.repositories.filter((repository) => {
    validatePrivateRepositoryRecord(repository);
    return repository.visibility === "private";
  });

  if (privateRepositories.length === 0) {
    if (input.signalVisibility?.privateRepositoriesIncluded === true) {
      throw new Error("Private-local signal visibility requires at least one private repository input.");
    }
    if (input.signalVisibility !== undefined && !disclosuresMatch(input.signalVisibility, publicOnlySignalVisibility)) {
      throw new Error("Public-only signalVisibility fields are inconsistent.");
    }
    return;
  }

  if (input.signalVisibility === undefined || input.signalVisibility.privateRepositoriesIncluded !== true) {
    throw new Error("Private repository inputs require private-local signal visibility disclosure.");
  }
  if (!disclosuresMatch(input.signalVisibility, privateLocalSignalVisibility)) {
    throw new Error("Private-local signalVisibility fields are inconsistent.");
  }
}

export function isRedactedPrivateRepositoryName(value: string): boolean {
  return /^Private repository(?: [1-9][0-9]*)?$/.test(value);
}

export function validatePrivateRepositoryRecord(repository: RepositoryInput): void {
  if (repository.visibility !== "private") {
    if (repository.redactedName === true || isRedactedPrivateRepositoryName(repository.name)) {
      throw new Error("Redacted private repository inputs must set visibility to private.");
    }
    return;
  }

  if (repository.redactedName !== true) {
    throw new Error("Private repository inputs must redact repository names.");
  }
  if (repository.url !== undefined) {
    throw new Error("Private repository inputs must omit repository URLs.");
  }
  if (!isRedactedPrivateRepositoryName(repository.name)) {
    throw new Error("Private repository inputs must use redacted repository names.");
  }
}

function disclosuresMatch(left: SignalVisibilityDisclosure, right: SignalVisibilityDisclosure): boolean {
  return (
    left.scope === right.scope &&
    left.privateRepositoriesIncluded === right.privateRepositoriesIncluded &&
    left.privateRepositoryNamesRedacted === right.privateRepositoryNamesRedacted &&
    left.independentlyVerifiable === right.independentlyVerifiable &&
    left.cardLabel === right.cardLabel &&
    left.reportVisibility === right.reportVisibility
  );
}
