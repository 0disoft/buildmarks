import { describe, expect, test } from "bun:test";
import fixture from "../fixtures/example-public-profile.json";
import {
  analyzeSignalGaps,
  buildmarksVersion,
  renderFallbackCard,
  renderRepositorySignalCard,
  renderSignalGapsCard,
  renderUserSignalCard,
  scoreRepository,
  scoreUserProfile
} from "../src";
import type { ProfileInput } from "../src";

const now = new Date("2026-05-28T00:00:00.000Z");
const visibleVersion = `>v${buildmarksVersion}</text>`;
const spacedBrandVersion = `<text x="190" y="54" class="brand-version">v${buildmarksVersion}</text>`;

describe("SVG renderer", () => {
  test("renders a readable profile card without executable SVG content", () => {
    const report = scoreUserProfile(
      {
        ...(fixture as ProfileInput),
        username: "example <builder>"
      },
      { now }
    );
    const svg = renderUserSignalCard(report);

    expect(svg).toContain("<svg");
    expect(svg).toContain("Buildmarks");
    expect(svg).toContain(visibleVersion);
    expect(svg).toContain(spacedBrandVersion);
    expect(svg).toContain("example &lt;builder&gt;");
    expect(svg).toContain("Buildmarks · 2026-05-28");
    expect(svg).toContain("Public Signal Tier");
    expect(svg).toContain(visibleVersion);
    expect(svg).toContain("overall overall-");
    expect(svg).toContain(">Gold I</text>");
    expect(svg).toContain(">Platinum V</text>");
    expect(svg).toContain(">Platinum II</text>");
    expect(svg).toContain("Usability Surface: Gold I, 60 points out of 100");
    expect(svg).toContain("Project Stewardship: Gold I, 60 points out of 100");
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
    expect(svg).toContain("Project Completeness: Gold I, 64 points out of 100");
    expect(svg).not.toContain(">64/100</text>");
    expect(svg).toContain("class=\"chip-bg\"");
    expect(svg).toContain("Highlights");
    expect(svg).toContain(">Tests</text>");
    expect(svg).toContain(">CI</text>");
    expect(svg).toContain(">Changelog</text>");
    expect(svg).not.toContain("Changelog or release notes …");
    expect(svg).not.toContain("class=\"chip\">+ ");
    expect(svg).not.toContain("<text x=\"36\" y=\"338\" class=\"section-label\">Evidence");
    expect(svg).not.toContain("<script");
  });

  test("renders a safe report link when provided", () => {
    const report = scoreUserProfile(fixture as ProfileInput, { now });
    const svg = renderUserSignalCard(report, {
      reportHref: "./assets/buildmarks-report/buildmarks-report.html"
    });

    expect(svg).toContain("<a href=\"./assets/buildmarks-report/buildmarks-report.html\"");
    expect(svg).toContain("View report");
    expect(svg).toContain("Open the Buildmarks report");
  });

  test("drops executable report links", () => {
    const report = scoreUserProfile(fixture as ProfileInput, { now });
    const svg = renderUserSignalCard(report, {
      reportHref: "javascript:alert(1)"
    });

    expect(svg).not.toContain("<a href=");
    expect(svg).not.toContain("javascript:");
    expect(svg).not.toContain("View report");
  });

  test("drops non-http report link schemes", () => {
    const report = scoreUserProfile(fixture as ProfileInput, { now });
    const schemes = ["mailto:team@example.test", "vbscript:msgbox(1)", "data:text/html,<script>alert(1)</script>"];

    schemes.forEach((reportHref) => {
      const svg = renderUserSignalCard(report, { reportHref });

      expect(svg).not.toContain("<a href=");
      expect(svg).not.toContain("View report");
    });
  });

  test("drops protocol-relative report links", () => {
    const report = scoreUserProfile(fixture as ProfileInput, { now });
    const svg = renderUserSignalCard(report, {
      reportHref: "//evil.example/report.html"
    });

    expect(svg).not.toContain("<a href=");
    expect(svg).not.toContain("evil.example");
    expect(svg).not.toContain("View report");
  });

  test("falls back to the auto theme for invalid runtime theme values", () => {
    const report = scoreUserProfile(fixture as ProfileInput, { now });
    const svg = renderUserSignalCard(report, {
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
    const svg = renderUserSignalCard(report);

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
    const svg = renderUserSignalCard(report);

    expect(svg).not.toContain("Owner-supplied GitHub activity");
    expect(svg).toContain("Buildmarks · Public + Private Signals · 2026-05-28");
    expect(svg).toContain("Public + Private Tier");
    expect(svg).not.toContain("<text x=\"704\" y=\"58\" class=\"subtitle right\">Public Signal Tier</text>");
    expect(svg).not.toContain("<text x=\"36\" y=\"273\" class=\"label\">Public Adoption</text>");
    expect(svg).not.toContain(">Public Adoption</text>");
    expect(svg).not.toContain(">N/A</text>");
    expect(svg).not.toContain("Public Adoption: not available for this card");
    expect(svg).not.toContain("Public Adoption is not available for private-local cards");
    expect(svg).toContain("Project Stewardship");
    expect(svg).toContain("not independently verifiable from public GitHub");
    expect(svg).not.toContain("Public data only · Updated");
  });

  test("does not render context-dependent collaboration or adoption rows", () => {
    const report = scoreUserProfile(fixture as ProfileInput, { now });
    const svg = renderUserSignalCard(report);

    expect(svg).not.toContain("Collaboration Context");
    expect(svg).not.toContain(">Collaboration</text>");
    expect(svg).not.toContain(">Public Adoption</text>");
    expect(svg).not.toContain(">solo</text>");
    expect(svg).not.toContain("Collaboration is treated as solo context, not a front-card tier.");
    expect(svg).not.toContain("Collaboration:");
    expect(svg).not.toContain("Public Adoption:");
  });

  test("renders low scores as Gold V instead of an insufficient signal label", () => {
    const report = scoreUserProfile(fixture as ProfileInput, { now });
    const svg = renderUserSignalCard({
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

    expect(svg).toContain("Public Signal Tier");
    expect(svg).toContain(">Gold V</text>");
    expect(svg).toContain("Project Completeness: Gold V, 24 points out of 100");
    expect(svg).toContain("Usability Surface: Gold IV, 25 points out of 100");
    expect(svg).toContain("Shipping Evidence: Gold II, 55 points out of 100");
    expect(svg).toContain("Consistency: Platinum III, 80 points out of 100");
    expect(svg).toContain("Project Stewardship: Diamond I, 100 points out of 100");
    expect(svg).not.toContain("Public Adoption:");
    expect(svg).not.toContain("Collaboration:");
    expect(svg).not.toContain("Insufficient Public Signal");
    expect(svg).not.toContain("Bronze");
    expect(svg).not.toContain("Silver");
  });

  test("maps high score tier boundaries with the full diamond ladder", () => {
    const report = scoreUserProfile(fixture as ProfileInput, { now });
    const svg = renderUserSignalCard({
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

    expect(svg).toContain("Overall public signal tier is Diamond V, with 90 out of 100 available in the report.");
    expect(svg).toContain("Maintainability: Platinum I, 88 points out of 100");
    expect(svg).toContain("Project Completeness: Diamond V, 90 points out of 100");
    expect(svg).toContain("Usability Surface: Diamond IV, 92 points out of 100");
    expect(svg).toContain("Shipping Evidence: Diamond III, 94 points out of 100");
    expect(svg).toContain("Consistency: Diamond II, 96 points out of 100");
    expect(svg).toContain("Project Stewardship: Diamond I, 98 points out of 100");
  });

  test("keeps the repository activity window off the front card", () => {
    const report = scoreUserProfile(
      {
        ...(fixture as ProfileInput),
        activityWindowDays: 180
      },
      { now }
    );
    const svg = renderUserSignalCard(report);

    expect(svg).not.toContain("last 6 months");
  });

  test("renders a fallback card for failed generation", () => {
    const svg = renderFallbackCard("GitHub API limit reached");

    expect(svg).toContain("width=\"760\" height=\"420\"");
    expect(svg).toContain("GitHub API limit reached");
    expect(svg).toContain("No signal score is shown");
    expect(svg).toContain("Buildmarks signals");
    expect(svg).toContain("Card temporarily unavailable");
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
    const svg = renderUserSignalCard({
      ...report,
      generatedAt: undefined as unknown as string
    });

    expect(svg).toContain("example-builder-with-a-very-long");
    expect(svg).toContain("…");
    expect(svg).toContain("Buildmarks · ");
    expect(svg).not.toContain("undefined");
  });

  test("falls back when generated date is not a valid date string", () => {
    const report = scoreUserProfile(fixture as ProfileInput, { now });
    const svg = renderUserSignalCard({
      ...report,
      generatedAt: "INVALID_DATE_STRING"
    });

    expect(svg).toContain("Buildmarks · ");
    expect(svg).not.toContain("INVALID_DA");
  });

  test("renders a signal gaps card as improvement hints, not a ranking", () => {
    const report = analyzeSignalGaps(fixture as ProfileInput, { now });
    const svg = renderSignalGapsCard(report);

    expect(svg).toContain("What's Missing");
    expect(svg).toContain("Missing public GitHub signals");
    expect(svg).toContain("missing:");
    expect(svg).toContain("gaps found");
    expect(svg).toContain("Buildmarks Gaps · Public Signals");
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

    expect(svg).toContain("Missing owner-supplied signals");
    expect(svg).toContain("Buildmarks Gaps · Public + Private Signals");
    expect(svg).toContain("Private repositories were included by the owner");
    expect(svg).toContain("not independently verifiable");
    expect(svg).not.toContain("Missing public GitHub signals");
    expect(svg).not.toContain("Buildmarks Gaps · Public Signals");
  });

  test("renders a repository signal card for one repository", () => {
    const repository = (fixture as ProfileInput).repositories[0]!;
    const report = scoreRepository(repository, { now });
    const svg = renderRepositorySignalCard(report);

    expect(svg).toContain("example-builder/usable-toolkit");
    expect(svg).toContain("Repository Signal Tier");
    expect(svg).toContain("Buildmarks Repo");
    expect(svg).toContain(visibleVersion);
    expect(svg).not.toContain("Repository GitHub activity");
    expect(svg).toContain("role=\"progressbar\"");
    expect(svg).toContain("Overall repository signal tier is");
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
    expect(svg).toContain("Public + Private Repo Tier");
    expect(svg).toContain("Buildmarks Repo · Public + Private Signals");
    expect(svg).toContain("Owner-supplied private repository signals are included");
    expect(svg).toContain("not independently verifiable from public GitHub");
    expect(svg).not.toContain("<text x=\"704\" y=\"58\" class=\"subtitle right\">Repository Signal Tier</text>");
    expect(svg).not.toContain("<text x=\"36\" y=\"388\" class=\"footer\">Buildmarks Repo</text>");
    expect(svg).not.toContain("secret-client-org");
    expect(svg).not.toContain("Public GitHub data only");
  });
});
