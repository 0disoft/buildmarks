import type { SignalDimension, SignalType } from "../shared/types";

export function classifySignalType(dimensions: Record<SignalDimension, number>): SignalType {
  // Priority is intentional: each profile gets the strongest explanatory label, not every matching label.
  if (dimensions.maintainability >= 75 && dimensions.shipping >= 70) {
    return "Maintainer-Builder";
  }

  if (dimensions.collaboration >= 75) {
    return "Collaborator";
  }

  if (dimensions.completeness >= 75 && dimensions.shipping >= 65) {
    return "Builder";
  }

  if (dimensions.externalValidation >= 75) {
    return "High-Adoption Project";
  }

  if (dimensions.completeness >= 65 && dimensions.collaboration < 40) {
    return "Independent Builder";
  }

  return "General Signal Profile";
}
