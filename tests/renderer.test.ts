import { describe, expect, test } from "bun:test";
import fixture from "../fixtures/example-public-profile.json";
import { renderFallbackCard, renderUserSignalCard, scoreUserProfile } from "../src";
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
    expect(svg).not.toContain("<script");
  });

  test("renders a fallback card for failed generation", () => {
    const svg = renderFallbackCard("GitHub API limit reached");

    expect(svg).toContain("<svg");
    expect(svg).toContain("GitHub API limit reached");
    expect(svg).toContain("Public GitHub signals only");
  });
});
