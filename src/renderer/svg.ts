import {
  dimensionLabels,
  signalDimensions,
  type RepoSignal,
  type SignalDimension,
  type UserSignalGapsReport,
  type UserSignalReport
} from "../shared/types";

export interface RenderCardOptions {
  theme?: "auto" | "dark" | "light";
}

const cardWidth = 760;
const cardHeight = 420;
const barMaxWidth = 238;
const rowStartY = 158;
const rowGap = 27;
const chipWidth = 208;
const chipGap = 16;

export function renderUserSignalCard(
  report: UserSignalReport,
  options: RenderCardOptions = {}
): string {
  const theme = options.theme ?? "auto";
  const evidence = report.evidence.slice(0, 3);
  const usernameRaw = coerceString(report.username, "unknown");
  const username = fitText(usernameRaw, 34);
  const signalType = fitText(coerceString(report.signalType, "Public Signal Profile"), 42);
  const generatedDate = formatDate(report.generatedAt);
  const overall = safeScore(report.overall);
  const rows = signalDimensions.map((dimension, index) =>
    renderDimensionRow(dimension, safeScore(report.dimensions[dimension]), rowStartY + index * rowGap)
  );
  const chips = evidence.map((item, index) => renderEvidenceChip(fitText(item.label, 28), index));
  const desc = buildDescription(report, overall);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" class="card card-${theme}" role="img" width="${cardWidth}" height="${cardHeight}" viewBox="0 0 ${cardWidth} ${cardHeight}" aria-labelledby="title desc">
  <title id="title">Buildmarks public GitHub signal card for ${escapeXml(usernameRaw)}</title>
  <desc id="desc">${escapeXml(desc)}</desc>
  ${renderDefs()}
  <style>${renderStyles()}</style>
  <rect width="${cardWidth}" height="${cardHeight}" class="bg" />
  <rect x="18" y="18" width="724" height="384" rx="14" class="panel" filter="url(#cardShadow)" />
  <path d="M24 22 H736" class="top-line" />
  <text x="36" y="56" class="title">Buildmarks</text>
  <text x="36" y="80" class="subtitle">Public GitHub engineering signals, not a ranking</text>
  <text x="36" y="112" class="name">${escapeXml(username)}</text>
  <text x="36" y="136" class="type">${escapeXml(signalType)}</text>
  <text x="604" y="72" class="subtitle">Overall Signal</text>
  <text x="604" y="122" class="overall">${overall}</text>
  <text x="690" y="122" class="overall-unit">/100</text>
  <g aria-label="Dimension scores out of 100">
  ${rows.join("")}
  </g>
  <text x="36" y="338" class="section-label">Evidence</text>
  <g aria-label="Top public evidence traces">
  ${chips.join("")}
  </g>
  <text x="36" y="390" class="footer">Not a ranking · Public data only · Updated ${escapeXml(generatedDate)}</text>
</svg>`;
}

export function renderFallbackCard(message = "Buildmarks report is temporarily unavailable"): string {
  const safeMessage = fitText(message, 76);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" class="card card-auto" role="img" width="${cardWidth}" height="${cardHeight}" viewBox="0 0 ${cardWidth} ${cardHeight}" aria-labelledby="title desc">
  <title id="title">Buildmarks fallback card</title>
  <desc id="desc">${escapeXml(message)} Public GitHub signals only. Not a developer ranking.</desc>
  ${renderDefs()}
  <style>${renderStyles()}</style>
  <rect width="${cardWidth}" height="${cardHeight}" class="bg" />
  <rect x="18" y="18" width="724" height="384" rx="14" class="panel" filter="url(#cardShadow)" />
  <path d="M24 22 H736" class="top-line" />
  <text x="36" y="58" class="title">Buildmarks</text>
  <text x="36" y="82" class="subtitle">Public GitHub engineering signals, not a ranking</text>
  <rect x="36" y="148" width="688" height="116" rx="10" class="fallback-box" />
  <text x="62" y="196" class="fallback-title">Card temporarily unavailable</text>
  <text x="62" y="228" class="fallback-body">${escapeXml(safeMessage)}</text>
  <text x="36" y="390" class="footer">Public GitHub signals only · Not a developer ranking</text>
</svg>`;
}

export function renderSignalGapsCard(report: UserSignalGapsReport, options: RenderCardOptions = {}): string {
  const theme = options.theme ?? "auto";
  const usernameRaw = coerceString(report.username, "unknown");
  const username = fitText(usernameRaw, 34);
  const generatedDate = formatDate(report.generatedAt);
  const visibleGaps = report.gaps.slice(0, 4);
  const rows = visibleGaps.length === 0
    ? [renderEmptyGapRow()]
    : visibleGaps.map((gap, index) => renderGapRow(gap.repository, gap.dimension, gap.missing, 150 + index * 44));
  const desc = visibleGaps.length === 0
    ? `No obvious public signal gaps detected for ${usernameRaw}. Public GitHub data only.`
    : `Signal gaps for ${usernameRaw}: ${visibleGaps.map((gap) => `${gap.repository} missing ${gap.missing.join(", ")}`).join("; ")}.`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" class="card card-${theme}" role="img" width="${cardWidth}" height="${cardHeight}" viewBox="0 0 ${cardWidth} ${cardHeight}" aria-labelledby="title desc">
  <title id="title">Buildmarks signal gaps card for ${escapeXml(usernameRaw)}</title>
  <desc id="desc">${escapeXml(desc)} These are improvement hints, not a ranking.</desc>
  ${renderDefs()}
  <style>${renderStyles()}</style>
  <rect width="${cardWidth}" height="${cardHeight}" class="bg" />
  <rect x="18" y="18" width="724" height="384" rx="14" class="panel" filter="url(#cardShadow)" />
  <path d="M24 22 H736" class="top-line" />
  <text x="36" y="56" class="title">Buildmarks</text>
  <text x="36" y="80" class="subtitle">Signal gaps from public GitHub evidence</text>
  <text x="36" y="112" class="name">${escapeXml(username)}</text>
  <text x="36" y="136" class="type">What's Missing</text>
  <g aria-label="Signal gaps detected from public repository evidence">
  ${rows.join("")}
  </g>
  <text x="36" y="390" class="footer">Improvement hints · Public data only · Updated ${escapeXml(generatedDate)}</text>
</svg>`;
}

export function renderRepositorySignalCard(report: RepoSignal, options: RenderCardOptions = {}): string {
  const theme = options.theme ?? "auto";
  const repoNameRaw = `${report.owner}/${report.name}`;
  const repoName = fitText(repoNameRaw, 38);
  const overall = safeScore(report.overall);
  const rows = signalDimensions.map((dimension, index) =>
    renderDimensionRow(dimension, safeScore(report.dimensions[dimension].score), rowStartY + index * rowGap)
  );
  const chips = report.evidence.slice(0, 3).map((item, index) => renderEvidenceChip(fitText(item.label, 28), index));
  const desc = buildRepositoryDescription(report, overall);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" class="card card-${theme}" role="img" width="${cardWidth}" height="${cardHeight}" viewBox="0 0 ${cardWidth} ${cardHeight}" aria-labelledby="title desc">
  <title id="title">Buildmarks repository signal card for ${escapeXml(repoNameRaw)}</title>
  <desc id="desc">${escapeXml(desc)}</desc>
  ${renderDefs()}
  <style>${renderStyles()}</style>
  <rect width="${cardWidth}" height="${cardHeight}" class="bg" />
  <rect x="18" y="18" width="724" height="384" rx="14" class="panel" filter="url(#cardShadow)" />
  <path d="M24 22 H736" class="top-line" />
  <text x="36" y="56" class="title">Buildmarks</text>
  <text x="36" y="80" class="subtitle">Repository public engineering signals</text>
  <text x="36" y="112" class="name">${escapeXml(repoName)}</text>
  <text x="36" y="136" class="type">Repository Signal Card</text>
  <text x="604" y="72" class="subtitle">Repo Signal</text>
  <text x="604" y="122" class="overall">${overall}</text>
  <text x="690" y="122" class="overall-unit">/100</text>
  <g aria-label="Repository dimension scores out of 100">
  ${rows.join("")}
  </g>
  <text x="36" y="338" class="section-label">Evidence</text>
  <g aria-label="Top public repository evidence traces">
  ${chips.join("")}
  </g>
  <text x="36" y="390" class="footer">Repository signal · Public data only · Not a ranking</text>
</svg>`;
}

function renderDimensionRow(dimension: SignalDimension, score: number, labelY: number): string {
  const width = Math.max(0, Math.min(barMaxWidth, Math.round(score / 100 * barMaxWidth)));
  const label = dimensionLabels[dimension];
  const tone = score >= 75 ? "strong" : score >= 50 ? "middle" : "low";
  const barY = labelY - 11;

  return `
    <g role="img" aria-label="${escapeXml(`${label}: ${score} points out of 100`)}">
      <text x="36" y="${labelY}" class="label">${escapeXml(label)}</text>
      <text x="268" y="${labelY}" class="score">${score}/100</text>
      <rect x="324" y="${barY}" width="${barMaxWidth}" height="10" rx="5" class="track" aria-hidden="true" />
      <rect x="324" y="${barY}" width="${width}" height="10" rx="5" class="bar bar-${tone}" role="progressbar" aria-label="${escapeXml(label)} score" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${score}" />
    </g>`;
}

function renderEvidenceChip(label: string, index: number): string {
  const x = 36 + index * (chipWidth + chipGap);

  return `
    <g role="img" aria-label="${escapeXml(`Evidence: ${label}`)}">
      <rect x="${x}" y="350" width="${chipWidth}" height="28" rx="6" class="chip-bg" />
      <text x="${x + 12}" y="369" class="chip">+ ${escapeXml(label)}</text>
    </g>`;
}

function renderGapRow(repository: string, dimension: SignalDimension, missing: string[], y: number): string {
  const label = fitText(repository, 24);
  const missingText = fitText(missing.join(", "), 46);
  const dimensionText = dimensionLabels[dimension];

  return `
    <g role="img" aria-label="${escapeXml(`${repository}: missing ${missing.join(", ")} for ${dimensionText}`)}">
      <rect x="36" y="${y - 24}" width="688" height="34" rx="8" class="chip-bg" />
      <text x="52" y="${y}" class="label">${escapeXml(label)}</text>
      <text x="250" y="${y}" class="chip">${escapeXml(dimensionText)}</text>
      <text x="416" y="${y}" class="subtitle">missing: ${escapeXml(missingText)}</text>
    </g>`;
}

function renderEmptyGapRow(): string {
  return `
    <g role="img" aria-label="No obvious public signal gaps detected">
      <rect x="36" y="150" width="688" height="74" rx="10" class="chip-bg" />
      <text x="62" y="188" class="fallback-title">No obvious public signal gaps detected</text>
      <text x="62" y="216" class="fallback-body">This only reflects public GitHub repository evidence.</text>
    </g>`;
}

function renderDefs(): string {
  return `<defs>
    <linearGradient id="panelStroke" x1="18" y1="18" x2="742" y2="402" gradientUnits="userSpaceOnUse">
      <stop offset="0%" class="stroke-start" />
      <stop offset="100%" class="stroke-end" />
    </linearGradient>
    <linearGradient id="barStrong" x1="324" y1="0" x2="562" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0%" class="bar-strong-start" />
      <stop offset="100%" class="bar-strong-end" />
    </linearGradient>
    <linearGradient id="barMiddle" x1="324" y1="0" x2="562" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0%" class="bar-middle-start" />
      <stop offset="100%" class="bar-middle-end" />
    </linearGradient>
    <linearGradient id="barLow" x1="324" y1="0" x2="562" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0%" class="bar-low-start" />
      <stop offset="100%" class="bar-low-end" />
    </linearGradient>
    <filter id="cardShadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000000" flood-opacity="0.18" />
    </filter>
  </defs>`;
}

function renderStyles(): string {
  return `
    .card {
      --bg: #f6f8fb;
      --panel: #ffffff;
      --panel-border: #cfdae5;
      --text: #102030;
      --muted: #587083;
      --accent: #0f8b6c;
      --accent-2: #21b28b;
      --warning: #9b6700;
      --chip-bg: #edf7f3;
      --chip-text: #245d4c;
      --track: #dce5ee;
      --low: #d55353;
      --low-2: #f08a62;
      --mid: #c28718;
      --mid-2: #e2b84f;
    }
    .card-dark {
      --bg: #081018;
      --panel: #101923;
      --panel-border: #26394a;
      --text: #eef5fb;
      --muted: #96a9ba;
      --accent: #4ee6a6;
      --accent-2: #8ff2c8;
      --warning: #f2c65f;
      --chip-bg: #172d27;
      --chip-text: #bfeeda;
      --track: #26394a;
      --low: #f87171;
      --low-2: #fb9b75;
      --mid: #f3c969;
      --mid-2: #f7df91;
    }
    @media (prefers-color-scheme: dark) {
      .card-auto {
        --bg: #081018;
        --panel: #101923;
        --panel-border: #26394a;
        --text: #eef5fb;
        --muted: #96a9ba;
        --accent: #4ee6a6;
        --accent-2: #8ff2c8;
        --warning: #f2c65f;
        --chip-bg: #172d27;
        --chip-text: #bfeeda;
        --track: #26394a;
        --low: #f87171;
        --low-2: #fb9b75;
        --mid: #f3c969;
        --mid-2: #f7df91;
      }
    }
    .bg { fill: var(--bg); }
    .panel { fill: var(--panel); stroke: url(#panelStroke); stroke-width: 1; }
    .top-line { stroke: url(#panelStroke); stroke-width: 2; stroke-linecap: round; opacity: 0.75; }
    .title { fill: var(--text); font: 750 24px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .subtitle, .footer, .section-label { fill: var(--muted); font: 500 13px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .name { fill: var(--text); font: 750 20px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .type { fill: var(--accent); font: 700 14px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .overall { fill: var(--warning); font: 800 44px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .overall-unit { fill: var(--muted); font: 700 16px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .label { fill: var(--text); font: 600 14px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .score { fill: var(--muted); font: 700 13px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; text-anchor: end; }
    .track { fill: var(--track); }
    .bar-strong { fill: url(#barStrong); }
    .bar-middle { fill: url(#barMiddle); }
    .bar-low { fill: url(#barLow); }
    .chip-bg { fill: var(--chip-bg); stroke: var(--panel-border); stroke-width: 1; }
    .chip { fill: var(--chip-text); font: 600 12px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .fallback-box { fill: var(--chip-bg); stroke: var(--panel-border); stroke-width: 1; }
    .fallback-title { fill: var(--text); font: 750 22px ui-sans-serif, system-ui, sans-serif; }
    .fallback-body { fill: var(--muted); font: 500 15px ui-sans-serif, system-ui, sans-serif; }
    .stroke-start { stop-color: var(--accent); stop-opacity: 0.72; }
    .stroke-end { stop-color: var(--warning); stop-opacity: 0.46; }
    .bar-strong-start { stop-color: var(--accent); }
    .bar-strong-end { stop-color: var(--accent-2); }
    .bar-middle-start { stop-color: var(--mid); }
    .bar-middle-end { stop-color: var(--mid-2); }
    .bar-low-start { stop-color: var(--low); }
    .bar-low-end { stop-color: var(--low-2); }
  `;
}

function buildDescription(report: UserSignalReport, overall: number): string {
  const scores = signalDimensions
    .map((dimension) => `${dimensionLabels[dimension]} ${safeScore(report.dimensions[dimension])} out of 100`)
    .join(", ");

  return `Overall signal ${overall} out of 100. ${scores}. Public GitHub data only; not a developer ranking.`;
}

function buildRepositoryDescription(report: RepoSignal, overall: number): string {
  const scores = signalDimensions
    .map((dimension) => `${dimensionLabels[dimension]} ${safeScore(report.dimensions[dimension].score)} out of 100`)
    .join(", ");

  return `Repository signal for ${report.owner}/${report.name}: ${overall} out of 100. ${scores}. Public GitHub data only; not a developer ranking.`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function coerceString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() !== "" ? value : fallback;
}

function fitText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

function formatDate(value: unknown): string {
  if (typeof value === "string" && value.length >= 10) {
    return value.slice(0, 10);
  }

  return new Date().toISOString().slice(0, 10);
}

function safeScore(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : 0;
}
