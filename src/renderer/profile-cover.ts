import { type SignalType } from "../shared/types.js";

interface CoverPalette {
  surface: string;
  text: string;
  muted: string;
  accent: string;
  secondary: string;
  track: string;
  chip: string;
  line: string;
}

interface ProfileCover {
  id: string;
  lines: readonly [string, string];
  serif: boolean;
  light: CoverPalette;
  dark: CoverPalette;
}

const covers = {
  "Maintainer-Builder": {
    id: "built-to-last", lines: ["Built to", "Last"], serif: true,
    light: { surface: "#edf5ee", text: "#173b2e", muted: "#466953", accent: "#26744c", secondary: "#a47727", track: "#d1e3d5", chip: "#dcecdf", line: "#bed5c5" },
    dark: { surface: "#0b211c", text: "#f3f0df", muted: "#b2c9bb", accent: "#9ce3b1", secondary: "#e9ca72", track: "#294a3d", chip: "#18392d", line: "#426250" }
  },
  "Productized Builder": {
    id: "ready-to-use", lines: ["Ready", "to Use"], serif: false,
    light: { surface: "#fff2e9", text: "#342844", muted: "#755b68", accent: "#ba4816", secondary: "#d27c2e", track: "#f0d8c9", chip: "#f9e2d3", line: "#e9c9b7" },
    dark: { surface: "#171d37", text: "#fff4e6", muted: "#bdc4d9", accent: "#ff9c61", secondary: "#ffcf95", track: "#303954", chip: "#29314c", line: "#4c5877" }
  },
  Builder: {
    id: "well-rounded", lines: ["Well", "Rounded"], serif: false,
    light: { surface: "#f1edfa", text: "#30224b", muted: "#685880", accent: "#7251ae", secondary: "#575cbe", track: "#dcd2ee", chip: "#e5dcf4", line: "#cfc1e4" },
    dark: { surface: "#221c36", text: "#fff3e7", muted: "#c8bade", accent: "#bbabff", secondary: "#8d91f9", track: "#453958", chip: "#362b4b", line: "#65547d" }
  },
  "Steady Shipper": {
    id: "ships-steadily", lines: ["Ships", "Steadily"], serif: false,
    light: { surface: "#e9f5f6", text: "#123944", muted: "#416772", accent: "#14717a", secondary: "#5c7622", track: "#c8e2e5", chip: "#d9ecee", line: "#b5d7db" },
    dark: { surface: "#0d2831", text: "#fff5e4", muted: "#aecdd3", accent: "#65dbdf", secondary: "#daf787", track: "#20515e", chip: "#153e49", line: "#41737c" }
  },
  "Well-Documented Project": {
    id: "easy-to-pick-up", lines: ["Easy to", "Pick Up"], serif: true,
    light: { surface: "#f4eedf", text: "#203044", muted: "#6b6260", accent: "#ac513d", secondary: "#dbc9a9", track: "#e0d7c6", chip: "#ebe1cf", line: "#d3c8b5" },
    dark: { surface: "#292b36", text: "#f4eedf", muted: "#c9beb6", accent: "#f1a58d", secondary: "#d8c6a4", track: "#4d454a", chip: "#3c3740", line: "#6e6064" }
  },
  "General Signal Profile": {
    id: "project-snapshot", lines: ["Project", "Snapshot"], serif: false,
    light: { surface: "#edf4ff", text: "#17365d", muted: "#456181", accent: "#2866ac", secondary: "#987124", track: "#d0dff2", chip: "#dfeafa", line: "#bed1e8" },
    dark: { surface: "#193b74", text: "#fff5e4", muted: "#bfd8ef", accent: "#7bc6ff", secondary: "#ffe578", track: "#102e60", chip: "#244981", line: "#4975a5" }
  }
} satisfies Record<SignalType, ProfileCover>;

export function getProfileCover(type: SignalType): ProfileCover {
  return Object.hasOwn(covers, type) ? covers[type] : covers["General Signal Profile"];
}

export function renderCoverStyles(cover: ProfileCover): string {
  const palette = (value: CoverPalette) => Object.entries(value)
    .map(([key, color]) => `--${key}:${color};`).join("");
  return `.card { ${palette(cover.light)} }
    .card-dark { ${palette(cover.dark)} }
    @media (prefers-color-scheme: dark) { .card-auto { ${palette(cover.dark)} } }`;
}

export function renderCoverArtwork(cover: ProfileCover): string {
  let shapes: string;
  switch (cover.id) {
    case "built-to-last":
      shapes = `<g class="accent">
        <path d="M24 54 56 37 56 117 24 134Z" />
        <path d="M24 54 56 37 127 77 95 95Z" />
        <path d="M95 95 127 77 127 127 95 145Z" />
        <path d="M98 24 131 6 203 46 170 64Z" />
        <path d="M170 64 203 46 203 123 170 141Z" />
      </g><path d="M98 24 131 42 131 89 98 71Z" class="secondary" />
      <path d="M131 89 153 77 153 132 131 144Z" class="secondary" />
      <path d="M10 146 115 88 220 147M10 106 115 164 220 106" class="art-line" />`;
      break;
    case "ready-to-use":
      shapes = `<path d="M33 56 111 18 189 56 111 95Z" class="secondary" />
      <path d="M33 56v69l78 39V95Z" class="accent" />
      <path d="M111 95v69l78-39V56Z" class="accent" opacity=".75" />
      <path d="M33 56 0 35 78 0 111 18 144 0 222 35 189 56 156 36 111 58 66 36Z" class="secondary" />
      <path d="m132 112 12 10 23-26" fill="none" class="art-ink" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />`;
      break;
    case "well-rounded":
      shapes = [0, 60, 120, 180, 240, 300].map((angle, index) =>
        `<path d="M93 5q5-3 10 0l20 12q5 3 5 9v23l-30 17-30-17V26q0-6 5-9Z" transform="rotate(${angle} 98 77)" class="${index % 2 === 0 ? "accent" : "secondary"}" />`
      ).join("");
      break;
    case "ships-steadily":
      shapes = [0, 36, 72].map((offset) => `<g transform="translate(0 ${offset})">
        <path d="M0 63C35 63 41 38 83 38S138 10 201 10" class="emblem-stroke" fill="none" stroke-width="12" stroke-linecap="round" />
        <g class="art-ink" fill="none" stroke-width="3"><circle cx="62" cy="42" r="7" /><circle cx="125" cy="29" r="7" /></g>
        <circle cx="201" cy="10" r="10" class="secondary" />
      </g>`).join("");
      break;
    case "easy-to-pick-up":
      shapes = `<path d="M8 27q47-9 99 17 52-26 99-17v113q-47-9-99 12-52-21-99-12Z" class="accent" />
      <path d="M20 14q43 1 87 27 44-26 87-27v113q-43 1-87 25-44-24-87-25Z" class="secondary" />
      <path d="M33 1q38 7 74 36v115q-36-28-74-32Zm148 0q-38 7-74 36v115q36-28 74-32Z" class="art-page" />
      <path d="M47 37q22 6 45 20M47 58q22 6 45 20M47 79q22 6 45 20M122 57q22-14 44-20M122 78q22-14 44-20M122 99q22-14 44-20" class="art-ink" fill="none" stroke-width="3" />
      <path d="m139 14 22-9v80l-11-6-11 15Z" class="accent" />`;
      break;
    default:
      shapes = `<path d="M9 38V14a8 8 0 0 1 8-8h24M185 38V14a8 8 0 0 0-8-8h-24M9 110v24a8 8 0 0 0 8 8h24M185 110v24a8 8 0 0 1-8 8h-24" fill="none" class="emblem-stroke" stroke-width="12" stroke-linecap="round" />
      <circle cx="65" cy="50" r="20" class="secondary" />
      <rect x="104" y="30" width="39" height="39" rx="6" class="accent" />
      <rect x="44" y="88" width="34" height="34" rx="6" class="accent" />
      <rect x="98" y="94" width="23" height="23" rx="4" class="secondary" />
      <circle cx="148" cy="105" r="12" class="accent" />`;
  }
  return `<g transform="translate(52 191) scale(.8)" aria-hidden="true">${shapes}</g>`;
}
