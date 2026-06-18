export function isMissingOptionValue(value: string | undefined): boolean {
  return value === undefined || value.trim() === "" || isOptionLikeArgument(value);
}

export function isOptionLikeArgument(value: string): boolean {
  return value.trim().startsWith("--");
}

export function unknownOptionMessage(value: string): string {
  return `Unknown option: ${value.trim()}`;
}
