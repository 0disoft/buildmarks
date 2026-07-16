import {
  dimensionLabels,
  privateLocalSignalVisibility,
  signalTypeDisplayLabels,
  signalDimensions,
  type RepoSignal,
  type SignalDimension,
  type UserSignalGapsReport,
  type UserSignalReport
} from "../shared/types.js";
import { buildmarksVersion } from "../shared/version.js";

export interface RenderCardOptions {
  theme?: "auto" | "dark" | "light";
}

const cardWidth = 760;
const cardHeight = 420;
const barX = 336;
const barMaxWidth = 372;
const barHeight = 6;
const rowStartY = 128;
const rowGap = 29;
const chipWidth = 156;
const chipGap = 12;
const scoreX = 306;
const rightEdgeX = 704;
const highlightLabelY = 318;
const chipY = 330;
const footerY = 388;
const brandVersion = `v${buildmarksVersion}`;
const tierBands = [
  { minimum: 98, label: "Diamond I" },
  { minimum: 96, label: "Diamond II" },
  { minimum: 94, label: "Diamond III" },
  { minimum: 92, label: "Diamond IV" },
  { minimum: 90, label: "Diamond V" },
  { minimum: 88, label: "Platinum I" },
  { minimum: 85, label: "Platinum II" },
  { minimum: 80, label: "Platinum III" },
  { minimum: 75, label: "Platinum IV" },
  { minimum: 70, label: "Platinum V" },
  { minimum: 60, label: "Gold I" },
  { minimum: 50, label: "Gold II" },
  { minimum: 40, label: "Gold III" },
  { minimum: 25, label: "Gold IV" },
  { minimum: 0, label: "Gold V" }
] as const;

export function renderUserSignalCard(
  report: UserSignalReport,
  options: RenderCardOptions = {}
): string {
  if (report.evidenceStatus === "insufficient") {
    return renderFallbackCard("Not enough complete repository data to calculate a reliable score");
  }

  const theme = normalizeTheme(options.theme);
  const highlights = [...new Set(
    (report.evidenceLedger ?? report.evidence).map((item) => evidenceToHighlight(item.label))
  )].slice(0, 4);
  const usernameRaw = coerceString(report.username, "unknown");
  const username = fitText(usernameRaw, 34);
  const generatedDate = formatDate(report.generatedAt);
  const overall = safeScore(report.overall);
  const overallTone = scoreTone(overall);
  const overallLabel = report.resultStatus === "provisional" ? "Provisional" : scoreTier(overall);
  const includesPrivateSignals = report.signalVisibility?.privateRepositoriesIncluded === true;
  const footerLabel = includesPrivateSignals
    ? `Buildmarks ${brandVersion} · ${privateLocalSignalVisibility.cardLabel} · ${generatedDate}`
    : `Buildmarks ${brandVersion} · Public GitHub · ${generatedDate}`;
  const footerAssessment = formatAssessmentSummary(report.confidence, report.coverage?.ratio);
  const context = buildProfileCardContext(report);
  const visibleDimensions = signalDimensions.filter((dimension) => !context.contextualDimensions.has(dimension));
  const rows = visibleDimensions.map((dimension, index) =>
    renderDimensionRow(
      dimension,
      safeScore(report.dimensions[dimension]),
      rowStartY + index * rowGap
    )
  );
  const chips = highlights.map((label, index) => renderEvidenceChip(label, index));
  const desc = buildDescription(report, overall);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" class="card card-${theme}" role="img" width="${cardWidth}" height="${cardHeight}" viewBox="0 0 ${cardWidth} ${cardHeight}" aria-labelledby="title desc">
  <title id="title">Buildmarks project card for ${escapeXml(usernameRaw)}</title>
  <desc id="desc">${escapeXml(desc)}</desc>
  ${renderDefs()}
  <style>${renderStyles()}</style>
  <rect width="${cardWidth}" height="${cardHeight}" class="bg" />
  <rect x="18" y="18" width="724" height="384" rx="14" class="panel" filter="url(#cardShadow)" />
  <path d="M24 22 H736" class="top-line" />
  <text x="36" y="62" class="name">${escapeXml(username)}</text>
  <text x="${rightEdgeX}" y="62" class="overall overall-${overallTone}">${escapeXml(overallLabel)}</text>
  <g aria-label="Project areas with scores out of 100">
${rows.join("")}
  </g>
  <text x="36" y="${highlightLabelY}" class="section-label">Highlights</text>
  <g aria-label="Buildmarks highlights">
${chips.join("")}
  </g>
  <text x="36" y="${footerY}" class="footer">${escapeXml(footerLabel)}</text>
  <text x="${rightEdgeX}" y="${footerY}" class="footer right">${escapeXml(footerAssessment)}</text>
</svg>`;
}

export function renderFallbackCard(message = "Buildmarks couldn't generate this report right now"): string {
  const safeMessage = fitText(message, 76);
  const descriptionMessage = finishSentence(message);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" class="card card-auto" role="img" width="${cardWidth}" height="${cardHeight}" viewBox="0 0 ${cardWidth} ${cardHeight}" aria-labelledby="title desc">
  <title id="title">Buildmarks fallback card</title>
  <desc id="desc">${escapeXml(descriptionMessage)} No score is shown. Buildmarks is not a developer ranking.</desc>
  ${renderDefs()}
  <style>${renderStyles()}</style>
  <rect width="${cardWidth}" height="${cardHeight}" class="bg" />
  <rect x="18" y="18" width="724" height="384" rx="14" class="panel" filter="url(#cardShadow)" />
  <path d="M24 22 H736" class="top-line" />
  <text x="36" y="62" class="subtitle">GitHub project snapshot</text>
  <rect x="36" y="148" width="688" height="116" rx="10" class="fallback-box" />
  <text x="62" y="196" class="fallback-title">Card unavailable</text>
  <text x="62" y="228" class="fallback-body">${escapeXml(safeMessage)}</text>
  <text x="36" y="${footerY}" class="footer">Buildmarks ${escapeXml(brandVersion)}</text>
</svg>`;
}

export function renderSignalGapsCard(report: UserSignalGapsReport, options: RenderCardOptions = {}): string {
  const theme = normalizeTheme(options.theme);
  const includesPrivateSignals = report.signalVisibility?.privateRepositoriesIncluded === true;
  const usernameRaw = coerceString(report.username, "unknown");
  const username = fitText(usernameRaw, 34);
  const generatedDate = formatDate(report.generatedAt);
  const visibleGaps = report.gaps.slice(0, 4);
  const gapCount = report.gaps.length;
  const suggestionLabel = gapCount === 1 ? "suggestion" : "suggestions";
  const rows = visibleGaps.length === 0
    ? [renderEmptyGapRow(includesPrivateSignals)]
    : visibleGaps.map((gap, index) => renderGapRow(gap.repository, gap.dimension, gap.missing, 156 + index * 54));
  const scopeLabel = includesPrivateSignals ? "Included projects" : "Public GitHub projects";
  const footerScope = includesPrivateSignals ? privateLocalSignalVisibility.cardLabel : "Public GitHub";
  const desc = visibleGaps.length === 0
    ? includesPrivateSignals
      ? `No project suggestions are available for ${usernameRaw}. Owner-supplied private repositories cannot be checked independently.`
      : `No project suggestions are available for ${usernameRaw}. Based on public GitHub repositories only.`
    : includesPrivateSignals
      ? `Suggested project improvements for ${usernameRaw}: ${visibleGaps.map((gap) => `${gap.repository} could add ${gap.missing.join(", ")}`).join("; ")}. Owner-supplied private repositories cannot be checked independently.`
      : `Suggested project improvements for ${usernameRaw}: ${visibleGaps.map((gap) => `${gap.repository} could add ${gap.missing.join(", ")}`).join("; ")}. Based on public GitHub repositories only.`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" class="card card-${theme}" role="img" width="${cardWidth}" height="${cardHeight}" viewBox="0 0 ${cardWidth} ${cardHeight}" aria-labelledby="title desc">
  <title id="title">Buildmarks project suggestions for ${escapeXml(usernameRaw)}</title>
  <desc id="desc">${escapeXml(desc)} These are project suggestions, not a ranking.</desc>
  ${renderDefs()}
  <style>${renderStyles()}</style>
  <rect width="${cardWidth}" height="${cardHeight}" class="bg" />
  <rect x="18" y="18" width="724" height="384" rx="14" class="panel" filter="url(#cardShadow)" />
  <path d="M24 22 H736" class="top-line" />
  <text x="36" y="62" class="subtitle">${escapeXml(scopeLabel)}</text>
  <text x="36" y="96" class="name">${escapeXml(username)}</text>
  <text x="36" y="136" class="type">Ways to Improve</text>
  <text x="604" y="112" class="gap-count">${gapCount} ${suggestionLabel}</text>
  <g aria-label="${escapeXml(includesPrivateSignals ? "Suggestions drawn from included public and owner-supplied repositories" : "Suggestions drawn from public repositories")}">
${rows.join("")}
  </g>
  <text x="36" y="${footerY}" class="footer">Buildmarks ${escapeXml(brandVersion)} · ${escapeXml(footerScope)} · ${escapeXml(generatedDate)}</text>
</svg>`;
}

export function renderRepositorySignalCard(report: RepoSignal, options: RenderCardOptions = {}): string {
  const theme = normalizeTheme(options.theme);
  const repoNameRaw = `${report.owner}/${report.name}`;
  const repoName = fitText(repoNameRaw, 38);
  const overall = safeScore(report.overall);
  const overallTone = scoreTone(overall);
  const includesPrivateSignals = report.signalVisibility?.privateRepositoriesIncluded === true;
  const footerLabel = includesPrivateSignals
    ? `Buildmarks Repo ${brandVersion} · ${privateLocalSignalVisibility.cardLabel}`
    : `Buildmarks Repo ${brandVersion} · Public GitHub`;
  const visibleDimensions = signalDimensions.filter(
    (dimension) => {
      const assessment = report.dimensions[dimension].assessment;
      return assessment === undefined || assessment.applicability === "applicable";
    }
  );
  const rows = visibleDimensions.map((dimension, index) =>
    renderDimensionRow(dimension, safeScore(report.dimensions[dimension].score), rowStartY + index * rowGap)
  );
  const highlights = [...new Set(
    (report.evidenceLedger ?? report.evidence).map((item) => evidenceToHighlight(item.label))
  )].slice(0, 4);
  const chips = highlights.map((label, index) => renderEvidenceChip(label, index));
  const desc = buildRepositoryDescription(report, overall);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" class="card card-${theme}" role="img" width="${cardWidth}" height="${cardHeight}" viewBox="0 0 ${cardWidth} ${cardHeight}" aria-labelledby="title desc">
  <title id="title">Buildmarks repository card for ${escapeXml(repoNameRaw)}</title>
  <desc id="desc">${escapeXml(desc)}</desc>
  ${renderDefs()}
  <style>${renderStyles()}</style>
  <rect width="${cardWidth}" height="${cardHeight}" class="bg" />
  <rect x="18" y="18" width="724" height="384" rx="14" class="panel" filter="url(#cardShadow)" />
  <path d="M24 22 H736" class="top-line" />
  <text x="36" y="62" class="name">${escapeXml(repoName)}</text>
  <text x="${rightEdgeX}" y="62" class="overall overall-${overallTone}">${escapeXml(scoreTier(overall))}</text>
  <g aria-label="Repository areas with scores out of 100">
${rows.join("")}
  </g>
  <text x="36" y="${highlightLabelY}" class="section-label">Highlights</text>
  <g aria-label="Repository highlights">
${chips.join("")}
  </g>
  <text x="36" y="${footerY}" class="footer">${escapeXml(footerLabel)}</text>
</svg>`;
}

function renderDimensionRow(
  dimension: SignalDimension,
  score: number,
  labelY: number
): string {
  const width = Math.max(0, Math.min(barMaxWidth, Math.round(score / 100 * barMaxWidth)));
  const label = dimensionLabels[dimension];
  const tone = scoreTone(score);
  const barY = labelY - 9;
  const tier = scoreTier(score);

  return `
    <g role="img" aria-label="${escapeXml(`${label}: ${tier}, ${score} points out of 100`)}">
      <text x="36" y="${labelY}" class="label">${escapeXml(label)}</text>
      <text x="${scoreX}" y="${labelY}" class="score">${escapeXml(tier)}</text>
      <rect x="${barX}" y="${barY}" width="${barMaxWidth}" height="${barHeight}" rx="3" class="track" aria-hidden="true" />
      <rect x="${barX}" y="${barY}" width="${width}" height="${barHeight}" rx="3" class="bar bar-${tone}" role="progressbar" aria-label="${escapeXml(`${label} score`)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${score}" />
    </g>`;
}

function renderEvidenceChip(label: string, index: number): string {
  const x = 36 + index * (chipWidth + chipGap);

  return `
    <g role="img" aria-label="${escapeXml(`Highlight: ${label}`)}">
      <rect x="${x}" y="${chipY}" width="${chipWidth}" height="28" rx="6" class="chip-bg" />
      <text x="${x + 12}" y="${chipY + 19}" class="chip">${escapeXml(label)}</text>
    </g>`;
}

function evidenceToHighlight(label: string): string {
  const normalized = label.toLowerCase();

  if (normalized.includes("test file")) {
    return "Test Files";
  }
  if (normalized.includes("test")) {
    return "Tests";
  }
  if (normalized.includes("ci") || normalized.includes("workflow")) {
    return "CI";
  }
  if (normalized.includes("changelog") || normalized.includes("release notes")) {
    return "Changelog";
  }
  if (normalized.includes("release") || normalized.includes("tag")) {
    return "Releases";
  }
  if (normalized.includes("readme") || normalized.includes("usage")) {
    return "Docs";
  }
  if (normalized.includes("license")) {
    return "License";
  }
  if (normalized.includes("package") || normalized.includes("installable")) {
    return "Package";
  }
  if (normalized.includes("security")) {
    return "Security";
  }
  if (normalized.includes("contribution")) {
    return "Contributing";
  }
  if (normalized.includes("code of conduct")) {
    return "Conduct";
  }
  if (normalized.includes("demo") || normalized.includes("documentation")) {
    return "Demo";
  }
  if (normalized.includes("compact")) {
    return "Small Files";
  }
  if (normalized.includes("example") || normalized.includes("fixture")) {
    return "Examples";
  }

  return fitText(label.replace(/\bfound\b/gi, "").trim(), 16);
}

function renderGapRow(repository: string, dimension: SignalDimension, missing: string[], y: number): string {
  const label = fitText(repository, 24);
  const missingText = fitText(missing.join(", "), 78);
  const dimensionText = fitText(dimensionLabels[dimension], 24);

  return `
    <g role="img" aria-label="${escapeXml(`${repository}: consider adding ${missing.join(", ")} for ${dimensionText}`)}">
      <rect x="36" y="${y - 26}" width="688" height="46" rx="8" class="chip-bg" />
      <text x="52" y="${y - 5}" class="label">${escapeXml(label)}</text>
      <text x="504" y="${y - 5}" class="chip">${escapeXml(dimensionText)}</text>
      <text x="52" y="${y + 14}" class="subtitle">could add: ${escapeXml(missingText)}</text>
    </g>`;
}

function renderEmptyGapRow(includesPrivateSignals = false): string {
  const title = "No project suggestions are available";
  const body = includesPrivateSignals
    ? "No suggestions were identified from the repositories included here."
    : "No suggestions were identified from the available public GitHub repositories.";

  return `
    <g role="img" aria-label="${escapeXml(title)}">
      <rect x="36" y="150" width="688" height="74" rx="10" class="chip-bg" />
      <text x="62" y="188" class="fallback-title">${escapeXml(title)}</text>
      <text x="62" y="216" class="fallback-body">${escapeXml(body)}</text>
    </g>`;
}

function renderDefs(): string {
  return `<defs>
    <linearGradient id="panelStroke" x1="18" y1="18" x2="742" y2="402" gradientUnits="userSpaceOnUse">
      <stop offset="0%" class="stroke-start" />
      <stop offset="100%" class="stroke-end" />
    </linearGradient>
    <linearGradient id="barStrong" x1="${barX}" y1="0" x2="${barX + barMaxWidth}" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0%" class="bar-strong-start" />
      <stop offset="100%" class="bar-strong-end" />
    </linearGradient>
    <linearGradient id="barMiddle" x1="${barX}" y1="0" x2="${barX + barMaxWidth}" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0%" class="bar-middle-start" />
      <stop offset="100%" class="bar-middle-end" />
    </linearGradient>
    <linearGradient id="barLow" x1="${barX}" y1="0" x2="${barX + barMaxWidth}" y2="0" gradientUnits="userSpaceOnUse">
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
      --warning: #7a5200;
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
    .subtitle, .footer, .section-label, .metric-note, .legend { fill: var(--muted); font: 500 13px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .right { text-anchor: end; }
    .name { fill: var(--text); font: 700 20px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .type { fill: var(--accent); font: 700 14px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .overall { fill: var(--warning); font: 800 26px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; text-anchor: end; }
    .overall-strong { fill: var(--accent); }
    .overall-middle { fill: var(--warning); }
    .overall-low { fill: var(--low); }
    .overall-unit { fill: var(--muted); font: 700 16px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .gap-count { fill: var(--muted); font: 700 16px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .label { fill: var(--text); font: 600 14px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .score { fill: var(--muted); font: 700 13px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; text-anchor: end; }
    .track { fill: var(--track); }
    .bar-strong { fill: url(#barStrong); }
    .bar-middle { fill: url(#barMiddle); }
    .bar-low { fill: url(#barLow); }
    .chip-bg { fill: var(--chip-bg); stroke: var(--panel-border); stroke-width: 1; }
    .chip { fill: var(--chip-text); font: 600 12px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .fallback-box { fill: var(--chip-bg); stroke: var(--panel-border); stroke-width: 1; }
    .fallback-title { fill: var(--text); font: 700 22px ui-sans-serif, system-ui, sans-serif; }
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
  const context = buildProfileCardContext(report);
  const detailCount = countProfileSignals(report);
  const repositoryCount = report.selection?.evaluatedCount ?? report.topRepos.length;
  const repositoryLabel = repositoryCount === 1 ? "repository" : "repositories";
  const detailLabel = detailCount === 1 ? "project practice" : "project practices";
  const scores = signalDimensions
    .filter((dimension) => !context.contextualDimensions.has(dimension))
    .map((dimension) => {
      const score = safeScore(report.dimensions[dimension]);
      return `${dimensionLabels[dimension]} ${scoreTier(score)}, ${score} out of 100`;
    })
    .join(", ");

  if (report.signalVisibility?.privateRepositoriesIncluded === true) {
    return `Buildmarks reviewed ${repositoryCount} ${repositoryLabel} and found ${detailCount} ${detailLabel}. The overall result is ${scoreTier(overall)}, ${overall} out of 100. ${scores}. Owner-supplied private repositories are included and cannot be checked independently on public GitHub. Buildmarks is not a developer ranking.`;
  }

  return `Buildmarks reviewed ${repositoryCount} ${repositoryLabel} and found ${detailCount} ${detailLabel}. The overall result is ${scoreTier(overall)}, ${overall} out of 100. ${scores}. This card is based on public GitHub repositories only. Buildmarks is not a developer ranking.`;
}

type ProfileCardContext = {
  contextualDimensions: Set<SignalDimension>;
};

function buildProfileCardContext(report: UserSignalReport): ProfileCardContext {
  const contextualDimensions = new Set([
    ...(report.unavailableDimensions ?? []),
    ...(report.notApplicableDimensions ?? [])
  ]);

  return { contextualDimensions };
}

function buildRepositoryDescription(report: RepoSignal, overall: number): string {
  const detailCount = countRepositorySignals(report);
  const detailLabel = detailCount === 1 ? "project practice" : "project practices";
  const scores = signalDimensions
    .filter((dimension) => {
      const assessment = report.dimensions[dimension].assessment;
      return assessment === undefined || assessment.applicability === "applicable";
    })
    .map((dimension) => {
      const score = safeScore(report.dimensions[dimension].score);
      return `${dimensionLabels[dimension]} ${scoreTier(score)}, ${score} out of 100`;
    })
    .join(", ");
  const scope = report.signalVisibility?.privateRepositoriesIncluded === true
    ? "This owner-supplied private repository cannot be checked independently on public GitHub"
    : "Based on public GitHub only";

  return `Buildmarks found ${detailCount} ${detailLabel} for ${report.owner}/${report.name}. The repository result is ${scoreTier(overall)}, ${overall} out of 100. ${scores}. ${scope}. Buildmarks is not a developer ranking.`;
}

function finishSentence(value: string): string {
  const trimmed = value.trim();
  return /[.!?…]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function formatAssessmentSummary(
  confidence: UserSignalReport["confidence"],
  coverageRatio: number | undefined
): string {
  const confidenceLabel = confidence === "high"
    ? "High confidence"
    : confidence === "medium"
      ? "Medium confidence"
      : confidence === "low"
        ? "Low confidence"
        : "Confidence unavailable";
  const coverageLabel = typeof coverageRatio === "number" && Number.isFinite(coverageRatio)
    ? `${Math.round(Math.max(0, Math.min(1, coverageRatio)) * 100)}% checked`
    : "Coverage unavailable";
  return `${confidenceLabel} · ${coverageLabel}`;
}

function countProfileSignals(report: UserSignalReport): number {
  const unavailableDimensions = new Set(report.unavailableDimensions ?? []);
  const keys = new Set<string>();

  report.topRepos.forEach((repository) => {
    signalDimensions.forEach((dimension) => {
      if (unavailableDimensions.has(dimension)) {
        return;
      }

      repository.dimensions[dimension].evidence.forEach((item) => {
        if (item.level === "positive") {
          keys.add(`${item.source}:${item.label}`);
        }
      });
    });
  });

  return keys.size;
}

function countRepositorySignals(report: RepoSignal): number {
  const keys = new Set<string>();

  signalDimensions.forEach((dimension) => {
    report.dimensions[dimension].evidence.forEach((item) => {
      if (item.level === "positive") {
        keys.add(`${report.owner}/${report.name}:${item.source}:${item.label}`);
      }
    });
  });

  return keys.size;
}

function escapeXml(value: string): string {
  return stripInvalidXmlCharacters(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function stripInvalidXmlCharacters(value: string): string {
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
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
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }

  return new Date().toISOString().slice(0, 10);
}

function safeScore(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : 0;
}

function scoreTone(score: number): "strong" | "middle" | "low" {
  if (score >= 75) {
    return "strong";
  }

  return score >= 50 ? "middle" : "low";
}

function scoreTier(score: number): string {
  const safe = safeScore(score);
  const tier = tierBands.find((band) => safe >= band.minimum);

  return tier?.label ?? "Gold V";
}

function normalizeTheme(value: unknown): "auto" | "dark" | "light" {
  return value === "dark" || value === "light" || value === "auto" ? value : "auto";
}
