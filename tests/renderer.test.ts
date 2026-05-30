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
    expect(svg).toContain("Public GitHub engineering signals");
    expect(svg).toContain("example &lt;builder&gt;");
    expect(svg).toContain("Not a ranking");
    expect(svg).toContain("@media (prefers-color-scheme: dark)");
    expect(svg).toContain("role=\"progressbar\"");
    expect(svg).toContain("Project Completeness:");
    expect(svg).toContain("/100");
    expect(svg).toContain("class=\"chip-bg\"");
    expect(svg).not.toContain("<script");
  });

  test("renders a safe evidence report link when provided", () => {
    const report = scoreUserProfile(fixture as ProfileInput, { now });
    const svg = renderUserSignalCard(report, {
      reportHref: "./assets/buildmarks-report/buildmarks-report.html"
    });

    expect(svg).toContain("<a href=\"./assets/buildmarks-report/buildmarks-report.html\"");
    expect(svg).toContain("View evidence");
    expect(svg).toContain("Open the inspectable Buildmarks evidence report");
  });

  test("drops executable evidence report links", () => {
    const report = scoreUserProfile(fixture as ProfileInput, { now });
    const svg = renderUserSignalCard(report, {
      reportHref: "javascript:alert(1)"
    });

    expect(svg).not.toContain("<a href=");
    expect(svg).not.toContain("javascript:");
    expect(svg).not.toContain("View evidence");
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

    expect(svg).toContain("Owner-supplied GitHub signals, not a ranking");
    expect(svg).toContain("Public + Private Signals");
    expect(svg).toContain("Private repositories included by owner");
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
    expect(svg).toContain("Updated ");
    expect(svg).not.toContain("undefined");
  });

  test("renders a signal gaps card as improvement hints, not a ranking", () => {
    const report = analyzeSignalGaps(fixture as ProfileInput, { now });
    const svg = renderSignalGapsCard(report);

    expect(svg).toContain("What's Missing");
    expect(svg).toContain("Signal gaps from public GitHub evidence");
    expect(svg).toContain("missing:");
    expect(svg).toContain("Improvement hints");
    expect(svg).toContain("not a ranking");
  });

  test("renders a repository signal card for one repository", () => {
    const repository = (fixture as ProfileInput).repositories[0]!;
    const report = scoreRepository(repository, { now });
    const svg = renderRepositorySignalCard(report);

    expect(svg).toContain("Repository Signal Card");
    expect(svg).toContain("example-builder/usable-toolkit");
    expect(svg).toContain("Repository public engineering signals");
    expect(svg).toContain("Repo Signal");
    expect(svg).toContain("Repository signal · Public data only · Not a ranking");
    expect(svg).toContain("role=\"progressbar\"");
  });
});
