import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Remains correct in Node-target bundles and when a renderer is imported as a module. */
export function isMainModule(moduleUrl: string): boolean {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}
