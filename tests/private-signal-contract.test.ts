import { readFile } from "node:fs/promises";
import { describe, expect, test } from "bun:test";
import {
  privateLocalRepositorySignalContract,
  privateLocalSignalVisibility,
  publicOnlyPrivateRepositorySignalContract,
  publicOnlySignalVisibility,
  validatePrivateRepositorySignalContract,
  type PrivateRepositorySignalContract
} from "../src";

describe("private repository signal contract", () => {
  test("keeps public-only as the default trust surface", () => {
    const validation = validatePrivateRepositorySignalContract(
      publicOnlyPrivateRepositorySignalContract
    );

    expect(publicOnlyPrivateRepositorySignalContract.enabled).toBe(false);
    expect(publicOnlyPrivateRepositorySignalContract.mode).toBe("public-only");
    expect(publicOnlyPrivateRepositorySignalContract.hostedUploadAllowed).toBe(false);
    expect(publicOnlyPrivateRepositorySignalContract.disclosure).toEqual(publicOnlySignalVisibility);
    expect(validation).toEqual({ ok: true, errors: [] });
  });

  test("allows only explicit redacted private-local signals", () => {
    const validation = validatePrivateRepositorySignalContract(
      privateLocalRepositorySignalContract
    );

    expect(privateLocalRepositorySignalContract.enabled).toBe(true);
    expect(privateLocalRepositorySignalContract.mode).toBe("private-local");
    expect(privateLocalRepositorySignalContract.localOnly).toBe(true);
    expect(privateLocalRepositorySignalContract.requiresExplicitToken).toBe(true);
    expect(privateLocalRepositorySignalContract.hostedUploadAllowed).toBe(false);
    expect(privateLocalRepositorySignalContract.recommendedToken).toBe(
      "fine-grained-read-only-selected-repositories"
    );
    expect(privateLocalRepositorySignalContract.allowedEvidence).toContain("file-presence");
    expect(privateLocalRepositorySignalContract.allowedEvidence).toContain("aggregate-codebase-shape");
    expect(privateLocalRepositorySignalContract.allowedEvidence).toContain("release-or-tag-presence");
    expect(privateLocalRepositorySignalContract.disclosure).toEqual(privateLocalSignalVisibility);
    expect(privateLocalRepositorySignalContract.disclosure.cardLabel).toBe("Public + Private Signals");
    expect(privateLocalRepositorySignalContract.disclosure.privateRepositoryNamesRedacted).toBe(true);
    expect(privateLocalRepositorySignalContract.disclosure.independentlyVerifiable).toBe(false);
    expect(privateLocalRepositorySignalContract.disclosure.reportVisibility).toBe("private-local");
    expect(validation).toEqual({ ok: true, errors: [] });
  });

  test("rejects unsafe private mode contracts", () => {
    const unsafe: PrivateRepositorySignalContract = {
      ...privateLocalRepositorySignalContract,
      localOnly: false,
      requiresExplicitToken: false,
      hostedUploadAllowed: true,
      prohibitedEvidence: ["file contents"],
      disclosure: {
        ...privateLocalRepositorySignalContract.disclosure,
        privateRepositoriesIncluded: false,
        privateRepositoryNamesRedacted: false,
        independentlyVerifiable: true,
        reportVisibility: "public-safe"
      }
    };

    const validation = validatePrivateRepositorySignalContract(unsafe);

    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain("Private repository signals must remain local-only.");
    expect(validation.errors).toContain(
      "Private repository signals must require an explicitly supplied token."
    );
    expect(validation.errors).toContain(
      "Private repository signals must not allow hosted upload by default."
    );
    expect(validation.errors).toContain(
      "Private repository cards must disclose that private repositories are included."
    );
    expect(validation.errors).toContain(
      "Private repository cards must redact repository names by default."
    );
    expect(validation.errors).toContain(
      "Private repository cards must state that private evidence is not independently verifiable."
    );
    expect(validation.errors).toContain(
      "Private repository reports must default to private-local visibility."
    );
    expect(validation.errors).toContain(
      "Private repository contract must prohibit raw commit count."
    );
    expect(validation.errors).toContain(
      "Private repository contract must prohibit follower count."
    );
    expect(validation.errors).toContain(
      "Private repository contract must prohibit language percentage."
    );
  });

  test("documents private-local mode without changing the public collector", async () => {
    const privateContract = await readFile("docs/private-repository-signal-contract.md", "utf8");
    const collectorContract = await readFile("docs/github-collector-contract.md", "utf8");
    const operations = await readFile("docs/github-collector-operations.md", "utf8");
    const readme = await readFile("README.md", "utf8");
    const combined = [privateContract, collectorContract, operations, readme].join("\n");

    expect(privateContract).toContain("Buildmarks is public-only by default");
    expect(privateContract).toContain("Private-local mode is opt-in");
    expect(privateContract).toContain("fine-grained GitHub token");
    expect(privateContract).toContain("Public + Private Signals");
    expect(privateContract).toContain("not independently verifiable from public GitHub");
    expect(privateContract).toContain("redact private repository names by default");
    expect(privateContract).toContain("file contents");
    expect(privateContract).toContain("aggregate codebase-shape signals");
    expect(privateContract).toContain("commit messages");
    expect(privateContract).toContain("raw commit count");
    expect(privateContract).toContain("hiring suitability");
    expect(privateContract).toContain("not a hosted endpoint contract");
    expect(collectorContract).toContain("The live public collector remains public-only");
    expect(operations).toContain("separate opt-in private-local mode");
    expect(readme).toContain("docs/private-repository-signal-contract.md");
    expect(readme).toContain("Private repository signals are not part of `collectPublicGitHubProfile()`");
    expect(combined).toContain("owner-supplied");
  });
});
