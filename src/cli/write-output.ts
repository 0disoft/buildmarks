import { writeFile } from "node:fs/promises";

export async function tryWriteTextFile(path: string, content: string): Promise<string | undefined> {
  try {
    await writeFile(path, content, "utf8");
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : "unknown file write failure";
  }
}

export function appendWriteFailure(message: string, label: string, writeError: string | undefined): string {
  return writeError === undefined ? message : `${message} ${label} write failed: ${writeError}`;
}
