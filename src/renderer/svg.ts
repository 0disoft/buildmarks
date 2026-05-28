import { dimensionLabels, signalDimensions, type UserSignalReport } from "../shared/types";

export interface RenderCardOptions {
  theme?: "dark" | "light";
}

const themes = {
  dark: {
    background: "#0b1016",
    panel: "#111923",
    border: "#263445",
    text: "#e8f0f7",
    muted: "#93a4b5",
    accent: "#4ee6a6",
    warning: "#f3c969"
  },
  light: {
    background: "#f8fafc",
    panel: "#ffffff",
    border: "#d9e2ec",
    text: "#102030",
    muted: "#52677a",
    accent: "#047857",
    warning: "#a16207"
  }
};

export function renderUserSignalCard(
  report: UserSignalReport,
  options: RenderCardOptions = {}
): string {
  const theme = themes[options.theme ?? "dark"];
  const evidence = report.evidence.slice(0, 3);
  const rows = signalDimensions.map((dimension, index) => {
    const y = 128 + index * 30;
    const score = report.dimensions[dimension];
    const width = Math.max(0, Math.min(240, Math.round(score * 2.4)));

    return `
      <text x="36" y="${y}" class="label">${escapeXml(dimensionLabels[dimension])}</text>
      <text x="260" y="${y}" class="score">${score}</text>
      <rect x="315" y="${y - 14}" width="240" height="10" rx="5" class="track" />
      <rect x="315" y="${y - 14}" width="${width}" height="10" rx="5" class="bar" />`;
  });

  const chips = evidence.map((item, index) => {
    const y = 328 + index * 24;
    return `<text x="36" y="${y}" class="chip">+ ${escapeXml(item.label)}</text>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" role="img" width="760" height="420" viewBox="0 0 760 420" aria-labelledby="title desc">
  <title id="title">Buildmarks public GitHub signal card for ${escapeXml(report.username)}</title>
  <desc id="desc">A transparent engineering signal card based only on public GitHub repository evidence.</desc>
  <style>
    .bg { fill: ${theme.background}; }
    .panel { fill: ${theme.panel}; stroke: ${theme.border}; stroke-width: 1; }
    .title { fill: ${theme.text}; font: 700 24px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .subtitle, .footer { fill: ${theme.muted}; font: 500 13px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .name { fill: ${theme.text}; font: 700 20px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .type { fill: ${theme.accent}; font: 700 14px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .overall { fill: ${theme.warning}; font: 800 44px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .label { fill: ${theme.text}; font: 600 14px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .score { fill: ${theme.muted}; font: 700 14px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; text-anchor: end; }
    .track { fill: ${theme.border}; }
    .bar { fill: ${theme.accent}; }
    .chip { fill: ${theme.muted}; font: 500 13px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  </style>
  <rect width="760" height="420" class="bg" />
  <rect x="18" y="18" width="724" height="384" rx="12" class="panel" />
  <text x="36" y="58" class="title">Buildmarks</text>
  <text x="36" y="82" class="subtitle">Public GitHub engineering signals, not a ranking</text>
  <text x="36" y="112" class="name">${escapeXml(report.username)}</text>
  <text x="36" y="136" class="type">${escapeXml(report.signalType)}</text>
  <text x="610" y="76" class="subtitle">Overall Signal</text>
  <text x="610" y="122" class="overall">${report.overall}</text>
  ${rows.join("")}
  ${chips.join("")}
  <text x="36" y="386" class="footer">Not a ranking · Public data only · Updated ${escapeXml(report.generatedAt.slice(0, 10))}</text>
</svg>`;
}

export function renderFallbackCard(message = "Buildmarks report is temporarily unavailable"): string {
  const theme = themes.dark;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" role="img" width="760" height="180" viewBox="0 0 760 180" aria-labelledby="title desc">
  <title id="title">Buildmarks fallback card</title>
  <desc id="desc">${escapeXml(message)}</desc>
  <style>
    .bg { fill: ${theme.background}; }
    .panel { fill: ${theme.panel}; stroke: ${theme.border}; stroke-width: 1; }
    .title { fill: ${theme.text}; font: 700 24px ui-sans-serif, system-ui, sans-serif; }
    .body { fill: ${theme.muted}; font: 500 15px ui-sans-serif, system-ui, sans-serif; }
  </style>
  <rect width="760" height="180" class="bg" />
  <rect x="18" y="18" width="724" height="144" rx="12" class="panel" />
  <text x="36" y="68" class="title">Buildmarks</text>
  <text x="36" y="104" class="body">${escapeXml(message)}</text>
  <text x="36" y="132" class="body">Public GitHub signals only. Not a developer ranking.</text>
</svg>`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
