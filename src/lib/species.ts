// Kinds of wonders: material ("texture"), palette, silhouette and a prop that carries meaning.

export type Accessory = "ring" | "atom" | "compass" | "ribbon" | "frame" | "pixels" | "orbiters" | "none";

export type Species = {
  name: string;
  style: number; // 0 iridescent · 1 ice · 2 gold · 3 velvet · 4 hologram · 5 pixels · 6 jelly · 7 chrome bands
  colA: string;
  colB: string;
  form: { a: [number, number]; b: [number, number] };
  twist?: number;
  stretch?: [number, number];
  taper?: number;
  spikes?: number;
  lobes?: number;
  amp?: number;
  accessory: Accessory;
  /** the glow / halo / sparkles colour */
  glow: string;
};

/** soft, magical palettes: [light, deep] */
export const PALETTES: [string, string][] = [
  ["#c9f6ff", "#3c6fd8"], // ice
  ["#8dffc0", "#5b3fd6"], // aurora
  ["#ffc27a", "#c2304f"], // ember
  ["#ffc6e6", "#8a4fd8"], // rose
  ["#e4ff7a", "#1fa889"], // lime
  ["#ffe6a3", "#9a5a1c"], // gold
  ["#a9b4ff", "#1c1f66"], // deep
  ["#fff3e3", "#a68cff"], // pearl
];

/** each service wonder has its own nature — the look tells what it is */
export const WONDER_SPECIES: Record<string, Species> = {
  // research: an ice crystal you can see straight through, with atom-like rings
  research: {
    name: "кристалл",
    style: 1,
    colA: "#d6f7ff",
    colB: "#2f62d0",
    form: { a: [5, 0], b: [2, 0] },
    spikes: 0.55,
    amp: 0.06,
    accessory: "atom",
    glow: "#9fe9ff",
  },
  // strategy: a golden compass star, one clear direction
  strategy: {
    name: "компас",
    style: 2,
    colA: "#ffe3a0",
    colB: "#8a4e12",
    form: { a: [2, 1], b: [2, 2] },
    stretch: [0.9, 1.25],
    amp: 0.04,
    accessory: "compass",
    glow: "#ffd36a",
  },
  // packaging: a velvet gift, tied with a golden ribbon
  packaging: {
    name: "подарок",
    style: 3,
    colA: "#ffc6e6",
    colB: "#8a2f78",
    form: { a: [3, 3], b: [3, 3] },
    amp: 0.05,
    accessory: "ribbon",
    glow: "#ff9ad6",
  },
  // prototype: a twisting blueprint hologram — not real yet
  prototype: {
    name: "чертёж",
    style: 4,
    colA: "#b8f5a0",
    colB: "#2fb8c8",
    form: { a: [4, 1], b: [7, 0] },
    twist: 1.6,
    stretch: [0.85, 1.25],
    amp: 0.08,
    accessory: "frame",
    glow: "#c8ff2e",
  },
  // web: a living screen made of pixels
  web: {
    name: "экран",
    style: 5,
    colA: "#b9a8ff",
    colB: "#2a2a8a",
    form: { a: [1, 1], b: [3, 1] },
    amp: 0.05,
    accessory: "pixels",
    glow: "#8f7bff",
  },
  // content: luminous jellyfish — lots of them, every day
  content: {
    name: "медуза",
    style: 6,
    colA: "#8dffd0",
    colB: "#3a2fa8",
    form: { a: [0, 6], b: [4, 6] },
    stretch: [1, 0.85],
    taper: 0.6,
    lobes: 0.6,
    amp: 0.14,
    accessory: "none",
    glow: "#a8ffcf",
  },
  // automation: a chrome gear, parts riding around it on their own
  automation: {
    name: "шестерёнка",
    style: 7,
    colA: "#ffb36b",
    colB: "#3a2a20",
    form: { a: [8, 6], b: [8, 6] },
    stretch: [1, 0.55],
    amp: 0.03,
    accessory: "orbiters",
    glow: "#ffa25c",
  },
};

/** the forest's ambient creatures: every one assembled from a random kind, palette and silhouette */
export function randomSpecies(r: () => number): Species {
  // only the clean, smooth textures for ambient creatures (no pixel grids, no wire grids)
  const styles = [0, 0, 0, 2, 3, 3, 6, 6];
  const style = styles[Math.floor(r() * styles.length)];
  const [colA, colB] = PALETTES[Math.floor(r() * PALETTES.length)];
  const P = 8; // no gear silhouette for ambient creatures
  const pick = () => Math.floor(r() * P);
  const silhouette = r();
  return {
    name: "",
    style,
    colA,
    colB,
    form: { a: [pick(), r() < 0.6 ? 0 : pick()], b: [pick(), r() < 0.6 ? 0 : pick()] },
    twist: silhouette < 0.25 ? 0.8 + r() * 2.2 : 0,
    stretch: silhouette > 0.75 ? [0.7 + r() * 0.3, 1.2 + r() * 0.6] : silhouette > 0.6 ? [1.2, 0.6 + r() * 0.2] : [1, 1],
    taper: r() < 0.25 ? 0.5 + r() * 0.6 : 0,
    spikes: 0,
    lobes: style === 6 || r() < 0.2 ? 0.3 + r() * 0.6 : 0,
    amp: style === 6 ? 0.14 + r() * 0.1 : 0.06 + r() * 0.14,
    accessory: r() < 0.3 ? "ring" : "none",
    glow: colA,
  };
}
