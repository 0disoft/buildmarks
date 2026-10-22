import { cardDisplayPolicy, detailedCardSize } from "./layout-policy.js";
import { dimensionLabels, type ProfilePersona, type SignalDimension, type SignalType } from "../shared/types.js";
import { getProfileCover, renderCoverStyles } from "./profile-cover.js";
import { renderPersonaEmblem, renderEmblemStyles } from "./persona-emblem.js";
import { wrapCardText, escapeCardCopy as escapeCopy } from "./text-layout.js";

interface ProfileCardContent {
  signalType: SignalType;
  persona?: ProfilePersona;
  scoreXml: string;
  theme: "auto" | "dark" | "light";
  usernameXml: string;
  titleXml: string;
  descriptionXml: string;
  footerXml: string;
  checkedXml: string;
  dimensions: ProfileCardRow[];
  highlightsXml: string[];
}

export type ProfileCardRow = {
  key: SignalDimension;
  descriptionXml: string;
} & ({ status: "scored"; score: number } | { status: "unavailable" | "not-applicable" });

const font = 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export function renderProfileCard(content: ProfileCardContent): string {
  const cover = getProfileCover(content.signalType, content.persona);
  const tagline = wrapCardText(content.persona?.description ?? "", 32, 5)
    .map((line, index) => `<tspan x="32"${index > 0 ? ' dy="17"' : ""}>${escapeCopy(line)}</tspan>`).join("");
  const rows = content.dimensions.map((row, index) => {
    const { key, descriptionXml } = row;
    const y = 112 + index * 36;
    if (row.status !== "scored") {
      const label = row.status === "not-applicable" ? "Doesn't apply" : "Not checked";
      return `<g role="img" aria-label="${descriptionXml}">
        <text x="314" y="${y}" class="metric">${dimensionLabels[key]}</text>
        <text x="728" y="${y}" class="value missing">${label}</text>
        <path d="M314 ${y + 14}h414" class="missing-track" aria-hidden="true" />
      </g>`;
    }
    const { score } = row;
    return `<g role="img" aria-label="${descriptionXml}">
      <text x="314" y="${y}" class="metric">${dimensionLabels[key]}</text>
      <text x="728" y="${y}" class="value">${score}</text>
      <rect x="314" y="${y + 10}" width="414" height="7" rx="3.5" class="track" aria-hidden="true" />
      <rect x="314" y="${y + 10}" width="${Math.round(score / 100 * 414)}" height="7" rx="3.5" class="bar" role="progressbar" aria-label="${dimensionLabels[key]} score" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${score}" />
    </g>`;
  });
  const highlights = content.highlightsXml.slice(0, cardDisplayPolicy.detailedHighlightLimit).map((label, index) => {
    const x = 32 + index * 236;
    return `<g role="img" aria-label="Highlight: ${label}">
      <rect x="${x}" y="345" width="224" height="27" rx="6" class="chip-bg" />
      <text x="${x + 12}" y="363" class="chip">${label}</text>
    </g>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" class="card card-${content.theme}" role="img" width="${detailedCardSize.width}" height="${detailedCardSize.height}" viewBox="0 0 ${detailedCardSize.width} ${detailedCardSize.height}" aria-labelledby="title desc">
  <title id="title">${content.titleXml}</title>
  <desc id="desc">${content.descriptionXml}</desc>
  <style>${renderCoverStyles(cover)}${renderProfileStyles()}${renderEmblemStyles()}</style>
  <rect width="${detailedCardSize.width}" height="${detailedCardSize.height}" rx="16" class="surface" />
  <g aria-hidden="true" class="accent"><path d="M32 23h7v17h-7zM43 23h7v17h-7z" /></g>
  <text x="60" y="39" class="brand">Buildmarks</text>
  <text x="728" y="38" class="checked">${content.checkedXml}</text>
  <text x="32" y="75" class="username">${content.usernameXml}</text>
  <path d="M284 98v224" class="divider" aria-hidden="true" />
  <g data-cover="${cover.id}" aria-label="${escapeCopy(cover.lines.join(" "))}">
    <text x="32" y="119" class="cover-title${cover.serif ? " cover-serif" : ""}"><tspan x="32">${escapeCopy(cover.lines[0])}</tspan><tspan x="32" dy="34">${escapeCopy(cover.lines[1])}</tspan></text>
    <text x="32" y="180" class="tagline">${tagline}</text>
    ${renderPersonaEmblem(content.persona?.id, "translate(38 258) scale(.45)")}
    <text x="250" y="310" class="profile-score">${content.scoreXml}</text>
  </g>
  <g aria-label="Project areas with scores out of 100">${rows.join("\n")}</g>
${highlights.length > 0 ? '  <text x="32" y="333" class="caption">Highlights</text>' : ""}
  <g aria-label="Project highlights">${highlights.join("\n")}</g>
  <path d="M32 383h696" class="divider" aria-hidden="true" />
  <text x="32" y="403" class="footer">${content.footerXml}</text>
</svg>`.replace(/[ \t]+$/gm, "");
}

export function renderProfileStyles(): string {
  return `
    text { font-family:${font}; fill:var(--text); }
    .surface { fill:var(--surface); }
    .brand { font-size:20px; font-weight:750; }
    .username { font-size:20px; font-weight:650; }
    .cover-title { font-size:30px; font-weight:800; letter-spacing:-.5px; }
    .tagline { font-size:13px; fill:var(--muted); }
    .profile-score { font-size:24px; font-weight:750; text-anchor:end; }
    .cover-serif { font-family:Georgia, "Times New Roman", serif; letter-spacing:-.5px; }
    .metric { font-size:15px; font-weight:600; }
    .value { font-size:15px; font-weight:700; text-anchor:end; font-variant-numeric:tabular-nums; }
    .missing { font-size:12px; font-weight:500; fill:var(--muted); }
    .missing-track { stroke:var(--line); stroke-width:2; stroke-dasharray:3 5; }
    .checked { font-size:12px; font-weight:600; fill:var(--muted); text-anchor:end; }
    .caption { font-size:12px; font-weight:600; fill:var(--muted); }
    .footer { font-size:12px; font-weight:500; fill:var(--muted); }
    .divider { stroke:var(--line); stroke-width:1; }
    .track { fill:var(--track); }
    .bar,.accent { fill:var(--accent); }
    .chip-bg { fill:var(--chip); }
    .chip { font-size:12px; font-weight:600; }
  `;
}
