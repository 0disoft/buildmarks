import { compactCardSize } from "./layout-policy.js";
import type { ProfilePersona, SignalType } from "../shared/types.js";
import { getProfileCover, renderCoverStyles } from "./profile-cover.js";
import { renderPersonaEmblem, renderEmblemStyles } from "./persona-emblem.js";
import { renderProfileStyles } from "./profile-card.js";
import { wrapCardText, escapeCardCopy as escapeCopy } from "./text-layout.js";

interface CompactCardContent {
  signalType: SignalType;
  persona?: ProfilePersona;
  scoreXml: string;
  theme: "auto" | "dark" | "light";
  usernameXml: string;
  titleXml: string;
  descriptionXml: string;
  checkedXml: string;
  scopeXml: string;
  generatedXml: string;
  includesPrivate: boolean;
  reviewedCount: number;
  projects: { nameXml: string; descriptionXml: string }[];
}

export function renderCompactCard(content: CompactCardContent): string {
  const cover = getProfileCover(content.signalType, content.persona);
  const height = content.includesPrivate ? compactCardSize.privateHeight : compactCardSize.publicHeight;
  const score = content.scoreXml.split("/")[0]!;
  const checked = content.checkedXml.match(/\d+%/)?.[0] ?? "—";
  const checkedLabel = content.checkedXml.includes("Early look") ? `~${checked}` : checked;
  const date = content.generatedXml.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? "Undated";
  const count = Number.isSafeInteger(content.reviewedCount) && content.reviewedCount >= 0 ? content.reviewedCount : 0;
  const projects = content.projects.slice(0, 2).map((project, index) => {
    const x = 24 + index * 190;
    return `<g role="img" aria-label="${project.descriptionXml}">
      <title>${project.descriptionXml}</title>
      <g transform="translate(${x} 231)" class="small-icon">${repositoryIcon}</g>
      <text x="${x + 24}" y="244" class="project">${project.nameXml}</text>
    </g>`;
  });
  const tagline = wrapCardText(content.persona?.description ?? "", 32, 4)
    .map((line, index) => `<tspan x="24"${index > 0 ? ' dy="18"' : ""}>${escapeCopy(line)}</tspan>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" class="card card-${content.theme}" data-layout="compact" role="img" width="${compactCardSize.width}" height="${height}" viewBox="0 0 ${compactCardSize.width} ${height}" aria-labelledby="title desc">
  <title id="title">${content.titleXml}</title>
  <desc id="desc">${content.descriptionXml}</desc>
  <style>${renderCoverStyles(cover)}${renderProfileStyles()}${renderEmblemStyles()}${renderCompactStyles()}</style>
  <rect x=".5" y=".5" width="419" height="${height - 1}" rx="20" class="surface" />
  <g transform="translate(24 20)" class="brand-mark" aria-hidden="true"><path d="M0 0h7v7H0zM10 0h7v7h-7zM0 10h7v7H0zM10 10h7v7h-7z"/></g>
  <text x="49" y="33" class="brand">Buildmarks</text>
  <text x="24" y="58" class="username">${content.usernameXml}</text>
  <g aria-label="${content.scoreXml}">
    <text x="396" y="42" class="profile-score">${score}</text>
    <text x="396" y="72" class="score-unit">/ 100</text>
  </g>
  <g data-cover="${cover.id}" aria-label="${escapeCopy(cover.lines.join(" "))}">
    <text x="24" y="100" class="cover-title"><tspan x="24">${escapeCopy(cover.lines[0])}</tspan><tspan x="24" dy="34">${escapeCopy(cover.lines[1])}</tspan></text>
    ${renderPersonaEmblem(content.persona?.id)}
  </g>
  <text x="24" y="156" class="tagline">${tagline}</text>
  <path d="M24 218h372" class="divider" aria-hidden="true" />
  <g aria-label="Representative projects and observed details">
    ${projects.length > 0 ? projects.join("\n") : '<text x="24" y="244" class="project muted">No projects to display</text>'}
  </g>
  <g role="img" aria-label="${content.scopeXml}">
    <title>${content.scopeXml}</title>
    <g transform="translate(24 262)" class="small-icon">${content.includesPrivate ? lockIcon : repositoryIcon}</g>
    <text x="48" y="275" class="footer">${count} ${count === 1 ? "repo" : "repos"}</text>
  </g>
  <g role="img" aria-label="${content.checkedXml}">
    <title>${content.checkedXml}</title>
    <g transform="translate(154 262)" class="small-icon">${checkIcon}</g>
    <text x="178" y="275" class="footer">${checkedLabel}</text>
  </g>
  <g role="img" aria-label="${content.generatedXml}">
    <title>${content.generatedXml}</title>
    <g transform="translate(276 262)" class="small-icon">${calendarIcon}</g>
    <text x="300" y="275" class="footer">${date}</text>
  </g>
  ${content.includesPrivate ? '<text x="24" y="300" class="footer">Public + Private Projects · Owner-supplied</text>' : ""}
</svg>`.replace(/[ \t]+$/gm, "");
}

const repositoryIcon = '<rect x="2" y="1" width="12" height="14" rx="2"/><path d="M5 1v10l3-2 3 2V1M2 12h12"/>';
const checkIcon = '<circle cx="8" cy="8" r="6.5"/><path d="m5 8 2 2 4-4"/>';
const calendarIcon = '<rect x="1" y="3" width="14" height="12" rx="2"/><path d="M4 1v4m8-4v4M1 7h14"/>';
const lockIcon = '<rect x="2" y="7" width="12" height="8" rx="2"/><path d="M5 7V4a3 3 0 0 1 6 0v3"/>';

function renderCompactStyles(): string {
  const dark = '--surface:#101718;--text:#f1f6f2;--muted:#94a19a;--line:#2a3632;';
  return `
    .card{--surface:#fbfcfa;--text:#17201d;--muted:#68756e;--line:#e2e7e1;}
    .card-dark{${dark}}
    @media(prefers-color-scheme:dark){.card-auto{${dark}}}
    .surface{stroke:var(--line);stroke-width:1;}
    .brand{font-size:14px;font-weight:750;letter-spacing:.2px;}
    .brand-mark{fill:var(--accent);}
    .username{font-size:15px;font-weight:500;fill:var(--muted);}
    .cover-title{font-size:30px;font-weight:800;letter-spacing:-.7px;}
    .profile-score{font-size:38px;font-weight:800;text-anchor:end;letter-spacing:-1.5px;}
    .score-unit,.tagline,.footer{font-size:14px;fill:var(--muted);}
    .score-unit{text-anchor:end;}
    .project{font-size:14px;font-weight:600;}
    .muted{fill:var(--muted);font-weight:400;}
    .small-icon{fill:none;stroke:var(--muted);stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round;}
  `;
}


export function renderCompactFallback(messageXml: string, descriptionXml: string, theme: "auto" | "dark" | "light"): string {
  const cover = getProfileCover("General Signal Profile");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" class="card card-${theme}" data-layout="compact" role="img" width="${compactCardSize.width}" height="${compactCardSize.fallbackHeight}" viewBox="0 0 ${compactCardSize.width} ${compactCardSize.fallbackHeight}" aria-labelledby="title desc">
  <title id="title">Buildmarks fallback card</title>
  <desc id="desc">${descriptionXml} No score is shown. Buildmarks is not a developer ranking.</desc>
  <style>${renderCoverStyles(cover)}${renderProfileStyles()}${renderCompactStyles()}.message{font-size:16px}</style>
  <rect width="${compactCardSize.width}" height="${compactCardSize.fallbackHeight}" rx="16" class="surface" />
  <text x="22" y="38" class="brand">Buildmarks</text>
  <text x="22" y="88" class="username">Card unavailable</text>
  <text x="22" y="120" class="message">${messageXml}</text>
  <text x="22" y="167" class="footer">No score is shown</text>
</svg>`.replace(/[ \t]+$/gm, "");
}
