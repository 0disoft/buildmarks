/** Wrap display copy at word boundaries; full text remains in accessible descriptions. */
export function wrapCardText(text: string, columns: number, maximumLines: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.trim().split(/\s+/)) {
    if (line.length > 0 && line.length + word.length + 1 > columns) {
      lines.push(line);
      line = word;
    } else line += `${line ? " " : ""}${word}`;
  }
  if (line) lines.push(line);
  if (lines.length <= maximumLines) return lines;
  return [...lines.slice(0, maximumLines - 1), `${lines[maximumLines - 1]!.replace(/[.,;:]$/, "")}…`];
}

export function escapeCardCopy(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}
