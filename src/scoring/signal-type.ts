import type { SignalDimension, SignalType } from "../shared/types";

export function classifySignalType(dimensions: Record<SignalDimension, number>): SignalType {
  // Priority is intentional: each profile gets the strongest explanatory label, not every matching label.
  if (dimensions.maintainability >= 75 && dimensions.stewardship >= 70 && dimensions.shipping >= 70) {
    return "Maintainer-Builder";
  }

  if (dimensions.usability >= 75 && dimensions.shipping >= 65) {
    return "Productized Builder";
  }

  if (dimensions.completeness >= 75 && dimensions.shipping >= 65) {
    return "Builder";
  }

  if (dimensions.consistency >= 75 && dimensions.shipping >= 65) {
    return "Steady Shipper";
  }

  if (dimensions.usability >= 75) {
    return "Well-Documented Project";
  }

  return "General Signal Profile";
}
