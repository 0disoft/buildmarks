import { dimensionLabels, type SignalDimension } from "../shared/types.js";

interface ProfileCardContent {
  theme: "auto" | "dark" | "light";
  usernameXml: string;
  titleXml: string;
  descriptionXml: string;
  footerXml: string;
  checkedXml: string;
  dimensions: { key: SignalDimension; score: number; descriptionXml: string }[];
  highlightsXml: string[];
}

const font = 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export function renderProfileCard(content: ProfileCardContent): string {
  const rows = content.dimensions.map(({ key, score, descriptionXml }, index) => {
    const y = 112 + index * 32;
    return `<g role="img" aria-label="${descriptionXml}">
      <text x="314" y="${y}" class="metric">${dimensionLabels[key]}</text>
      <text x="728" y="${y}" class="value">${score}</text>
      <rect x="314" y="${y + 10}" width="414" height="7" rx="3.5" class="track" aria-hidden="true" />
      <rect x="314" y="${y + 10}" width="${Math.round(score / 100 * 414)}" height="7" rx="3.5" class="bar" role="progressbar" aria-label="${dimensionLabels[key]} score" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${score}" />
    </g>`;
  });
  const highlights = content.highlightsXml.slice(0, 3).map((label, index) => {
    const x = 32 + index * 236;
    return `<g role="img" aria-label="Highlight: ${label}">
      <rect x="${x}" y="345" width="224" height="27" rx="6" class="chip-bg" />
      <text x="${x + 12}" y="363" class="chip">${label}</text>
    </g>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" class="card card-${content.theme}" role="img" width="760" height="420" viewBox="0 0 760 420" aria-labelledby="title desc">
  <title id="title">${content.titleXml}</title>
  <desc id="desc">${content.descriptionXml}</desc>
  <style>${renderProfileStyles()}</style>
  <rect width="760" height="420" rx="16" class="surface" />
  <g aria-hidden="true" class="accent"><path d="M32 23h7v17h-7zM43 23h7v17h-7z" /></g>
  <text x="60" y="39" class="brand">Buildmarks</text>
  <text x="728" y="38" class="checked">${content.checkedXml}</text>
  <text x="32" y="75" class="username">${content.usernameXml}</text>
  <path d="M284 98v208" class="divider" aria-hidden="true" />
  <text x="32" y="133" class="cover-title"><tspan x="32">Project</tspan><tspan x="32" dy="38">Snapshot</tspan></text>
  ${renderSnapshotEmblem()}
  <g aria-label="Project areas with scores out of 100">${rows.join("\n")}</g>
  <text x="32" y="333" class="caption">Highlights</text>
  <g aria-label="Project highlights">${highlights.join("\n")}</g>
  <path d="M32 383h696" class="divider" aria-hidden="true" />
  <text x="32" y="403" class="footer">${content.footerXml}</text>
</svg>`;
}

function renderSnapshotEmblem(): string {
  return `<g transform="translate(60 199)" aria-hidden="true">
    <path d="M0 32V8a8 8 0 0 1 8-8h24M156 32V8a8 8 0 0 0-8-8h-24M0 84v24a8 8 0 0 0 8 8h24M156 84v24a8 8 0 0 1-8 8h-24" fill="none" class="emblem-stroke" stroke-width="12" stroke-linecap="round" />
    <circle cx="55" cy="39" r="18" class="accent" />
    <rect x="86" y="23" width="33" height="33" rx="6" class="accent" />
    <rect x="36" y="70" width="30" height="30" rx="6" class="accent" />
    <rect x="84" y="74" width="20" height="20" rx="4" class="accent" />
    <circle cx="124" cy="83" r="10" class="accent" />
  </g>`;
}

function renderProfileStyles(): string {
  return `
    .card { --surface:#edf4ff; --text:#17365d; --muted:#456181; --accent:#2866ac; --track:#d0dff2; --chip:#dfeafa; --line:#bed1e8; }
    .card-dark { --surface:#193b74; --text:#fff5e4; --muted:#bfd8ef; --accent:#7bc6ff; --track:#102e60; --chip:#244981; --line:#4975a5; }
    @media (prefers-color-scheme: dark) { .card-auto { --surface:#193b74; --text:#fff5e4; --muted:#bfd8ef; --accent:#7bc6ff; --track:#102e60; --chip:#244981; --line:#4975a5; } }
    text { font-family:${font}; fill:var(--text); }
    .surface { fill:var(--surface); }
    .brand { font-size:20px; font-weight:750; }
    .username { font-size:21px; font-weight:650; }
    .cover-title { font-size:34px; font-weight:800; letter-spacing:-1px; }
    .metric { font-size:15px; font-weight:600; }
    .value { font-size:15px; font-weight:700; text-anchor:end; font-variant-numeric:tabular-nums; }
    .checked { font-size:12px; font-weight:600; fill:var(--muted); text-anchor:end; }
    .caption { font-size:12px; font-weight:600; fill:var(--muted); }
    .footer { font-size:12px; font-weight:500; fill:var(--muted); }
    .divider { stroke:var(--line); stroke-width:1; }
    .track { fill:var(--track); }
    .bar,.accent { fill:var(--accent); }
    .emblem-stroke { stroke:var(--accent); }
    .chip-bg { fill:var(--chip); }
    .chip { font-size:12px; font-weight:600; }
  `;
}
