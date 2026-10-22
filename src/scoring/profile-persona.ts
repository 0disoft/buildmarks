import { signalDimensions, type ProfilePersona, type ScoreAssessment,
  type SignalDimension, type UserSignalReport } from "../shared/types.js";
import { balancedPersona, personaDefinitions } from "../shared/persona-catalog.js";

export const personaPolicy = Object.freeze({ balancedSpread: 10, positiveDescriptionMinimum: 60 });

export interface PersonaClassificationOptions {
  unavailableDimensions?: readonly SignalDimension[];
  notApplicableDimensions?: readonly SignalDimension[];
  dimensionAssessments?: Partial<Record<SignalDimension, ScoreAssessment>>;
}

/** Relative score shape selects display copy, never points or a developer rank. */
export function classifyProfilePersona(
  dimensions: Partial<Record<SignalDimension, number>>,
  options: PersonaClassificationOptions = {}
): ProfilePersona | undefined {
  const excluded = new Set([...(options.unavailableDimensions ?? []), ...(options.notApplicableDimensions ?? [])]);
  const available = signalDimensions.filter(dimension => {
    const score = dimensions[dimension];
    const assessment = options.dimensionAssessments?.[dimension];
    return !excluded.has(dimension) && typeof score === "number" && Number.isFinite(score)
      && score >= 0 && score <= 100 && (assessment === undefined
        || assessment.applicability === "applicable" && assessment.score !== null);
  });
  if (available.length < 2) return undefined;
  // Strict comparisons retain the documented dimension order for tied scores.
  let highest = available[0]!, lowest = available[0]!;
  for (const dimension of available) {
    if (dimensions[dimension]! > dimensions[highest]!) highest = dimension;
    if (dimensions[dimension]! < dimensions[lowest]!) lowest = dimension;
  }
  if (dimensions[highest]! - dimensions[lowest]! < personaPolicy.balancedSpread) return { ...balancedPersona };
  const definition = personaDefinitions.find(persona => persona.highest === highest && persona.lowest === lowest)!;
  return {
    id: definition.id,
    title: definition.title,
    description: dimensions[lowest]! >= personaPolicy.positiveDescriptionMinimum
      ? definition.positiveDescription : definition.description
  };
}

/** Recompute from scores so edited or older reports cannot carry stale display copy. */
export function resolveProfilePersona(report: UserSignalReport): ProfilePersona | undefined {
  if (report.evidenceStatus === "insufficient" || report.resultStatus === "unavailable") return undefined;
  return classifyProfilePersona(report.dimensions, report);
}
