import * as THREE from "three";

/**
 * Superformula presets (m, n1, n2, n3). Kept in ranges where the radius stays
 * bounded, and m even so the shape closes seamlessly at theta = ±PI.
 */
export const PRESETS: [number, number, number, number][] = [
  [0, 1, 1, 1], // 0 sphere
  [4, 1, 1, 1], // 1 soft octahedron
  [6, 0.35, 1.6, 1.6], // 2 six-point star
  [4, 8, 8, 8], // 3 rounded cube
  [8, 0.6, 1, 1], // 4 eight-petal flower
  [12, 0.25, 1.3, 1.3], // 5 spiky urchin
  [2, 0.8, 0.6, 1.6], // 6 lens / drop
  [6, 1.5, 3, 3], // 7 bulgy hexagon
  [12, 15, 18, 18], // 8 gear with rounded teeth
];

const noise = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
`;

const vertex = /* glsl */ `
uniform float uTime;
uniform float uAmp;
uniform float uFreq;
uniform float uSeed;
uniform float uMorph;
uniform float uExcite;
uniform vec3 uTouch;     // object-space direction of the lantern
uniform vec4 uA1; uniform vec4 uA2; uniform vec4 uB1; uniform vec4 uB2;
uniform float uTwist;   // spiral twist around the vertical axis
uniform vec2 uStretch;  // (horizontal, vertical) scale
uniform float uTaper;   // narrows towards the top (drop / spindle)
uniform float uSpikes;  // crystal points
uniform float uLobes;   // soft petals / buds
varying vec3 vNormal;
varying vec3 vWorld;
varying vec3 vObj;
varying float vNoise;
${noise}

// evenly spread directions on a sphere, rotated by the seed
vec3 fib(float i, float n, float seed){
  float y = 1.0 - (i + 0.5) / n * 2.0;
  float r = sqrt(max(0.0, 1.0 - y * y));
  float ph = i * 2.39996 + seed * 6.2831;
  return vec3(cos(ph) * r, y, sin(ph) * r);
}

float sf(float a, vec4 p){
  if (p.x < 0.5) return 1.0;
  float t1 = pow(abs(cos(p.x * a * 0.25)), p.z);
  float t2 = pow(abs(sin(p.x * a * 0.25)), p.w);
  return min(pow(max(t1 + t2, 1e-4), -1.0 / p.y), 3.0);
}

vec3 shape(vec3 d){
  float th = atan(d.z, d.x);
  float ph = asin(clamp(d.y, -1.0, 1.0));
  float r1 = mix(sf(th, uA1), sf(th, uB1), uMorph);
  float r2 = mix(sf(ph, uA2), sf(ph, uB2), uMorph);
  return vec3(r1 * cos(th) * r2 * cos(ph), r2 * sin(ph), r1 * sin(th) * r2 * cos(ph));
}

float field(vec3 d){
  float t = uTime * 0.25 + uSeed * 10.0;
  float n = snoise(d * uFreq + vec3(t, t * 0.6, -t));
  n += 0.35 * snoise(d * uFreq * 2.4 - vec3(t * 1.4));
  float m = smoothstep(0.6, 1.0, dot(d, normalize(uTouch)));
  return n * (uAmp + uExcite * 0.1) + m * uExcite * 0.25;
}

vec3 surf(vec3 d){
  vec3 s = shape(d);
  float k = 1.0;
  if (uLobes > 0.0) {
    float lob = 0.0;
    for (int i = 0; i < 6; i++) lob += pow(max(dot(d, fib(float(i), 6.0, uSeed)), 0.0), 5.0);
    k += uLobes * lob * 0.6;
  }
  if (uSpikes > 0.0) {
    float sp = 0.0;
    for (int i = 0; i < 10; i++) sp = max(sp, pow(max(dot(d, fib(float(i), 10.0, uSeed + 0.37)), 0.0), 36.0));
    k += uSpikes * sp;
  }
  s = s * k + d * field(d);
  s.y *= uStretch.y;
  s.xz *= uStretch.x * (1.0 - uTaper * clamp(s.y, -1.5, 1.5) * 0.4);
  float a = uTwist * s.y;
  float c = cos(a);
  float sn = sin(a);
  s.xz = vec2(c * s.x - sn * s.z, sn * s.x + c * s.z);
  return s;
}

void main(){
  vec3 d = normalize(position);
  vec3 t = normalize(cross(d, abs(d.y) > 0.99 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0)));
  vec3 b = normalize(cross(d, t));
  float e = 0.012;
  vec3 p0 = surf(d);
  vec3 p1 = surf(normalize(d + t * e));
  vec3 p2 = surf(normalize(d + b * e));
  // degenerate at the poles of some forms: fall back to the sphere normal instead of NaN
  vec3 cr = cross(p1 - p0, p2 - p0);
  float cl = length(cr);
  vec3 n = cl > 1e-7 ? cr / cl : d;
  if (dot(n, d) < 0.0) n = -n;

  vNoise = field(d) / max(uAmp, 0.001) * 0.25;
  vObj = p0;
  vNormal = normalize(normalMatrix * n);
  vec4 world = modelMatrix * vec4(p0, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const fragment = /* glsl */ `
uniform float uTime;
uniform float uHue;
uniform float uOpacity;
uniform float uGlow;
uniform float uWire;
uniform vec3 uWireColor;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uStyle;   // 0 iridescent · 1 ice · 2 gold · 3 velvet · 4 hologram · 5 pixels · 6 jelly · 7 chrome bands
uniform vec3 uColA;     // light / primary colour
uniform vec3 uColB;     // deep colour
varying vec3 vNormal;
varying vec3 vWorld;
varying vec3 vObj;
varying float vNoise;
${noise}

vec3 pal(float t){
  return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67) + uHue));
}
float h31(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float gridLine(float x, float w){ float f = fract(x); return 1.0 - smoothstep(0.0, w, min(f, 1.0 - f)); }

void main(){
  float d = length(cameraPosition - vWorld);
  float fog = clamp(1.0 - exp(-pow(uFogDensity * 0.55 * d, 2.0)), 0.0, 1.0);
  if (uWire > 0.5) {
    gl_FragColor = vec4(mix(uWireColor, uFogColor, fog), uOpacity);
    return;
  }
  vec3 N = vNormal / max(length(vNormal), 1e-5);
  vec3 V = normalize(cameraPosition - vWorld);
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float fres = pow(clamp(1.0 - ndv, 0.0, 1.0), 2.2);
  vec3 L1 = normalize(vec3(0.6, 0.9, 0.7));
  vec3 L2 = normalize(vec3(-0.8, -0.3, 0.4));
  vec3 R = reflect(-V, N);
  float spec = pow(max(dot(reflect(-L1, N), V), 0.0), 48.0);
  int st = int(uStyle + 0.5);
  vec3 col;
  float alpha = 1.0;
  vec3 tint = uColA;

  if (st == 1) {
    // ice crystal: faceted, cold rim, inner glitter
    vec3 Nf = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
    if (dot(Nf, V) < 0.0) Nf = -Nf;
    float f = pow(1.0 - clamp(dot(Nf, V), 0.0, 1.0), 1.5);
    col = mix(uColB * 0.3, uColA, f) + uColA * 0.12;
    col += vec3(1.0) * pow(max(dot(reflect(-L1, Nf), V), 0.0), 90.0) * 1.4;
    vec3 gc = floor(vObj * 38.0);
    col += vec3(0.9, 0.97, 1.0) * step(0.982, h31(gc)) * (0.5 + 0.5 * sin(uTime * 3.0 + h31(gc + 3.1) * 30.0));
    alpha = 0.93;
  } else if (st == 2) {
    // brushed gold: fake environment reflection with a bright horizon band
    float env = smoothstep(-0.35, 0.75, R.y);
    vec3 sky = mix(uColB * 0.22, uColA * 1.15, env);
    float band = exp(-pow(R.y * 5.0, 2.0));
    float brushed = 0.86 + 0.14 * sin(vObj.y * 90.0 + vNoise * 8.0);
    col = sky * brushed + vec3(1.0, 0.94, 0.78) * band * 0.45;
    col += vec3(1.0, 0.95, 0.85) * pow(max(dot(R, L1), 0.0), 70.0) * 1.3;
  } else if (st == 3) {
    // velvet: soft wrap light, glowing sheen at grazing angles, no gloss
    float w = dot(N, L1) * 0.5 + 0.5;
    col = uColB * (0.22 + 0.62 * w * w) + uColA * pow(1.0 - ndv, 2.6) * 1.15;
  } else if (st == 4) {
    // hologram blueprint: grid in object space, scanlines, see-through
    vec3 q = vObj * 7.0;
    float g = max(max(gridLine(q.x, 0.06), gridLine(q.y, 0.06)), gridLine(q.z, 0.06));
    float scan = 0.5 + 0.5 * sin(vObj.y * 42.0 - uTime * 3.0);
    col = uColA * (0.06 + g * 0.85 + fres * 0.55) + uColB * (0.12 + scan * 0.2);
    alpha = clamp(0.22 + g * 0.7 + fres * 0.55, 0.0, 1.0);
  } else if (st == 5) {
    // pixel mosaic: a living screen of cells with dark grout
    vec3 c = floor(vObj * 9.0);
    vec3 fc = fract(vObj * 9.0);
    float h = h31(c);
    float edge = min(min(min(fc.x, 1.0 - fc.x), min(fc.y, 1.0 - fc.y)), min(fc.z, 1.0 - fc.z));
    float grout = smoothstep(0.02, 0.07, edge);
    float on = step(0.35, fract(h * 7.3 + floor(uTime * 1.2 + h * 10.0) * 0.37));
    col = mix(uColB, uColA, h) * (0.3 + 0.95 * on) * (0.25 + 0.75 * grout) + uColA * fres * 0.35;
  } else if (st == 6) {
    // jelly: translucent body, glowing veins drifting inside
    float vein = pow(1.0 - abs(snoise(vObj * 2.6 + vec3(0.0, uTime * 0.25, 0.0))), 10.0);
    col = uColB * 0.32 + uColA * vein * 1.35 + uColA * fres * 0.8 + vec3(1.0) * spec * 0.5;
    alpha = clamp(0.5 + fres * 0.35 + vein * 0.25, 0.0, 1.0);
  } else if (st == 7) {
    // chrome with travelling bands, like a conveyor
    float env = smoothstep(-0.25, 0.55, R.y);
    vec3 base = mix(vec3(0.04, 0.045, 0.06), vec3(0.88, 0.9, 0.95), env);
    float bands = smoothstep(0.42, 0.5, fract(vObj.y * 5.0 - uTime * 0.6)) * (1.0 - smoothstep(0.82, 0.9, fract(vObj.y * 5.0 - uTime * 0.6)));
    col = mix(base, uColA * (0.35 + base), bands * 0.85);
    col += vec3(1.0) * pow(max(dot(R, L1), 0.0), 120.0) * 1.4;
  } else {
    // iridescent oil film (the original wonder)
    vec3 irid = pal(fres * 1.1 + vNoise * 0.9 + uTime * 0.03);
    float diff = max(dot(N, L1), 0.0);
    float spec2 = pow(max(dot(reflect(-L2, N), V), 0.0), 20.0);
    vec3 lime = vec3(0.78, 1.0, 0.18);
    col = mix(vec3(0.025, 0.022, 0.04), irid, 0.12 + fres * 0.95);
    col += irid * diff * 0.12 + vec3(1.0) * spec * 0.9 + lime * spec2 * 0.45;
    col += lime * smoothstep(0.25, 0.5, vNoise) * 0.2;
    tint = irid;
  }

  col += tint * uGlow * (0.3 + 0.7 * fres) * (st == 0 ? 1.0 : 0.55);

  // far creatures are tiny on screen: cap their brightness so they cannot sparkle through bloom
  col = mix(col, min(col, vec3(0.6)), smoothstep(6.0, 16.0, d));
  col = mix(col, uFogColor, fog);
  gl_FragColor = vec4(pow(max(col, vec3(0.0)), vec3(0.9)), clamp(alpha * uOpacity, 0.0, 1.0));
}
`;

export const FOG_COLOR = new THREE.Color("#070b18");
export const FOG_DENSITY = 0.05;

const v4 = (i: number) => new THREE.Vector4(...PRESETS[i % PRESETS.length]);

export function makeCreatureMaterial(opts: {
  hue: number;
  form: { a: [number, number]; b: [number, number] };
  seed?: number;
  amp?: number;
  freq?: number;
  wire?: string;
  style?: number;
  colA?: string;
  colB?: string;
  twist?: number;
  stretch?: [number, number];
  taper?: number;
  spikes?: number;
  lobes?: number;
}) {
  const style = opts.style ?? 0;
  const seeThrough = style === 4 || style === 6;
  return new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: {
      uTime: { value: 0 },
      uAmp: { value: opts.amp ?? 0.16 },
      uFreq: { value: opts.freq ?? 0.9 },
      uSeed: { value: opts.seed ?? 0 },
      uMorph: { value: 0 },
      uExcite: { value: 0 },
      uTouch: { value: new THREE.Vector3(0, 0, 1) },
      uA1: { value: v4(opts.form.a[0]) },
      uA2: { value: v4(opts.form.a[1]) },
      uB1: { value: v4(opts.form.b[0]) },
      uB2: { value: v4(opts.form.b[1]) },
      uHue: { value: opts.hue },
      uOpacity: { value: 1 },
      uGlow: { value: 0.25 },
      uWire: { value: opts.wire ? 1 : 0 },
      uWireColor: { value: new THREE.Color(opts.wire ?? "#ffffff") },
      uFogColor: { value: FOG_COLOR },
      uFogDensity: { value: FOG_DENSITY },
      uStyle: { value: style },
      uColA: { value: new THREE.Color(opts.colA ?? "#ffffff") },
      uColB: { value: new THREE.Color(opts.colB ?? "#333355") },
      uTwist: { value: opts.twist ?? 0 },
      uStretch: { value: new THREE.Vector2(...(opts.stretch ?? [1, 1])) },
      uTaper: { value: opts.taper ?? 0 },
      uSpikes: { value: opts.spikes ?? 0 },
      uLobes: { value: opts.lobes ?? 0 },
    },
    transparent: true,
    depthWrite: !seeThrough,
    side: style === 4 ? THREE.DoubleSide : THREE.FrontSide,
    wireframe: !!opts.wire,
  });
}

/** Shared sphere geometries — the shader sculpts every form from them. */
const geoCache = new Map<number, THREE.BufferGeometry>();
export function sphereGeo(detail: number) {
  if (!geoCache.has(detail)) geoCache.set(detail, new THREE.IcosahedronGeometry(1, detail));
  return geoCache.get(detail)!;
}

/** Soft radial glow texture for halos. */
let glowTex: THREE.Texture | null = null;
export function getGlowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.25, "rgba(255,255,255,0.35)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

/** Vertical light beam texture for wonder beacons. */
let beamTex: THREE.Texture | null = null;
export function getBeamTexture() {
  if (beamTex) return beamTex;
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 256;
  const g = c.getContext("2d")!;
  const h = g.createLinearGradient(0, 0, 64, 0);
  h.addColorStop(0, "rgba(255,255,255,0)");
  h.addColorStop(0.5, "rgba(255,255,255,1)");
  h.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = h;
  g.fillRect(0, 0, 64, 256);
  g.globalCompositeOperation = "destination-in";
  const v = g.createLinearGradient(0, 0, 0, 256);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(0.7, "rgba(0,0,0,0.8)");
  v.addColorStop(1, "rgba(0,0,0,1)");
  g.fillStyle = v;
  g.fillRect(0, 0, 64, 256);
  beamTex = new THREE.CanvasTexture(c);
  return beamTex;
}

/** Material for a whole species: texture, palette and silhouette in one go. */
export function speciesMaterial(sp: import("@/lib/species").Species, seed = 0) {
  return makeCreatureMaterial({
    hue: seed,
    form: sp.form,
    seed,
    amp: sp.amp,
    style: sp.style,
    colA: sp.colA,
    colB: sp.colB,
    twist: sp.twist,
    stretch: sp.stretch,
    taper: sp.taper,
    spikes: sp.spikes,
    lobes: sp.lobes,
  });
}
