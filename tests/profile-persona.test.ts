import { describe, expect, test } from "bun:test";
import fixture from "../fixtures/example-public-profile.json";
import { classifyProfilePersona, scoreUserProfile, signalDimensions, type ProfileInput,
  type SignalDimension, type ScoreAssessment } from "../src";
import { personaDefinitions } from "../src/shared/persona-catalog";
import { resolveProfilePersona } from "../src/scoring/profile-persona";

const scores = (value = 70) => Object.fromEntries(signalDimensions.map(dimension => [dimension, value])) as Record<SignalDimension, number>;

describe("profile personas", () => {
  test("covers each of the 30 ordered pairs exactly once", () => {
    expect(personaDefinitions).toHaveLength(30);
    expect(new Set(personaDefinitions.map(persona => persona.id)).size).toBe(30);
    for (const highest of signalDimensions) for (const lowest of signalDimensions) {
      if (highest === lowest) continue;
      const matching = personaDefinitions.filter(persona => persona.highest === highest && persona.lowest === lowest);
      expect(matching).toHaveLength(1);
      const persona = classifyProfilePersona({ ...scores(), [highest]: 92, [lowest]: 42 })!;
      expect(persona.id).toBe(matching[0]!.id);
      expect(persona.description).toBe(matching[0]!.description);
      expect(Object.keys(persona).sort()).toEqual(["description", "id", "title"]);
      expect(matching[0]!.lines.join(" ")).toBe(persona.title);
    }
  });

  test("uses a positive description when the lowest score reaches 60", () => {
    const definition = personaDefinitions.find(persona => persona.id === "workshop-artisan")!;
    for (const [lowest, positive] of [[59, false], [60, true], [80, true]] as const) {
      const persona = classifyProfilePersona({ ...scores(85), maintainability: 96, shipping: lowest })!;
      expect(persona.title).toBe("Workshop Artisan");
      expect(persona.description).toBe(positive ? definition.positiveDescription : definition.description);
    }
  });

  test("uses a balanced persona below a ten-point spread at any score level", () => {
    for (const value of [0, 30, 80, 100]) expect(classifyProfilePersona(scores(value))!.id).toBe("balanced-builder");
    expect(classifyProfilePersona({ ...scores(80), maintainability: 89.999 })!.id).toBe("balanced-builder");
    expect(classifyProfilePersona({ ...scores(80), maintainability: 90 })!.id).not.toBe("balanced-builder");
  });

  test("excludes missing, invalid and inapplicable scores instead of finding a false weak area", () => {
    const dimensions = { ...scores(80), maintainability: 96, shipping: 0, stewardship: 70 };
    const assessment: ScoreAssessment = { score: null, confidence: null,
      coverage: { observed: 0, expected: 1, ratio: 0 }, applicability: "unavailable" };
    for (const options of [
      { unavailableDimensions: ["shipping" as const] },
      { notApplicableDimensions: ["shipping" as const] },
      { dimensionAssessments: { shipping: assessment } }
    ]) expect(classifyProfilePersona(dimensions, options)!.id).toBe("toolbox-keeper");
    for (const shipping of [NaN, Infinity, -1, 101]) {
      expect(classifyProfilePersona({ ...dimensions, shipping })!.id).toBe("toolbox-keeper");
    }
    expect(classifyProfilePersona({ maintainability: 90 })).toBeUndefined();
    expect(classifyProfilePersona({ maintainability: 90, shipping: 0 })!.id).toBe("workshop-artisan");
  });

  test("resolves ties in dimension order regardless of object insertion order", () => {
    const dimensions = { ...scores(), maintainability: 90, completeness: 90, shipping: 30, stewardship: 30 };
    expect(classifyProfilePersona(dimensions)!.id).toBe("workshop-artisan");
    expect(classifyProfilePersona(Object.fromEntries(Object.entries(dimensions).reverse()))).toEqual(classifyProfilePersona(dimensions));
  });

  test("keeps output copy detached and recomputes edited scores without trusting stored persona text", () => {
    const first = classifyProfilePersona(scores())!;
    first.title = "changed";
    expect(classifyProfilePersona(scores())!.title).toBe("Balanced Builder");
    const report = scoreUserProfile(fixture as ProfileInput, { now: new Date(fixture.generatedAt) });
    expect(report.persona).toBeDefined();
    expect(resolveProfilePersona({ ...report, dimensions: scores(), persona: { id: "bad", title: "<script>", description: "bad" } })!.id).toBe("balanced-builder");
    expect(resolveProfilePersona({ ...report, evidenceStatus: "insufficient" })).toBeUndefined();
    expect(scoreUserProfile({ username: "empty", repositories: [] }).persona).toBeUndefined();
  });
});
