import { type ProfilePersona, type SignalDimension, type SignalType } from "../shared/types.js";
import { balancedPersonaLines, personaDefinitions } from "../shared/persona-catalog.js";

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

const personaCovers: Record<SignalDimension, SignalType> = {
  maintainability: "Maintainer-Builder", completeness: "Productized Builder",
  usability: "Well-Documented Project", shipping: "Steady Shipper",
  consistency: "Builder", stewardship: "General Signal Profile"
};

export function getProfileCover(type: SignalType, persona?: ProfilePersona): ProfileCover {
  const definition = personaDefinitions.find(candidate => candidate.id === persona?.id);
  if (definition !== undefined) return { ...covers[personaCovers[definition.highest]], lines: definition.lines };
  if (persona?.id === "balanced-builder") return { ...covers.Builder, lines: balancedPersonaLines };
  return Object.hasOwn(covers, type) ? covers[type] : covers["General Signal Profile"];
}

export function renderCoverStyles(cover: ProfileCover): string {
  const palette = (value: CoverPalette) => Object.entries(value)
    .map(([key, color]) => `--${key}:${color};`).join("");
  return `.card { ${palette(cover.light)} }
    .card-dark { ${palette(cover.dark)} }
    @media (prefers-color-scheme: dark) { .card-auto { ${palette(cover.dark)} } }`;
}
