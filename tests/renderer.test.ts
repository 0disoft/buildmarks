import { describe, expect, test } from "bun:test";
import fixture from "../fixtures/example-public-profile.json";
import {
  analyzeSignalGaps,
  buildmarksVersion,
  renderFallbackCard,
  renderRepositorySignalCard,
  renderSignalGapsCard,
  renderUserSignalCard,
  signalDimensions,
  signalTypes,
  signalTypeDisplayLabels,
  scoreRepository,
  scoreUserProfile
} from "../src";
import type { ProfileInput } from "../src";

const now = new Date("2026-05-28T00:00:00.000Z");
const visibleVersion = `v${buildmarksVersion}`;
const renderDetailedProfileCard = (report: Parameters<typeof renderUserSignalCard>[0], options: Parameters<typeof renderUserSignalCard>[1] = {}) =>
  renderUserSignalCard(report, { layout: "detailed", ...options });

describe("SVG renderer", () => {
  test("defaults to readable project examples without visible scores or tiers", () => {
    const report = scoreUserProfile(fixture as ProfileInput, { now });
    const before = JSON.stringify(report);
    const svg = renderUserSignalCard(report);
    expect(svg).toContain('data-layout="compact"');
    expect(svg).toContain('viewBox="0 0 420 336"');
    expect(svg).toContain('aria-label="Representative projects and observed details"');
    expect(svg).toContain('class="project"');
    expect(svg).toContain('class="project">usable-toolkit</text>');
    expect(svg).toContain('aria-label="example-builder/usable-toolkit:');
    expect(svg).toContain('class="facts"');
    expect(svg).not.toContain('role="progressbar"');
    expect(svg).not.toContain('class="value"');
    expect(svg).not.toMatch(/>\s*(?:Gold|Platinum|Diamond)\s+[IVX]+<\/text>/);
    expect(svg).toContain("100% checked");
    expect(svg).toContain("Public GitHub projects");
    expect(svg).toContain(`Generated 2026-05-28 · v${buildmarksVersion}`);
    expect(JSON.stringify(report)).toBe(before);
  });
  test("retains all six type covers on compact cards", () => {
    const report = scoreUserProfile(fixture as ProfileInput, { now });
    const ids = new Set<string>();
    for (const signalType of signalTypes) {
      const svg = renderUserSignalCard({ ...report, signalType });
      const id = svg.match(/data-cover="([^"]+)"/)?.[1];
      if (id !== undefined) ids.add(id);
      expect(svg).toContain(`aria-label="${signalTypeDisplayLabels[signalType]}"`);
    }
    expect(ids.size).toBe(6);
  });
  test("shows an honest empty state and early-result notice without invented project facts", () => {
    const report = scoreUserProfile(fixture as ProfileInput, { now });
    const svg = renderUserSignalCard({ ...report, topRepos: [], resultStatus: "provisional" });
    expect(svg).toContain("No repository details to show.");
    expect(svg).toContain("Early look");
    expect(svg).not.toContain('class="project"');
  });
  test("escapes project names and replaces private identifiers on compact cards", () => {
    const report = scoreUserProfile(fixture as ProfileInput, { now });
    const projects = report.topRepos.map((repo) => ({ ...repo, owner: "owner", name: "<project>" }));
    expect(renderUserSignalCard({ ...report, topRepos: projects })).toContain("owner/&lt;project&gt;");
    const privateProjects = projects.map((repo) => ({ ...repo, name: "secret-project", signalVisibility: {
      scope: "public-and-owner-supplied-private" as const, privateRepositoriesIncluded: true, privateRepositoryNamesRedacted: true,
      independentlyVerifiable: false, cardLabel: "Public + Private Projects", reportVisibility: "private-local" as const
    } }));
    const svg = renderUserSignalCard({ ...report, topRepos: privateProjects });
    expect(svg).toContain("Private project 1");
    expect(svg).toContain("Public + Private Projects");
    expect(svg).toContain("Private projects supplied by owner");
    expect(svg).not.toContain("secret-project");
  });
  test("uses compact fallbacks and normalizes invalid runtime layout values", () => {
    const report = scoreUserProfile(fixture as ProfileInput, { now });
    expect(renderUserSignalCard({ ...report, evidenceStatus: "insufficient" }, { theme: "dark" })).toContain('viewBox="0 0 420 200"');
    expect(renderUserSignalCard(report, { layout: 'invalid" onload="alert(1)' as "compact" })).toContain('data-layout="compact"');
    expect(renderUserSignalCard(report, { layout: 'invalid" onload="alert(1)' as "compact" })).not.toContain("onload=");
  });
  test("classifies highlights by criterion ID even when evidence wording changes", () => {
    const report = scoreUserProfile(fixture as ProfileInput, { now });
    const evidence = (report.evidenceLedger ?? report.evidence).map((item) => ({ ...item, label: "Localized explanation" }));
    const svg = renderDetailedProfileCard({ ...report, evidenceLedger: evidence });
    expect(svg).toContain(">Tests</text>");
    expect(svg).toContain(">CI</text>");
    expect(svg).toContain(">Change history</text>");
    expect(svg).not.toContain(">Localized expla");
  });
  test("labels unobserved and irrelevant profile areas without giving them zero-score bars", () => {
    const report = scoreUserProfile(fixture as ProfileInput, { now });
    const svg = renderDetailedProfileCard({
      ...report,
      unavailableDimensions: ["shipping"],
      notApplicableDimensions: ["consistency"]
    });
    expect(svg).toContain("Shipping: not checked");
    expect(svg).toContain("Consistency: doesn&apos;t apply");
    expect(svg).toContain(">Not checked</text>");
    expect(svg).toContain(">Doesn't apply</text>");
    expect(svg).not.toContain('aria-label="Shipping score"');
    expect(svg).not.toContain('aria-label="Consistency score"');
    expect(svg.match(/role="progressbar"/g)).toHaveLength(4);
  });

  test("withholds scores when every profile area is unavailable", () => {
    const report = scoreUserProfile(fixture as ProfileInput, { now });
    const svg = renderDetailedProfileCard({ ...report, unavailableDimensions: [...signalDimensions] }, { theme: "dark" });
    expect(svg).toContain("No score is shown");
    expect(svg).not.toContain('role="progressbar"');
    expect(svg).not.toContain("data-cover=");
    expect(svg).toContain('class="card card-dark"');
  });

  test("uses the default cover for untrusted runtime type values", () => {
    const report = scoreUserProfile(fixture as ProfileInput, { now });
    for (const signalType of ["__proto__", 'unknown\" onload=\"alert(1)']) {
      Reflect.set(report, "signalType", signalType);
      const svg = renderDetailedProfileCard(report);
      expect(svg).toContain('data-cover="project-snapshot"');
      expect(svg).not.toContain("onload=");
      expect(svg).not.toContain("__proto__");
    }
  });
  test("selects six distinct covers without changing the supplied scores", () => {
    const report = scoreUserProfile(fixture as ProfileInput, { now });
    const coverIds = new Set<string>();
    for (const signalType of signalTypes) {
      const svg = renderDetailedProfileCard({ ...report, signalType }, { theme: "dark" });
      const id = svg.match(/data-cover="([^"]+)"/)?.[1];
      expect(id).toBeDefined();
      if (id !== undefined) coverIds.add(id);
      expect(svg).toContain(`aria-label="${signalTypeDisplayLabels[signalType]}"`);
      expect(svg).toContain('aria-valuenow="59"');
      expect(svg.match(/role="progressbar"/g)).toHaveLength(6);
    }
    expect(coverIds.size).toBe(6);
  });
  test("uses real vector geometry and score-scaled bars on the shared profile cover", () => {
    const report = scoreUserProfile(fixture as ProfileInput, { now });
    const svg = renderDetailedProfileCard(report);

    expect(svg).toContain('viewBox="0 0 760 420"');
    expect(svg.match(/role="progressbar"/g)).toHaveLength(6);
    expect(svg).toContain('width="244" height="7"');
    expect(svg).toContain('aria-valuenow="59"');
    expect(svg).not.toMatch(/<image|<foreignObject|https?:\/\/(?!www\.w3\.org)/);
    expect(svg).not.toMatch(/>\s*(?:Gold|Platinum|Diamond)\s+[IVX]+<\/text>/);
  });
  test("renders a no-score fallback when evidence is insufficient", () => {
    const report = scoreUserProfile(fixture as ProfileInput, { now });
    const svg = renderDetailedProfileCard({
      ...report,
      evidenceStatus: "insufficient",
      unavailableDimensions: [...signalDimensions]
    });

    expect(svg).toContain("Buildmarks needs more project information");
    expect(svg).toContain("No score is shown");
    expect(svg).not.toContain("Gold V");
  });
  test("renders a readable profile card without executable SVG content", () => {
    const report = scoreUserProfile(
      {
        ...(fixture as ProfileInput),
        username: "example <builder>"
      },
      { now }
    );
    const svg = renderDetailedProfileCard(report);

    expect(svg).toContain("<svg");
    expect(svg).toContain("Buildmarks");
    expect(svg).toContain(visibleVersion);
    expect(svg).toContain("example &lt;builder&gt;");
    expect(svg).toContain(`Buildmarks v${buildmarksVersion} · Public GitHub · 2026-05-28`);
    expect(svg).not.toContain("Public Signal Tier");
    expect(svg).toContain(visibleVersion);
    expect(svg).not.toContain("overall overall-");
    expect(svg).toContain('class="value">66</text>');
    expect(svg).toContain("100% checked");
    expect(svg).not.toContain("confidence");
    expect(svg).not.toContain("Provisional");
    expect(svg).not.toMatch(/\b(?:coverage|evidence|applicability|assessment|methodology|signals?)\b/i);
    expect(svg).toContain('class="value">72</text>');
    expect(svg).toContain('class="value">97</text>');
    expect(svg).toContain("Ease of Use: Gold II, 59 points out of 100");
    expect(svg).toContain("Project Care: Platinum V, 72 points out of 100");
    expect(svg).not.toContain("Collaboration:");
    expect(svg).not.toContain("Public Adoption:");
    expect(svg).not.toContain(">Collaboration</text>");
    expect(svg).not.toContain(">Public Adoption</text>");
    expect(svg).not.toContain("Public GitHub activity</text>");
    expect(svg).not.toContain("Owner-supplied GitHub activity");
    expect(svg).not.toContain("repos checked");
    expect(svg).not.toContain(">24 marks</text>");
    expect(svg).not.toContain("50-74 band");
    expect(svg).not.toContain("Score color legend");
    expect(svg).not.toContain("<text x=\"36\" y=\"390\" class=\"footer\">Not a ranking");
    expect(svg).toContain("@media (prefers-color-scheme: dark)");
    expect(svg).toContain("role=\"progressbar\"");
    expect(svg).toContain("Project Readiness: Gold I, 66 points out of 100");
    expect(svg).not.toContain(">64/100</text>");
    expect(svg).toContain("class=\"chip-bg\"");
    expect(svg).toContain("Highlights");
    expect(svg).toContain(">Tests</text>");
    expect(svg).toContain(">CI</text>");
    expect(svg).toContain(">Change history</text>");
    expect(svg).not.toContain("Changelog or release notes …");
    expect(svg).not.toContain("class=\"chip\">+ ");
    expect(svg).not.toContain("<text x=\"36\" y=\"338\" class=\"section-label\">Evidence");
    expect(svg).not.toContain("<script");
  });

  test("does not render an embedded report link on profile cards", () => {
    const report = scoreUserProfile(fixture as ProfileInput, { now });
    const svg = renderDetailedProfileCard(report);

    expect(svg).not.toContain("<a href=");
    expect(svg).not.toContain("View report");
    expect(svg).not.toContain("Open the Buildmarks report");
  });

  test("falls back to the auto theme for invalid runtime theme values", () => {
    const report = scoreUserProfile(fixture as ProfileInput, { now });
    const svg = renderDetailedProfileCard(report, {
      theme: "dark\" onload=\"alert(1)" as "auto"
    });

    expect(svg).toContain("class=\"card card-auto\"");
    expect(svg).not.toContain("onload=");
  });

  test("strips XML control characters from rendered text", () => {
    const report = scoreUserProfile(
      {
        ...(fixture as ProfileInput),
        username: "bad\u0001name"
      },
      { now }
    );
    const svg = renderDetailedProfileCard(report);

    expect(svg).toContain("badname");
    expect(svg).not.toContain("\u0001");
  });

  test("discloses owner-supplied private signals when included", () => {
    const repository = (fixture as ProfileInput).repositories[0]!;
    const { url: _url, ...repositoryWithoutUrl } = repository;
    const report = scoreUserProfile(
      {
        ...(fixture as ProfileInput),
        signalVisibility: {
          scope: "public-and-owner-supplied-private",
          privateRepositoriesIncluded: true,
          privateRepositoryNamesRedacted: true,
          independentlyVerifiable: false,
          cardLabel: "Public + Private Signals",
          reportVisibility: "private-local"
        },
        repositories: [{
          ...repositoryWithoutUrl,
          name: "Private repository 1",
          visibility: "private",
          redactedName: true
        }]
      },
      { now }
    );
    const svg = renderDetailedProfileCard(report);

    expect(svg).not.toContain("Owner-supplied GitHub activity");
    expect(svg).toContain(`Buildmarks v${buildmarksVersion} · Public + Private Projects · 2026-05-28`);
    expect(svg).not.toContain("Public + Private Tier");
    expect(svg).not.toContain("<text x=\"704\" y=\"58\" class=\"subtitle right\">Public Signal Tier</text>");
    expect(svg).not.toContain("<text x=\"36\" y=\"273\" class=\"label\">Public Adoption</text>");
    expect(svg).not.toContain(">Public Adoption</text>");
    expect(svg).not.toContain(">N/A</text>");
    expect(svg).not.toContain("Public Adoption: not available for this card");
    expect(svg).not.toContain("Public Adoption is not available for private-local cards");
    expect(svg).toContain("Project Care");
    expect(svg).toContain("cannot be checked independently on public GitHub");
    expect(svg).not.toContain("Public data only · Updated");
  });

  test("does not render context-dependent collaboration or adoption rows", () => {
    const report = scoreUserProfile(fixture as ProfileInput, { now });
    const svg = renderDetailedProfileCard(report);

    expect(svg).not.toContain("Collaboration Context");
    expect(svg).not.toContain(">Collaboration</text>");
    expect(svg).not.toContain(">Public Adoption</text>");
    expect(svg).not.toContain(">solo</text>");
    expect(svg).not.toContain("Collaboration is treated as solo context, not a front-card tier.");
    expect(svg).not.toContain("Collaboration:");
    expect(svg).not.toContain("Public Adoption:");
  });

  test("renders available low scores as numbers instead of an insufficient result", () => {
    const report = scoreUserProfile(fixture as ProfileInput, { now });
    const svg = renderDetailedProfileCard({
      ...report,
      overall: 0,
      dimensions: {
        maintainability: 0,
        completeness: 24,
        usability: 25,
        shipping: 55,
        consistency: 80,
        stewardship: 100
      }
    });

    expect(svg).not.toContain("Public Signal Tier");
    expect(svg).toContain('class="value">0</text>');
    expect(svg).toContain("Project Readiness: Gold V, 24 points out of 100");
    expect(svg).toContain("Ease of Use: Gold IV, 25 points out of 100");
    expect(svg).toContain("Shipping: Gold II, 55 points out of 100");
    expect(svg).toContain("Consistency: Platinum III, 80 points out of 100");
    expect(svg).toContain("Project Care: Diamond I, 100 points out of 100");
    expect(svg).not.toContain("Public Adoption:");
    expect(svg).not.toContain("Collaboration:");
    expect(svg).not.toContain("Insufficient Public Signal");
    expect(svg).not.toContain("Bronze");
    expect(svg).not.toContain("Silver");
  });

  test("keeps available scores visible while calling a thin pass an early look", () => {
    const report = scoreUserProfile({
      ...(fixture as ProfileInput),
      repositoryCollectionAttemptCount: 10,
      repositoryCollectionFailureCount: 2
    }, { now });
    const svg = renderDetailedProfileCard(report);

    expect(report.resultStatus).toBe("provisional");
    expect(svg).toContain("Early look · 80% checked");
    expect(svg).not.toContain("Provisional");
    expect(svg).toContain('class="value">97</text>');
  });

  test("maps high score tier boundaries with the full diamond ladder", () => {
    const report = scoreUserProfile(fixture as ProfileInput, { now });
    const svg = renderDetailedProfileCard({
      ...report,
      overall: 90,
      dimensions: {
        maintainability: 88,
        completeness: 90,
        usability: 92,
        shipping: 94,
        consistency: 96,
        stewardship: 98
      }
    });

    expect(svg).toContain("The overall result is Diamond V, 90 out of 100.");
    expect(svg).toContain("Maintainability: Platinum I, 88 points out of 100");
    expect(svg).toContain("Project Readiness: Diamond V, 90 points out of 100");
    expect(svg).toContain("Ease of Use: Diamond IV, 92 points out of 100");
    expect(svg).toContain("Shipping: Diamond III, 94 points out of 100");
    expect(svg).toContain("Consistency: Diamond II, 96 points out of 100");
    expect(svg).toContain("Project Care: Diamond I, 98 points out of 100");
  });

  test("keeps the repository activity window off the front card", () => {
    const report = scoreUserProfile(
      {
        ...(fixture as ProfileInput),
        activityWindowDays: 180
      },
      { now }
    );
    const svg = renderDetailedProfileCard(report);

    expect(svg).not.toContain("last 6 months");
  });

  test("renders a fallback card for failed generation", () => {
    const svg = renderFallbackCard("GitHub API limit reached.", { layout: "detailed" });

    expect(svg).toContain("width=\"760\" height=\"420\"");
    expect(svg).toContain("GitHub API limit reached");
    expect(svg).toContain("No score is shown");
    expect(svg).toContain("GitHub project snapshot");
    expect(svg).toContain("Card unavailable");
    expect(svg).not.toContain("reached..");
    expect(svg).toContain(visibleVersion);
  });

  test("tolerates long names and missing generated date", () => {
    const report = scoreUserProfile(
      {
        ...(fixture as ProfileInput),
        username: "example-builder-with-a-very-long-profile-name-that-should-not-overlap"
      },
      { now }
    );
    const svg = renderDetailedProfileCard({
      ...report,
      generatedAt: undefined as unknown as string
    });

    expect(svg).toContain("example-builder-with-a-very-long");
    expect(svg).toContain("…");
    expect(svg).toContain(`Buildmarks v${buildmarksVersion} · Public GitHub · `);
    expect(svg).not.toContain("undefined");
  });

  test("falls back when generated date is not a valid date string", () => {
    const report = scoreUserProfile(fixture as ProfileInput, { now });
    const svg = renderDetailedProfileCard({
      ...report,
      generatedAt: "INVALID_DATE_STRING"
    });

    expect(svg).toContain(`Buildmarks v${buildmarksVersion} · Public GitHub · `);
    expect(svg).not.toContain("INVALID_DA");
  });

  test("renders a signal gaps card as improvement hints, not a ranking", () => {
    const report = analyzeSignalGaps(fixture as ProfileInput, { now });
    const svg = renderSignalGapsCard(report);

    expect(svg).toContain("Ways to Improve");
    expect(svg).toContain("Public GitHub projects");
    expect(svg).toContain("could add:");
    expect(svg).toContain("suggestions");
    expect(svg).toContain(`Buildmarks v${buildmarksVersion} · Public GitHub`);
    expect(svg).toContain(visibleVersion);
    expect(svg).toContain("not a ranking");
  });

  test("renders private-local signal gaps without public-only wording", () => {
    const repository = (fixture as ProfileInput).repositories[0]!;
    const { url: _url, ...repositoryWithoutUrl } = repository;
    const report = analyzeSignalGaps(
      {
        ...(fixture as ProfileInput),
        signalVisibility: {
          scope: "public-and-owner-supplied-private",
          privateRepositoriesIncluded: true,
          privateRepositoryNamesRedacted: true,
          independentlyVerifiable: false,
          cardLabel: "Public + Private Signals",
          reportVisibility: "private-local"
        },
        repositories: [{
          ...repositoryWithoutUrl,
          name: "Private repository 1",
          visibility: "private",
          redactedName: true
        }]
      },
      { now }
    );
    const svg = renderSignalGapsCard(report);

    expect(svg).toContain("Included projects");
    expect(svg).toContain("1 suggestion");
    expect(svg).toContain(`Buildmarks v${buildmarksVersion} · Public + Private Projects`);
    expect(svg).toContain("Owner-supplied private repositories cannot be checked independently");
    expect(svg).not.toContain("Public GitHub projects");
    expect(svg).not.toContain("Buildmarks Gaps · Public Signals");
  });

  test("renders a repository signal card for one repository", () => {
    const repository = (fixture as ProfileInput).repositories[0]!;
    const report = scoreRepository(repository, { now });
    const svg = renderRepositorySignalCard(report);

    expect(svg).toContain("example-builder/usable-toolkit");
    expect(svg).not.toContain("Repository Signal Tier");
    expect(svg).toContain(`Buildmarks Repo v${buildmarksVersion} · Public GitHub`);
    expect(svg).toContain(visibleVersion);
    expect(svg).not.toContain("Repository GitHub activity");
    expect(svg).toContain("role=\"progressbar\"");
    expect(svg).toContain("The repository result is");
  });

  test("does not flatten an unavailable repository area into a zero score", () => {
    const repository = (fixture as ProfileInput).repositories[0]!;
    const report = scoreRepository({
      ...repository,
      unavailableObservations: [
        "readme",
        "usageGuide",
        "license",
        "releases",
        "demoOrDocs",
        "packageArtifact",
        "codebaseShape"
      ]
    }, { now });
    const svg = renderRepositorySignalCard(report);

    expect(report.dimensions.completeness.assessment.applicability).toBe("unavailable");
    expect(svg).not.toContain(">Project Readiness</text>");
    expect(svg).not.toContain("Project Readiness Gold V, 0 out of 100");
  });

  test("renders private repository signal cards without public-only wording", () => {
    const repository = (fixture as ProfileInput).repositories[0]!;
    const { url: _url, ...repositoryWithoutUrl } = repository;
    const report = scoreRepository({
      ...repositoryWithoutUrl,
      owner: "secret-client-org",
      name: "Private repository 1",
      visibility: "private",
      redactedName: true
    }, { now });
    const svg = renderRepositorySignalCard(report);

    expect(svg).toContain("Private owner/Private repository 1");
    expect(svg).not.toContain("Public + Private Repo Tier");
    expect(svg).toContain(`Buildmarks Repo v${buildmarksVersion} · Public + Private Projects`);
    expect(svg).toContain("This owner-supplied private repository cannot be checked independently on public GitHub");
    expect(svg).not.toContain("<text x=\"704\" y=\"58\" class=\"subtitle right\">Repository Signal Tier</text>");
    expect(svg).not.toContain("<text x=\"36\" y=\"388\" class=\"footer\">Buildmarks Repo</text>");
    expect(svg).not.toContain("secret-client-org");
    expect(svg).not.toContain("Based on public GitHub only");
  });
});
