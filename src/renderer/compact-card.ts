import type { SignalType } from "../shared/types.js";
import { getProfileCover, renderCoverArtwork, renderCoverStyles } from "./profile-cover.js";
import { renderProfileStyles } from "./profile-card.js";

interface CompactCardContent {
  signalType: SignalType;
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
  const cover = getProfileCover(content.signalType);
  const height = content.includesPrivate ? 360 : 336;
  const projects = content.projects.map((project, index) => {
    const y = 176 + index * 56;
    return `<g role="img" aria-label="${project.descriptionXml}">
      <text x="22" y="${y}" class="project">${project.nameXml}</text>
      <text x="22" y="${y + 23}" class="facts">${project.factsXml}</text>
    </g>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" class="card card-${content.theme}" data-layout="compact" role="img" width="420" height="${height}" viewBox="0 0 420 ${height}" aria-labelledby="title desc">
  <title id="title">${content.titleXml}</title>
  <desc id="desc">${content.descriptionXml}</desc>
  <style>${renderCoverStyles(cover)}${renderProfileStyles()}
    .brand { font-size:16px; }
    .username { font-size:19px; }
    .cover-title { font-size:29px; letter-spacing:-.5px; }
    .checked,.footer { font-size:14px; }
    .project { font-size:16px; font-weight:650; }
    .facts { font-size:14px; fill:var(--muted); }
  </style>
  <rect width="420" height="${height}" rx="16" class="surface" />
  <text x="22" y="32" class="brand">Buildmarks</text>
  <text x="398" y="32" class="checked">${content.checkedXml}</text>
  <text x="22" y="63" class="username">${content.usernameXml}</text>
  <g data-cover="${cover.id}" aria-label="${cover.lines.join(" ")}">
    <text x="22" y="104" class="cover-title${cover.serif ? " cover-serif" : ""}"><tspan x="22">${cover.lines[0]}</tspan><tspan x="22" dy="32">${cover.lines[1]}</tspan></text>
    ${renderCoverArtwork(cover, "translate(298 77) scale(.42)")}
  </g>
  <path d="M22 149h376" class="divider" aria-hidden="true" />
  <g aria-label="Representative projects and observed details">
    ${projects.length > 0 ? projects.join("\n") : '<text x="22" y="187" class="facts">No repository details to show.</text><text x="22" y="212" class="facts">See the report for checked areas.</text>'}
  </g>
  <path d="M22 272h376" class="divider" aria-hidden="true" />
  <text x="22" y="296" class="footer">${content.scopeXml}</text>
  <text x="22" y="319" class="footer">${content.generatedXml}</text>
  ${content.includesPrivate ? '<text x="22" y="342" class="footer">Private projects supplied by owner</text>' : ""}
</svg>`.replace(/[ \t]+$/gm, "");
}

export function renderCompactFallback(messageXml: string, descriptionXml: string, theme: "auto" | "dark" | "light"): string {
  const cover = getProfileCover("General Signal Profile");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" class="card card-${theme}" data-layout="compact" role="img" width="420" height="200" viewBox="0 0 420 200" aria-labelledby="title desc">
  <title id="title">Buildmarks fallback card</title>
  <desc id="desc">${descriptionXml} No score is shown. Buildmarks is not a developer ranking.</desc>
  <style>${renderCoverStyles(cover)}${renderProfileStyles()}.footer{font-size:14px}.message{font-size:16px}</style>
  <rect width="420" height="200" rx="16" class="surface" />
  <text x="22" y="38" class="brand">Buildmarks</text>
  <text x="22" y="88" class="username">Card unavailable</text>
  <text x="22" y="120" class="message">${messageXml}</text>
  <text x="22" y="167" class="footer">No score is shown</text>
</svg>`.replace(/[ \t]+$/gm, "");
}
