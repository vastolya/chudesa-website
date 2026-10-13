// Procedural winter forest: terrain, biomes, lakes, trails, props — all from one seed.
import { makeNoise2D, mulberry32 } from "./noise";
import { landmarks, SPAWN, WORLD_R, wonders } from "./forest";
import { randomSpecies, type Species } from "./species";

export type PropKind = "spruce" | "fir" | "pine" | "birch" | "dead" | "bush" | "rock" | "stump";
export const PROP_KINDS: PropKind[] = ["spruce", "fir", "pine", "birch", "dead", "bush", "rock", "stump"];
export type Prop = { kind: PropKind; x: number; z: number; s: number; rot: number; tint: number };
export type Pt = { x: number; z: number };
export type Lake = { x: number; z: number; r: number; y: number };
export type CreatureSpec = {
  x: number;
  y: number;
  z: number;
  size: number;
  hue: number;
  seed: number;
  color: string;
  ring: boolean;
  morphSpeed: number;
  drift: number;
  form: { a: [number, number]; b: [number, number] };
  species: Species;
};

export type World = {
  seed: number;
  height: (x: number, z: number) => number;
  pathDist: (x: number, z: number) => number;
  paths: Pt[][];
  lakes: Lake[];
  props: Prop[];
  lamps: (Pt & { side: number })[];
  creatures: CreatureSpec[];
  colliders: (x: number, z: number) => { x: number; z: number; r: number }[];
};

const COLORS = ["#7af0ff", "#c8ff2e", "#ff7ad9", "#8f7bff", "#ffd36a", "#a8ffcf", "#ffa25c"];
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
};

function segDist(px: number, pz: number, a: Pt, b: Pt) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const l2 = dx * dx + dz * dz || 1;
  const t = Math.min(Math.max(((px - a.x) * dx + (pz - a.z) * dz) / l2, 0), 1);
  return Math.hypot(px - (a.x + dx * t), pz - (a.z + dz * t));
}

let current: World | null = null;
export const getWorld = () => current!;

export function generateWorld(seed: number): World {
  const rnd = mulberry32(seed);
  const { noise, fbm } = makeNoise2D(seed);

  /* ── points of interest ── */
  const pois: (Pt & { r: number })[] = [{ x: SPAWN.x, z: SPAWN.z, r: 7 }];
  const place = (minD: number, maxD: number, clear: number) => {
    for (let i = 0; i < 400; i++) {
      const a = rnd() * Math.PI * 2;
      const d = minD + rnd() * (maxD - minD);
      const x = SPAWN.x + Math.cos(a) * d;
      const z = SPAWN.z + Math.sin(a) * d;
      if (Math.hypot(x, z) > WORLD_R - 8) continue;
      if (pois.every((p) => Math.hypot(p.x - x, p.z - z) > Math.max(p.r, clear) + 12)) {
        pois.push({ x, z, r: clear });
        return { x, z };
      }
    }
    const a = rnd() * Math.PI * 2;
    pois.push({ x: Math.cos(a) * maxD, z: Math.sin(a) * maxD, r: clear });
    return pois[pois.length - 1];
  };
  for (const l of landmarks) {
    const p = l.id === "final" ? place(50, 62, l.r) : place(26, 58, l.r);
    l.x = p.x;
    l.z = p.z;
  }
  for (const w of wonders) {
    const p = place(14, 62, w.mech === "orbit" ? 6 : 5);
    w.x = p.x;
    w.z = p.z;
  }

  /* ── frozen lakes ── */
  const lakes: Lake[] = [];
  for (let i = 0; i < 40 && lakes.length < 2; i++) {
    const a = rnd() * Math.PI * 2;
    const d = 22 + rnd() * 42;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const r = 8 + rnd() * 6;
    if (pois.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + r + 4)) continue;
    if (lakes.some((l) => Math.hypot(l.x - x, l.z - z) < l.r + r + 10)) continue;
    lakes.push({ x, z, r, y: 0 });
  }

  /* ── terrain ── */
  const base = (x: number, z: number) => fbm(x * 0.016, z * 0.016, 4) * 10 + fbm(x * 0.07 + 40, z * 0.07, 2) * 1.1;
  const flats = [
    ...pois.map((p) => ({ x: p.x, z: p.z, r: p.r + 2, y: base(p.x, p.z), depth: 0 })),
    ...lakes.map((l) => ({ x: l.x, z: l.z, r: l.r, y: base(l.x, l.z), depth: 0.6 })),
  ];
  lakes.forEach((l, i) => (l.y = flats[pois.length + i].y - 0.45));
  const height = (x: number, z: number) => {
    let h = base(x, z);
    for (const f of flats) {
      const d = Math.hypot(x - f.x, z - f.z);
      if (d < f.r + 8) {
        const w = smooth(f.r + 8, f.r, d);
        h = h + (f.y - f.depth * smooth(f.r, f.r * 0.4, d) - h) * w;
      }
    }
    const r = Math.hypot(x, z);
    // gentle rise past the walkable edge (a steep wall read as a giant disc in the sky)
    if (r > WORLD_R) h += 7 * smooth(WORLD_R, WORLD_R + 30, r);
    return h;
  };

  /* ── trails: minimum spanning tree over the points of interest ── */
  const nodes = pois.map((p) => ({ x: p.x, z: p.z }));
  const inTree = new Set([0]);
  const edges: [number, number][] = [];
  while (inTree.size < nodes.length) {
    let best: [number, number] | null = null;
    let bd = Infinity;
    for (const i of inTree)
      for (let j = 0; j < nodes.length; j++) {
        if (inTree.has(j)) continue;
        const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].z - nodes[j].z);
        if (d < bd) {
          bd = d;
          best = [i, j];
        }
      }
    edges.push(best!);
    inTree.add(best![1]);
  }
  // one extra loop so the network is not a pure tree
  if (nodes.length > 4) edges.push([1, nodes.length - 1]);

  const paths: Pt[][] = edges.map(([i, j], k) => {
    const a = nodes[i];
    const b = nodes[j];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const nx = -(b.z - a.z) / len;
    const nz = (b.x - a.x) / len;
    const steps = Math.max(8, Math.round(len / 2.5));
    const pts: Pt[] = [];
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const off = (noise(t * 2.2 + k * 7.3, k * 3.1) * 0.9 + noise(t * 6 + k, 9.1) * 0.25) * len * 0.35 * Math.sin(Math.PI * t);
      pts.push({ x: a.x + (b.x - a.x) * t + nx * off, z: a.z + (b.z - a.z) * t + nz * off });
    }
    return pts;
  });
  const segs: [Pt, Pt][] = paths.flatMap((p) => p.slice(1).map((q, i) => [p[i], q] as [Pt, Pt]));
  const pathDist = (x: number, z: number) => {
    let m = Infinity;
    for (const [a, b] of segs) {
      if (Math.abs(a.x - x) > 12 && Math.abs(b.x - x) > 12) continue;
      m = Math.min(m, segDist(x, z, a, b));
    }
    return m;
  };

  /* ── lamps along trails ── */
  const lamps: (Pt & { side: number })[] = [];
  paths.forEach((p) => {
    let acc = 6;
    for (let i = 1; i < p.length; i++) {
      const dx = p[i].x - p[i - 1].x;
      const dz = p[i].z - p[i - 1].z;
      const l = Math.hypot(dx, dz);
      acc += l;
      if (acc > 16) {
        acc = rnd() * 4;
        const side = lamps.length % 2 ? 1 : -1;
        lamps.push({ x: p[i].x - (dz / l) * 1.5 * side, z: p[i].z + (dx / l) * 1.5 * side, side });
      }
    }
  });

  /* ── vegetation & rocks by biome ── */
  const props: Prop[] = [];
  const CELL = 2.7;
  const pick = (b: number, r: number): PropKind => {
    const table: [PropKind, number][] =
      b < -0.1
        ? [["birch", 0.5], ["spruce", 0.15], ["bush", 0.2], ["dead", 0.07], ["rock", 0.05], ["stump", 0.03]]
        : b < 0.14
          ? [["spruce", 0.42], ["fir", 0.36], ["bush", 0.1], ["stump", 0.05], ["rock", 0.04], ["dead", 0.03]]
          : [["pine", 0.45], ["rock", 0.22], ["fir", 0.1], ["dead", 0.1], ["bush", 0.13]];
    let acc = 0;
    for (const [k, w] of table) {
      acc += w;
      if (r < acc) return k;
    }
    return table[0][0];
  };
  for (let gx = -112; gx < 112; gx += CELL)
    for (let gz = -112; gz < 112; gz += CELL) {
      const x = gx + rnd() * CELL;
      const z = gz + rnd() * CELL;
      const r = Math.hypot(x, z);
      if (r > 112) continue;
      const dens = fbm(x * 0.045 + 50, z * 0.045 - 20, 3);
      const p = Math.min(Math.max(0.42 + dens * 2.2, 0.06), 0.88);
      if (rnd() > p) continue;
      const pd = pathDist(x, z);
      if (pd < 1.9) continue;
      if (pois.some((q) => Math.hypot(q.x - x, q.z - z) < q.r)) continue;
      if (lakes.some((l) => Math.hypot(l.x - x, l.z - z) < l.r + 0.8)) continue;
      const biome = fbm(x * 0.011 + 100, z * 0.011 - 60, 3);
      let kind = pick(biome, rnd());
      // trail edges prefer low things
      if (pd < 3.2 && (kind === "spruce" || kind === "fir" || kind === "pine")) kind = rnd() < 0.5 ? "bush" : "rock";
      const big = kind === "rock" ? 0.5 + rnd() * 1.1 : kind === "bush" ? 0.6 + rnd() * 0.6 : 0.75 + Math.pow(rnd(), 1.3) * 1.5;
      props.push({ kind, x, z, s: big, rot: rnd() * Math.PI * 2, tint: 0.82 + rnd() * 0.3 });
    }
  // the orbit wonder circles a lone fir
  const auto = wonders.find((w) => w.mech === "orbit")!;
  props.push({ kind: "fir", x: auto.x, z: auto.z, s: 1.5, rot: 0, tint: 1 });

  /* ── colliders (spatial hash) ── */
  const hash = new Map<string, { x: number; z: number; r: number }[]>();
  const key = (cx: number, cz: number) => `${cx},${cz}`;
  for (const p of props) {
    if (p.kind === "bush") continue;
    const r = p.kind === "rock" ? 0.7 * p.s : p.kind === "stump" ? 0.35 : 0.3 + p.s * 0.25;
    const k = key(Math.floor(p.x / 4), Math.floor(p.z / 4));
    if (!hash.has(k)) hash.set(k, []);
    hash.get(k)!.push({ x: p.x, z: p.z, r });
  }
  const colliders = (x: number, z: number) => {
    const cx = Math.floor(x / 4);
    const cz = Math.floor(z / 4);
    const out: { x: number; z: number; r: number }[] = [];
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) out.push(...(hash.get(key(cx + i, cz + j)) ?? []));
    return out;
  };

  /* ── floating creatures ── */
  const creatures: CreatureSpec[] = [];
  for (let i = 0; i < 64; i++) {
    const a = rnd() * Math.PI * 2;
    const d = 6 + Math.sqrt(rnd()) * (WORLD_R - 4);
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const kind = rnd();
    const size = kind < 0.12 ? 1.4 + rnd() * 1.4 : kind < 0.5 ? 0.35 + rnd() * 0.5 : 0.08 + rnd() * 0.2;
    const ci = Math.floor(rnd() * COLORS.length);
    creatures.push({
      x,
      z,
      y: height(x, z) + (kind < 0.12 ? 7 + rnd() * 7 : 0.9 + rnd() * 3.5),
      size,
      hue: ci / COLORS.length + rnd() * 0.1,
      seed: rnd(),
      color: COLORS[ci],
      ring: size > 0.6 && rnd() < 0.45,
      morphSpeed: 0.08 + rnd() * 0.25,
      drift: size < 0.3 ? 1.5 + rnd() * 2 : 0.4,
      form: {
        a: [Math.floor(rnd() * 8), rnd() < 0.6 ? 0 : Math.floor(rnd() * 8)],
        b: [Math.floor(rnd() * 8), rnd() < 0.6 ? 0 : Math.floor(rnd() * 8)],
      },
      species: randomSpecies(rnd),
    });
  }

  current = { seed, height, pathDist, paths, lakes, props, lamps, creatures, colliders };
  return current;
}
