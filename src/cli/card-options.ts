import { isMissingOptionValue } from "./args.js";
import type { RenderCardOptions } from "../renderer/svg.js";

export function parseCardLayoutOptions(args: readonly string[]):
  | { ok: true; args: string[]; layout: NonNullable<RenderCardOptions["layout"]> }
  | { ok: false; message: string } {
  const remaining: string[] = [];
  let layout: NonNullable<RenderCardOptions["layout"]> = "compact";
  let seen = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === undefined) continue;
    if (arg !== "--layout") { remaining.push(arg); continue; }
    if (seen) return { ok: false, message: "Specify --layout only once." };
    seen = true;
    const value = args[index + 1];
    if (isMissingOptionValue(value)) return { ok: false, message: "Missing value for --layout." };
    const normalized = value?.trim();
    if (normalized !== "compact" && normalized !== "detailed") return { ok: false, message: "--layout must be compact or detailed." };
    layout = normalized;
    index += 1;
  }
  return { ok: true, args: remaining, layout };
}
