import { RepositoryIdentityIndex, repositoryIdentityKey } from "../shared/repository-identity.js";
import { GitHubCollectorError } from "./github-errors.js";

export function createRepositoryIndex<T extends { owner: { login: string }; name: string }>() {
  return new RepositoryIdentityIndex<T>(
    record => repositoryIdentityKey(record.owner.login, record.name),
    record => ({ ...record, owner: { login: record.owner.login.trim().toLowerCase() }, name: record.name.trim().toLowerCase() }),
    () => new GitHubCollectorError("invalid_github_response", "GitHub returned conflicting records for the same repository.")
  );
}
