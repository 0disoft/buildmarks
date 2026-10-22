import type { ProfileInput, RepositoryInput } from "./types.js";

export class RepositoryConflictError extends Error {
  constructor() {
    super("Conflicting records share the same repository identity; provide one consistent record per owner/name.");
    this.name = "RepositoryConflictError";
  }
}

export function repositoryIdentityKey(owner: string, name: string): string {
  return JSON.stringify([owner.trim().toLowerCase(), name.trim().toLowerCase()]);
}

/** The first identical record wins; conflicting observations never silently replace it. */
export class RepositoryIdentityIndex<T> {
  private readonly records = new Map<string, T>();
  constructor(
    private readonly key: (record: T) => string,
    private readonly comparable: (record: T) => unknown,
    private readonly conflict: () => Error = () => new RepositoryConflictError()
  ) {}

  add(record: T): boolean {
    const key = this.key(record);
    if (!this.records.has(key)) { this.records.set(key, record); return true; }
    if (canonicalData(this.comparable(this.records.get(key)!)) !== canonicalData(this.comparable(record))) throw this.conflict();
    return false;
  }
}

export function normalizeProfileRepositories(input: ProfileInput): ProfileInput {
  const index = new RepositoryIdentityIndex<RepositoryInput>(
    record => repositoryIdentityKey(record.owner, record.name),
    record => ({ ...record, owner: record.owner.trim().toLowerCase(), name: record.name.trim().toLowerCase(),
      ...(record.unavailableObservations === undefined ? {} : { unavailableObservations: [...record.unavailableObservations].sort() }) })
  );
  const repositories = input.repositories.filter(record => index.add(record));
  return repositories.length === input.repositories.length ? input : { ...input, repositories };
}

function canonicalData(value: unknown, ancestors = new Set<object>()): string {
  if (value === null || typeof value !== "object") {
    return typeof value === "number" ? `number:${String(value)}` : `${typeof value}:${JSON.stringify(value)}`;
  }
  if (ancestors.has(value)) throw new Error("Repository observations must be acyclic data.");
  ancestors.add(value);
  const result = Array.isArray(value)
    ? `[${value.map(item => canonicalData(item, ancestors)).join(",")}]`
    : `{${Object.keys(value).filter(key => (value as Record<string, unknown>)[key] !== undefined).sort()
      .map(key => `${JSON.stringify(key)}:${canonicalData((value as Record<string, unknown>)[key], ancestors)}`).join(",")}}`;
  ancestors.delete(value);
  return result;
}
