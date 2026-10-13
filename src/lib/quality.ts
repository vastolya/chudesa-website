import { create } from "zustand";

export type Tier = "minimal" | "low" | "medium" | "high";
const ORDER: Tier[] = ["minimal", "low", "medium", "high"];

export type QualitySettings = {
  dpr: number;
  shadows: boolean;
  shadowSize: number;
  softShadows: boolean;
  msaa: number;
  bloomScale: number; // bloom render resolution scale
  bloomLevels: number; // mip levels of the bloom blur
  drawDist: number; // props / creatures beyond this are not drawn (fog hides them anyway)
  wonderDist: number; // wonder bodies are drawn/animated only this close (beacons are always on)
  creatures: number; // how many ambient creatures exist
  creatureDetail: number; // multiplier for sphere tessellation
  detailFloor: number; // smallest sphere tessellation allowed
  cheap: boolean; // simplified shaders (one noise octave, no Voronoi veins, no snow glitter)
  snow: number; // falling flakes
  drift: number; // ground drift particles
  stars: number;
  auroras: number; // aurora ribbons in the sky
  groundTex: number; // size of the painted snow texture
  warmLight: boolean; // small point light on the hand lantern
};

export function settingsFor(tier: Tier, coarse: boolean): QualitySettings {
  const dev = typeof window !== "undefined" ? window.devicePixelRatio : 1;
  switch (tier) {
    case "high":
      return { dpr: Math.min(dev, 1.5), shadows: true, shadowSize: 2048, softShadows: true, msaa: 4, bloomScale: 0.75, bloomLevels: 8, drawDist: 82, wonderDist: 42, creatures: 64, creatureDetail: 1, detailFloor: 14, cheap: false, snow: 5000, drift: 1800, stars: 3500, auroras: 3, groundTex: 2048, warmLight: true };
    case "medium":
      return { dpr: Math.min(dev, coarse ? 1 : 1.15), shadows: true, shadowSize: 1024, softShadows: false, msaa: 0, bloomScale: 0.5, bloomLevels: 6, drawDist: 66, wonderDist: 36, creatures: 46, creatureDetail: 0.6, detailFloor: 12, cheap: false, snow: 3200, drift: 1000, stars: 2500, auroras: 3, groundTex: 2048, warmLight: true };
    case "low":
      return { dpr: coarse ? 0.85 : 0.8, shadows: !coarse, shadowSize: 1024, softShadows: false, msaa: 0, bloomScale: 0.4, bloomLevels: 5, drawDist: 54, wonderDist: 30, creatures: 30, creatureDetail: 0.4, detailFloor: 9, cheap: true, snow: 2000, drift: 500, stars: 1800, auroras: 2, groundTex: 1024, warmLight: false };
    default:
      // weakest machines and software rendering: keep the mood, drop the expensive bits
      return { dpr: coarse ? 0.7 : 0.65, shadows: false, shadowSize: 512, softShadows: false, msaa: 0, bloomScale: 0.3, bloomLevels: 4, drawDist: 46, wonderDist: 26, creatures: 18, creatureDetail: 0.3, detailFloor: 7, cheap: true, snow: 1200, drift: 250, stars: 1000, auroras: 1, groundTex: 1024, warmLight: false };
  }
}

/** Best guess from the hardware before the first frame. */
export function detectTier(): Tier {
  if (typeof window === "undefined") return "medium";
  const q = new URLSearchParams(window.location.search).get("q");
  if (q === "minimal" || q === "low" || q === "medium" || q === "high") return q;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  let renderer = "";
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    if (gl) {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      renderer = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {}
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8;
  if (/swiftshader|llvmpipe|software|basic render/i.test(renderer)) return "minimal";
  if (coarse) return /apple gpu|adreno \(tm\) [7-9]\d\d|mali-g7[1-9]|mali-g[7-9]\d\d/i.test(renderer) ? "medium" : "low";
  if (cores <= 2 || mem <= 2) return "minimal";
  if (/hd graphics [2-5]\d\d\b|intel\(r\) hd graphics$/i.test(renderer)) return "low";
  if (/intel|uhd|hd graphics|iris|radeon\(tm\) graphics|vega \d/i.test(renderer) || cores <= 4 || mem <= 4) return "medium";
  return "high";
}

type Q = {
  tier: Tier;
  coarse: boolean;
  s: QualitySettings;
  init: () => void;
  downgrade: () => boolean;
  /** the GPU dropped the WebGL context: step down at least once, and never stay above "low" */
  recover: () => void;
};

export const useQuality = create<Q>((set, get) => ({
  tier: "medium",
  coarse: false,
  s: settingsFor("medium", false),
  init: () => {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const tier = detectTier();
    set({ tier, coarse, s: settingsFor(tier, coarse) });
  },
  downgrade: () => {
    const i = ORDER.indexOf(get().tier);
    if (i <= 0) return false;
    const tier = ORDER[i - 1];
    set({ tier, s: settingsFor(tier, get().coarse) });
    return true;
  },
  recover: () => {
    const i = Math.max(0, Math.min(ORDER.indexOf(get().tier) - 1, ORDER.indexOf("low")));
    const tier = ORDER[i];
    set({ tier, s: settingsFor(tier, get().coarse) });
  },
}));
