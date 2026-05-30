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
    expect(svg).toContain("Public GitHub signals");
    expect(svg).toContain("example &lt;builder&gt;");
    expect(svg).toContain("Buildmarks Profile · Public Signals");
    expect(svg).toContain("Signals Found");
    expect(svg).toContain("repos checked");
    expect(svg).not.toContain("<text x=\"36\" y=\"390\" class=\"footer\">Not a ranking");
    expect(svg).toContain("@media (prefers-color-scheme: dark)");
    expect(svg).toContain("role=\"progressbar\"");
    expect(svg).toContain("Project Completeness:");
    expect(svg).toContain("/100");
    expect(svg).toContain("class=\"chip-bg\"");
    expect(svg).toContain("Found Signals");
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

    expect(svg).toContain("Owner-supplied GitHub signals");
    expect(svg).toContain("Public + Private Signals");
    expect(svg).toContain("Buildmarks Profile · Private Included");
    expect(svg).toContain("Signals Found");
    expect(svg).toContain("Public Adoption");
    expect(svg).toContain(">N/A</text>");
    expect(svg).toContain("Public Adoption: not available for this card");
    expect(svg).toContain("not independently verifiable from public GitHub");
    expect(svg).not.toContain("Public data only · Updated");
  });

  test("renders a fallback card for failed generation", () => {
    const svg = renderFallbackCard("GitHub API limit reached");

    expect(svg).toContain("width=\"760\" height=\"420\"");
    expect(svg).toContain("GitHub API limit reached");
    expect(svg).toContain("Public GitHub signals only");
    expect(svg).toContain("Card temporarily unavailable");
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
    expect(svg).toContain("Buildmarks Profile · Public Signals");
    expect(svg).not.toContain("undefined");
  });

  test("renders a signal gaps card as improvement hints, not a ranking", () => {
    const report = analyzeSignalGaps(fixture as ProfileInput, { now });
    const svg = renderSignalGapsCard(report);

    expect(svg).toContain("What's Missing");
    expect(svg).toContain("Missing public GitHub signals");
    expect(svg).toContain("missing:");
    expect(svg).toContain("Buildmarks Gaps · Public Signals");
    expect(svg).toContain("not a ranking");
  });

  test("renders a repository signal card for one repository", () => {
    const repository = (fixture as ProfileInput).repositories[0]!;
    const report = scoreRepository(repository, { now });
    const svg = renderRepositorySignalCard(report);

    expect(svg).toContain("Repository Signal Card");
    expect(svg).toContain("example-builder/usable-toolkit");
    expect(svg).toContain("Repository GitHub signals");
    expect(svg).toContain("Signals Found");
    expect(svg).toContain("Buildmarks Repo · Public Signals");
    expect(svg).toContain("role=\"progressbar\"");
  });
});
