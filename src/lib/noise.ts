// Seeded randomness + 2D gradient noise for procedural generation.

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeNoise2D(seed: number) {
  const rnd = mulberry32(seed);
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grad = (h: number, x: number, y: number) => {
    const g = h & 7;
    const u = g < 4 ? x : y;
    const v = g < 4 ? y : x;
    return (g & 1 ? -u : u) + (g & 2 ? -2 * v : 2 * v);
  };
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const noise = (x: number, y: number) => {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = fade(x);
    const v = fade(y);
    const a = perm[X] + Y;
    const b = perm[X + 1] + Y;
    return (
      lerp(
        lerp(grad(perm[a], x, y), grad(perm[b], x - 1, y), u),
        lerp(grad(perm[a + 1], x, y - 1), grad(perm[b + 1], x - 1, y - 1), u),
        v
      ) * 0.35
    );
  };

  const fbm = (x: number, y: number, oct = 4) => {
    let s = 0;
    let a = 0.5;
    let f = 1;
    for (let i = 0; i < oct; i++) {
      s += a * noise(x * f, y * f);
      f *= 2.03;
      a *= 0.5;
    }
    return s;
  };

  return { noise, fbm };
}
