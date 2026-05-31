import { describe, expect, test } from "bun:test";
import fixture from "../fixtures/example-public-profile.json";
import {
  analyzeSignalGaps,
  renderFallbackCard,
  renderRepositorySignalCard,
  renderSignalGapsCard,
  renderUserSignalCard,
  scoreRepository,
  scoreUserProfile
} from "../src";
import type { ProfileInput } from "../src";

const now = new Date("2026-05-28T00:00:00.000Z");
const visibleVersion = ">v0.1.10</text>";
const spacedBrandVersion = '<text x="190" y="54" class="brand-version">v0.1.10</text>';

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
    expect(svg).toContain("Project Care");
    expect(svg).toContain(visibleVersion);
    expect(svg).toContain("overall overall-");
    expect(svg).not.toContain("Public GitHub activity</text>");
    expect(svg).not.toContain("Owner-supplied GitHub activity");
    expect(svg).not.toContain("repos checked");
    expect(svg).not.toContain(">24 marks</text>");
    expect(svg).not.toContain("50-74 band");
    expect(svg).not.toContain("Score color legend");
    expect(svg).not.toContain("<text x=\"36\" y=\"390\" class=\"footer\">Not a ranking");
    expect(svg).toContain("@media (prefers-color-scheme: dark)");
    expect(svg).toContain("role=\"progressbar\"");
    expect(svg).toContain("Project Completeness:");
    expect(svg).toContain("/100");
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

  test("discloses owner-supplied private signals when included", () => {
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
        }
      },
      { now }
    );
    const svg = renderUserSignalCard(report);

    expect(svg).not.toContain("Owner-supplied GitHub activity");
    expect(svg).not.toContain("<text x=\"36\" y=\"136\" class=\"type\">Public + Private");
    expect(svg).toContain("Buildmarks · 2026-05-28");
    expect(svg).toContain("Project Care");
    expect(svg).toContain("Public Adoption");
    expect(svg).toContain(">N/A</text>");
    expect(svg).toContain("Public Adoption: not available for this card");
    expect(svg).toContain("not independently verifiable from public GitHub");
    expect(svg).not.toContain("Public data only · Updated");
  });

  test("contextualizes low collaboration for independent builders", () => {
    const report = scoreUserProfile(fixture as ProfileInput, { now });
    const svg = renderUserSignalCard({
      ...report,
      signalType: "Independent Builder",
      dimensions: {
        ...report.dimensions,
        collaboration: 7
      }
    });

    expect(svg).toContain("Collaboration Context");
    expect(svg).toContain(">solo</text>");
    expect(svg).toContain("Collaboration Context: solo");
    expect(svg).not.toContain("Collaboration: 7 points out of 100");
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
    expect(svg).toContain("Public GitHub signals only");
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

  test("renders a repository signal card for one repository", () => {
    const repository = (fixture as ProfileInput).repositories[0]!;
    const report = scoreRepository(repository, { now });
    const svg = renderRepositorySignalCard(report);

    expect(svg).toContain("example-builder/usable-toolkit");
    expect(svg).toContain("Project Care");
    expect(svg).toContain("Buildmarks Repo");
    expect(svg).toContain(visibleVersion);
    expect(svg).not.toContain("Repository GitHub activity");
    expect(svg).toContain("role=\"progressbar\"");
  });
});
