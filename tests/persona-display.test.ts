import { describe, expect, test } from "bun:test";
import fixture from "../fixtures/example-public-profile.json";
import { createStaticReport, renderStaticReportHtml, renderUserSignalCard, scoreUserProfile,
  signalDimensions, type ProfileInput, type SignalDimension } from "../src";
import { personaDefinitions } from "../src/shared/persona-catalog";

const now = new Date(fixture.generatedAt);
const base = scoreUserProfile(fixture as ProfileInput, { now });
const scores = (highest: SignalDimension, lowest: SignalDimension, value: number) =>
  Object.fromEntries(signalDimensions.map(key => [key, key === highest ? 96 : key === lowest ? value : 85])) as typeof base.dimensions;

describe("persona display", () => {
  test("renders all 30 personas and both descriptions in both card layouts", () => {
    for (const definition of personaDefinitions) for (const lowest of [42, 80]) {
      const dimensions = scores(definition.highest, definition.lowest, lowest);
      for (const layout of ["compact", "detailed"] as const) {
        const report = { ...base, dimensions };
        const before = JSON.stringify(report);
        const svg = renderUserSignalCard(report, { layout });
        expect(svg).toContain(`aria-label="${definition.title.replaceAll("'", "&apos;")}"`);
        expect(svg).toContain('class="tagline"');
        expect(svg).toContain(lowest === 80 ? definition.positiveDescription.replaceAll("'", "&apos;")
          : definition.description.replaceAll("'", "&apos;"));
        expect(svg).not.toMatch(/Highest:|Lowest:|Strongest:|Weakest:/i);
        expect(JSON.stringify(report)).toBe(before);
      }
    }
  });

  test("shows a balanced title and keeps unavailable states free of invented personas", () => {
    const dimensions = Object.fromEntries(signalDimensions.map(key => [key, 40])) as typeof base.dimensions;
    expect(renderUserSignalCard({ ...base, dimensions })).toContain('aria-label="Balanced Builder"');
    const svg = renderUserSignalCard({ ...base, dimensions, evidenceStatus: "insufficient" });
    expect(svg).not.toContain("Balanced Builder");
    expect(svg).toContain("No score is shown");
  });

  test("shares the selected persona across report JSON and HTML without pair labels", () => {
    const report = createStaticReport(fixture as ProfileInput, { now });
    expect(report.profile.persona).toBeDefined();
    const html = renderStaticReportHtml(report);
    expect(html).toContain(report.profile.persona!.title);
    expect(html).toContain(report.profile.persona!.description.replaceAll("'", "&#39;"));
    expect(html).not.toMatch(/Highest:|Lowest:|Strongest:|Weakest:/i);
    expect(Object.keys(report.profile.persona!).sort()).toEqual(["description", "id", "title"]);
    report.profile.persona!.title = '<script>alert("bad")</script>';
    expect(renderStaticReportHtml(report)).not.toContain('<script>');
  });
});
