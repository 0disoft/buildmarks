import { compactCardSize } from "./layout-policy.js";
import type { ProfilePersona, SignalType } from "../shared/types.js";
import { getProfileCover, renderCoverArtwork, renderCoverStyles } from "./profile-cover.js";
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
  projects: { nameXml: string; factsXml: string; descriptionXml: string }[];
}

export function renderCompactCard(content: CompactCardContent): string {
  const cover = getProfileCover(content.signalType, content.persona);
  const height = content.includesPrivate ? compactCardSize.privateHeight : compactCardSize.publicHeight;
  const projects = content.projects.map((project, index) => {
    const y = 244 + index * 46;
    return `<g role="img" aria-label="${project.descriptionXml}">
      <text x="22" y="${y}" class="project">${project.nameXml}</text>
      <text x="22" y="${y + 23}" class="facts">${project.factsXml}</text>
    </g>`;
  });
  const tagline = wrapCardText(content.persona?.description ?? "", 49, 3)
    .map((line, index) => `<tspan x="22"${index > 0 ? ' dy="19"' : ""}>${escapeCopy(line)}</tspan>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" class="card card-${content.theme}" data-layout="compact" role="img" width="${compactCardSize.width}" height="${height}" viewBox="0 0 ${compactCardSize.width} ${height}" aria-labelledby="title desc">
  <title id="title">${content.titleXml}</title>
  <desc id="desc">${content.descriptionXml}</desc>
  <style>${renderCoverStyles(cover)}${renderProfileStyles()}
    .brand { font-size:16px; }
    .username { font-size:19px; }
    .cover-title { font-size:29px; letter-spacing:-.5px; }
    .checked,.footer { font-size:14px; }
    .profile-score { font-size:21px; font-weight:750; text-anchor:end; }
    .tagline { font-size:14px; fill:var(--muted); }
    .project { font-size:16px; font-weight:650; }
    .facts { font-size:14px; fill:var(--muted); }
  </style>
  <rect width="${compactCardSize.width}" height="${height}" rx="16" class="surface" />
  <text x="22" y="32" class="brand">Buildmarks</text>
  <text x="398" y="32" class="profile-score">${content.scoreXml}</text>
  <text x="22" y="63" class="username">${content.usernameXml}</text>
  <g data-cover="${cover.id}" aria-label="${escapeCopy(cover.lines.join(" "))}">
    <text x="22" y="104" class="cover-title${cover.serif ? " cover-serif" : ""}"><tspan x="22">${escapeCopy(cover.lines[0])}</tspan><tspan x="22" dy="32">${escapeCopy(cover.lines[1])}</tspan></text>
    ${renderCoverArtwork(cover, "translate(298 77) scale(.42)")}
  </g>
  <text x="22" y="165" class="tagline">${tagline}</text>
  <path d="M22 218h376" class="divider" aria-hidden="true" />
  <g aria-label="Representative projects and observed details">
    ${projects.length > 0 ? projects.join("\n") : '<text x="22" y="244" class="facts">No repository details to show.</text><text x="22" y="267" class="facts">See the report for checked areas.</text>'}
  </g>
  <path d="M22 326h376" class="divider" aria-hidden="true" />
  <text x="22" y="350" class="footer">${content.scopeXml}</text>
  <text x="22" y="373" class="footer checked" style="text-anchor:start">${content.checkedXml}</text>
  <text x="22" y="396" class="footer">${content.generatedXml}</text>
  ${content.includesPrivate ? '<text x="22" y="419" class="footer">Private projects supplied by owner</text>' : ""}
</svg>`.replace(/[ \t]+$/gm, "");
}


export function renderCompactFallback(messageXml: string, descriptionXml: string, theme: "auto" | "dark" | "light"): string {
  const cover = getProfileCover("General Signal Profile");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" class="card card-${theme}" data-layout="compact" role="img" width="${compactCardSize.width}" height="${compactCardSize.fallbackHeight}" viewBox="0 0 ${compactCardSize.width} ${compactCardSize.fallbackHeight}" aria-labelledby="title desc">
  <title id="title">Buildmarks fallback card</title>
  <desc id="desc">${descriptionXml} No score is shown. Buildmarks is not a developer ranking.</desc>
  <style>${renderCoverStyles(cover)}${renderProfileStyles()}.footer{font-size:14px}.message{font-size:16px}</style>
  <rect width="${compactCardSize.width}" height="${compactCardSize.fallbackHeight}" rx="16" class="surface" />
  <text x="22" y="38" class="brand">Buildmarks</text>
  <text x="22" y="88" class="username">Card unavailable</text>
  <text x="22" y="120" class="message">${messageXml}</text>
  <text x="22" y="167" class="footer">No score is shown</text>
</svg>`.replace(/[ \t]+$/gm, "");
}
