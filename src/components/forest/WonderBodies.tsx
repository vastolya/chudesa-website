"use client";

import { useFrame } from "@react-three/fiber";
import { forwardRef, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { GLSL_COMMON, shader, type Drive } from "./wonderGlsl";

/*
 * Seven bodies, one per service. Each is about 1 unit in radius.
 * References (approach only, own implementation):
 *  research   — refraction + chromatic dispersion (drei MeshTransmissionMaterial / three.js dispersion example)
 *  strategy   — "plexus" constellation: points linked under a distance threshold
 *  packaging  — foil sticker: thin-film iridescence + procedural metallic flakes
 *  prototype  — hologram: fresnel + scanlines + vertex glitch (Three.js Journey "hologram shader")
 *  web        — pixels → voxels assembling into a form (Codrops pixel-to-voxel)
 *  content    — bioluminescent jellyfish: pulsing bell, Voronoi veins, noise-driven tentacles
 *  automation — torus knot with streams flowing endlessly along the tube (animated mesh lines)
 */

type BodyProps = { drive: Drive; fog: boolean; colA: string; colB: string; cheap?: boolean };
const asleep = (d: Drive) => d.active === false;

/** keep shared uniforms of a set of materials in step with the drive */
function useDriven(mats: THREE.ShaderMaterial[], drive: Drive, opacityScale = 1) {
  useFrame((state) => {
    if (asleep(drive)) return;
    for (const m of mats) {
      m.uniforms.uTime.value = state.clock.elapsedTime;
      m.uniforms.uOpacity.value = drive.opacity * opacityScale;
      m.uniforms.uGlow.value = drive.glow;
    }
  });
}

/* ───────── research: a brilliant-cut prism splitting light into a spectrum ───────── */
function Prism({ drive, fog, colA }: BodyProps) {
  const geo = useMemo(() => {
    const prof = [
      new THREE.Vector2(0.0001, -1.15),
      new THREE.Vector2(1.0, -0.02),
      new THREE.Vector2(1.0, 0.1),
      new THREE.Vector2(0.62, 0.48),
      new THREE.Vector2(0.0001, 0.48),
    ];
    const g = new THREE.LatheGeometry(prof, 10).toNonIndexed();
    g.computeVertexNormals(); // flat facets
    return g;
  }, []);
  const mat = useMemo(
    () =>
      shader({
        fog,
        uniforms: { uTint: { value: new THREE.Color(colA) } },
        fragment: /* glsl */ `
          ${GLSL_COMMON}
          uniform vec3 uTint;
          varying vec3 vW; varying vec3 vN; varying vec3 vP;
          vec3 bend(vec3 I, vec3 N, float eta){ vec3 r = refract(I, N, eta); return dot(r, r) < 1e-4 ? reflect(I, N) : r; }
          void main(){
            vec3 N = normalize(vN);
            vec3 V = normalize(cameraPosition - vW);
            vec3 I = -V;
            float ndv = clamp(dot(N, V), 0.0, 1.0);
            // each colour bends differently: the spectrum fans out on the facets
            // a second "inner bounce" off a tilted facet multiplies the fire
            vec3 Ni = normalize(N + (vec3(hash13(floor(N * 9.0)), hash13(floor(N * 9.0) + 3.1), hash13(floor(N * 9.0) + 7.7)) - 0.5) * 0.8);
            vec3 col = vec3(envStudio(bend(I, Ni, 1.0 / 1.9)).r, envStudio(bend(I, Ni, 1.0 / 2.4)).g, envStudio(bend(I, Ni, 1.0 / 3.0)).b);
            col += vec3(envStudio(bend(I, N, 1.0 / 2.0)).r, envStudio(bend(I, N, 1.0 / 2.42)).g, envStudio(bend(I, N, 1.0 / 2.9)).b);
            col *= mix(vec3(1.0), uTint, 0.3) * 1.25;
            col += uTint * 0.12;
            float fr = 0.06 + pow(1.0 - ndv, 3.0) * 0.9;
            col = mix(col, envStudio(reflect(I, N)), fr);
            // facet fire
            float h = hash13(floor(N * 9.0));
            col += thinFilm(ndv, 2.0 + h * 2.0) * 0.35 * h;
            col += vec3(1.0) * pow(max(dot(reflect(I, N), normalize(vec3(0.5, 0.8, 0.3))), 0.0), 220.0) * 2.5;
            col += uTint * uGlow * 0.25;
            gl_FragColor = vec4(fogIt(col, vW), uOpacity);
          }`,
      }),
    [fog, colA]
  );
  useDriven([mat], drive);
  return <mesh geometry={geo} material={mat} rotation={[0.25, 0, 0]} />;
}

/* ───────── strategy: a constellation where scattered points become one route ───────── */
function Constellation({ drive, fog, colA, colB }: BodyProps) {
  const data = useMemo(() => {
    const n = 64;
    let s = 3;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      const y = 1 - ((i + 0.5) / n) * 2;
      const rr = Math.sqrt(1 - y * y);
      const ph = i * 2.39996;
      pts.push(new THREE.Vector3(Math.cos(ph) * rr, y, Math.sin(ph) * rr).multiplyScalar(0.92 + r() * 0.16));
    }
    // web of near neighbours
    const web: number[] = [];
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++)
        if (pts[i].distanceTo(pts[j]) < 0.5) web.push(...pts[i].toArray(), ...pts[j].toArray());
    // the route: greedy walk through nearest unvisited stars
    const route = [0];
    const used = new Set([0]);
    while (route.length < 11) {
      const last = pts[route[route.length - 1]];
      let best = -1;
      let bd = Infinity;
      pts.forEach((p, k) => {
        if (used.has(k)) return;
        const d = p.distanceTo(last);
        if (d > 0.25 && d < bd) {
          bd = d;
          best = k;
        }
      });
      route.push(best);
      used.add(best);
    }
    const rPos: number[] = [];
    const rProg: number[] = [];
    route.slice(1).forEach((k, i) => {
      rPos.push(...pts[route[i]].toArray(), ...pts[k].toArray());
      rProg.push(i / (route.length - 1), (i + 1) / (route.length - 1));
    });
    const sizes = pts.map((_, k) => (used.has(k) ? 1.8 : 0.8 + r() * 0.6));
    const isRoute = pts.map((_, k) => (used.has(k) ? 1 : 0));
    return { pts, web, rPos, rProg, sizes, isRoute };
  }, []);

  const webGeo = useMemo(() => new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(data.web, 3)), [data]);
  const routeGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(data.rPos, 3));
    g.setAttribute("aProg", new THREE.Float32BufferAttribute(data.rProg, 1));
    return g;
  }, [data]);
  const starGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(data.pts.flatMap((p) => p.toArray()), 3));
    g.setAttribute("aSize", new THREE.Float32BufferAttribute(data.sizes, 1));
    g.setAttribute("aRoute", new THREE.Float32BufferAttribute(data.isRoute, 1));
    return g;
  }, [data]);

  const lineVert = /* glsl */ `
    attribute float aProg; varying float vProg; varying vec3 vW;
    void main(){ vProg = aProg; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
  const mats = useMemo(() => {
    const web = shader({
      fog,
      additive: true,
      vertex: lineVert,
      uniforms: { uC: { value: new THREE.Color(colB) } },
      fragment: `${GLSL_COMMON} uniform vec3 uC; varying vec3 vW; void main(){ gl_FragColor = vec4(fogIt(uC * 1.1, vW), uOpacity * 0.85); }`,
    });
    const route = shader({
      fog,
      additive: true,
      vertex: lineVert,
      uniforms: { uC: { value: new THREE.Color(colA) } },
      fragment: `${GLSL_COMMON} uniform vec3 uC; varying float vProg; varying vec3 vW;
        void main(){
          float head = fract(uTime * 0.18);
          float pulse = exp(-pow((vProg - head) * 14.0, 2.0));
          float lit = step(vProg, head + 0.02);
          vec3 c = uC * (0.35 + 0.65 * lit + pulse * 2.2);
          gl_FragColor = vec4(fogIt(c, vW), uOpacity);
        }`,
    });
    const stars = shader({
      fog,
      additive: true,
      vertex: /* glsl */ `
        uniform float uTime; uniform float uPx; attribute float aSize; attribute float aRoute; varying float vRoute; varying float vTw; varying vec3 vW;
        void main(){
          vRoute = aRoute;
          vTw = 0.6 + 0.4 * sin(uTime * 2.0 + position.x * 13.0 + position.y * 7.0);
          vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
          vec4 mv = viewMatrix * w;
          float sc = length(modelMatrix[0].xyz);
          gl_PointSize = clamp(aSize * 0.055 * sc * projectionMatrix[1][1] * uPx / -mv.z, 1.0, 64.0);
          gl_Position = projectionMatrix * mv;
        }`,
      uniforms: { uA: { value: new THREE.Color(colA) }, uB: { value: new THREE.Color("#dfe7ff") }, uPx: { value: 500 } },
      fragment: `${GLSL_COMMON} uniform vec3 uA; uniform vec3 uB; varying float vRoute; varying float vTw; varying vec3 vW;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d);
          a = a * a;
          vec3 c = mix(uB, uA, vRoute) * (1.0 + vRoute) * vTw;
          gl_FragColor = vec4(fogIt(c, vW), a * uOpacity);
        }`,
    });
    const core = shader({
      fog,
      fragment: `${GLSL_COMMON} varying vec3 vW; varying vec3 vN;
        void main(){
          vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW);
          vec3 c = vec3(1.0, 0.85, 0.5) * (0.9 + envStudio(reflect(-V, N)) * 0.9) + vec3(1.0, 0.9, 0.6) * pow(1.0 - abs(dot(N, V)), 2.0);
          gl_FragColor = vec4(fogIt(c, vW), uOpacity);
        }`,
    });
    return { web, route, stars, core };
  }, [fog, colA, colB, lineVert]);
  useDriven([mats.web, mats.route, mats.stars, mats.core], drive);
  const g = useRef<THREE.Group>(null!);
  useFrame((state, dt) => {
    if (asleep(drive)) return;
    g.current.rotation.y += dt * 0.12;
    mats.stars.uniforms.uPx.value = state.gl.domElement.height * 0.5;
  });
  return (
    <group ref={g}>
      <lineSegments geometry={webGeo} material={mats.web} />
      <lineSegments geometry={routeGeo} material={mats.route} />
      <points geometry={starGeo} material={mats.stars} />
      <mesh material={mats.core}>
        <icosahedronGeometry args={[0.16, 4]} />
      </mesh>
    </group>
  );
}

/* ───────── packaging: a gift wrapped in iridescent foil with a satin gold ribbon ───────── */
const FOIL_FRAG = /* glsl */ `
  ${GLSL_COMMON}
  uniform vec3 uTint; uniform float uAlpha;
  varying vec3 vW; varying vec3 vN; varying vec3 vP;
  void main(){
    vec3 N = normalize(vN);
    vec3 V = normalize(cameraPosition - vW);
    float ndv = clamp(dot(N, V), 0.0, 1.0);
    vec3 film = thinFilm(ndv, 2.6 + sin(vP.x * 2.0 + vP.y * 3.0) * 0.4);
    // metallic flakes: each cell tilts its own tiny mirror
    vec3 cell = floor(vP * 34.0);
    float h = hash13(cell);
    vec3 fn = normalize(N + (vec3(h, hash13(cell + 1.3), hash13(cell + 2.7)) - 0.5) * 0.9);
    float flake = pow(max(dot(reflect(-V, fn), normalize(vec3(0.5, 0.8, 0.35))), 0.0), 70.0) * step(0.55, h);
    vec3 env = envStudio(reflect(-V, N));
    vec3 col = mix(uTint * 0.5, film, 0.55) * (0.45 + env * 0.55) + flake * 1.6 + pow(1.0 - ndv, 3.0) * film * 0.6;
    col += uTint * uGlow * 0.25;
    gl_FragColor = vec4(fogIt(col, vW), uOpacity * uAlpha);
  }`;
const GOLD_FRAG = /* glsl */ `
  ${GLSL_COMMON}
  varying vec3 vW; varying vec3 vN;
  void main(){
    vec3 N = normalize(vN);
    vec3 V = normalize(cameraPosition - vW);
    vec3 env = envStudio(reflect(-V, N));
    vec3 gold = vec3(1.0, 0.78, 0.38);
    vec3 col = gold * (0.18 + env * 0.95) + vec3(1.0, 0.95, 0.85) * pow(max(dot(reflect(-V, N), normalize(vec3(0.5, 0.8, 0.3))), 0.0), 90.0);
    gl_FragColor = vec4(fogIt(col, vW), uOpacity);
  }`;

function FoilGift({ drive, fog, colA }: BodyProps) {
  const box = useMemo(() => new RoundedBoxGeometry(1.5, 1.5, 1.5, 5, 0.2), []);
  const band1 = useMemo(() => new RoundedBoxGeometry(1.56, 1.56, 0.3, 3, 0.06), []);
  const band2 = useMemo(() => new RoundedBoxGeometry(0.3, 1.56, 1.56, 3, 0.06), []);
  const foil = useMemo(() => shader({ fog, fragment: FOIL_FRAG, uniforms: { uTint: { value: new THREE.Color(colA) }, uAlpha: { value: 1 } } }), [fog, colA]);
  const gold = useMemo(() => shader({ fog, fragment: GOLD_FRAG }), [fog]);
  useDriven([foil, gold], drive);
  return (
    <group>
      <mesh geometry={box} material={foil} />
      <mesh geometry={band1} material={gold} />
      <mesh geometry={band2} material={gold} />
      {[-1, 1].map((s) => (
        <mesh key={s} material={gold} position={[s * 0.27, 0.95, 0]} rotation={[Math.PI / 2, s * 0.35, 0]} scale={[1, 1, 0.8]}>
          <torusGeometry args={[0.26, 0.07, 20, 48]} />
        </mesh>
      ))}
      <mesh material={gold} position={[0, 0.85, 0]}>
        <sphereGeometry args={[0.12, 24, 16]} />
      </mesh>
    </group>
  );
}

/** a foil "wrapping layer" bubble, peeled off one click at a time */
export const FoilLayer = forwardRef<THREE.Mesh, { drive: Drive; fog: boolean; colA: string; radius: number }>(function FoilLayer({ drive, fog, colA, radius }, ref) {
  const mat = useMemo(() => {
    const m = shader({ fog, fragment: FOIL_FRAG, double: true, depthWrite: false, uniforms: { uTint: { value: new THREE.Color(colA) }, uAlpha: { value: 0.32 } } });
    return m;
  }, [fog, colA]);
  useDriven([mat], drive);
  return (
    <mesh ref={ref} material={mat}>
      <sphereGeometry args={[radius, 48, 32]} />
    </mesh>
  );
});

/* ───────── prototype: a hologram — fresnel, scanlines, glitches, a projector below ───────── */
function Hologram({ drive, fog, colA }: BodyProps) {
  const geo = useMemo(() => new THREE.TorusKnotGeometry(0.58, 0.19, 220, 28, 2, 3), []);
  const holo = useMemo(
    () =>
      shader({
        fog,
        additive: true,
        double: true,
        uniforms: { uC: { value: new THREE.Color(colA) } },
        vertex: /* glsl */ `
          uniform float uTime;
          varying vec3 vW; varying vec3 vN;
          float r2(vec2 c){ return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
          void main(){
            vec4 w = modelMatrix * vec4(position, 1.0);
            // short glitch bursts slice the model sideways
            float burst = smoothstep(0.92, 1.0, sin(uTime * 1.7) * sin(uTime * 0.53 + 1.0));
            float slice = r2(vec2(floor(w.y * 18.0), floor(uTime * 12.0)));
            w.x += (slice - 0.5) * 0.12 * burst;
            w.z += (r2(vec2(slice, 3.1)) - 0.5) * 0.12 * burst;
            vW = w.xyz;
            vN = normalize(mat3(modelMatrix) * normal);
            gl_Position = projectionMatrix * viewMatrix * w;
          }`,
        fragment: /* glsl */ `
          ${GLSL_COMMON}
          uniform vec3 uC;
          varying vec3 vW; varying vec3 vN;
          void main(){
            vec3 N = normalize(vN);
            if (!gl_FrontFacing) N = -N;
            vec3 V = normalize(cameraPosition - vW);
            float fres = pow(1.0 - abs(dot(V, N)), 2.0);
            float stripes = pow(fract(vW.y * 22.0 - uTime * 0.6), 3.0);
            float holo = stripes * fres + fres * 1.1 + 0.05;
            float flicker = 0.85 + 0.15 * sin(uTime * 37.0) * sin(uTime * 13.0);
            vec3 c = uC * holo * flicker * (1.0 + uGlow * 0.4);
            gl_FragColor = vec4(fogIt(c, vW), clamp(holo, 0.0, 1.0) * uOpacity);
          }`,
      }),
    [fog, colA]
  );
  const beam = useMemo(
    () =>
      shader({
        fog,
        additive: true,
        double: true,
        uniforms: { uC: { value: new THREE.Color(colA) } },
        fragment: `${GLSL_COMMON} uniform vec3 uC; varying vec3 vW; varying vec2 vUv;
          void main(){ float a = pow(vUv.y, 1.8) * 0.35 * (0.8 + 0.2 * sin(uTime * 9.0)); gl_FragColor = vec4(fogIt(uC * a, vW), a * uOpacity); }`,
      }),
    [fog, colA]
  );
  const ring = useMemo(
    () =>
      shader({
        fog,
        additive: true,
        uniforms: { uC: { value: new THREE.Color(colA) } },
        fragment: `${GLSL_COMMON} uniform vec3 uC; varying vec3 vW; void main(){ gl_FragColor = vec4(fogIt(uC * 1.2, vW), uOpacity * 0.8); }`,
      }),
    [fog, colA]
  );
  useDriven([holo, beam, ring], drive);
  const knot = useRef<THREE.Mesh>(null!);
  useFrame((_, dt) => {
    if (!asleep(drive)) knot.current.rotation.y += dt * 0.5;
  });
  return (
    <group>
      <mesh ref={knot} geometry={geo} material={holo} />
      {/* projector: a light cone rising from a glowing ring */}
      <mesh material={beam} position={[0, -0.55, 0]}>
        <cylinderGeometry args={[1.05, 0.55, 1.1, 48, 1, true]} />
      </mesh>
      <mesh material={ring} position={[0, -1.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.55, 0.02, 8, 64]} />
      </mesh>
    </group>
  );
}

/* ───────── web: a sphere of glowing voxels assembling itself, pixel by pixel ───────── */
function Voxels({ drive, fog, colA, colB, cheap = false }: BodyProps) {
  const { geo, count } = useMemo(() => {
    const step = cheap ? 0.17 : 0.13;
    const targets: number[] = [];
    const rand: number[] = [];
    let s = 9;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let x = -1; x <= 1; x += step)
      for (let y = -1; y <= 1; y += step)
        for (let z = -1; z <= 1; z += step) {
          const l = Math.hypot(x, y, z);
          if (l > 0.8 && l < 0.94) {
            targets.push(x, y, z);
            rand.push(r());
          }
        }
    const sz = step * 0.86;
    const g = new RoundedBoxGeometry(sz, sz, sz, cheap ? 1 : 2, sz * 0.2);
    const ig = new THREE.InstancedBufferGeometry().copy(g as unknown as THREE.InstancedBufferGeometry);
    ig.setAttribute("aTarget", new THREE.InstancedBufferAttribute(new Float32Array(targets), 3));
    ig.setAttribute("aRand", new THREE.InstancedBufferAttribute(new Float32Array(rand), 1));
    ig.instanceCount = rand.length;
    return { geo: ig, count: rand.length };
  }, [cheap]);
  const mat = useMemo(
    () =>
      shader({
        fog,
        uniforms: { uA: { value: new THREE.Color(colA) }, uB: { value: new THREE.Color(colB) }, uBuild: { value: 0 }, uHalf: { value: (cheap ? 0.17 : 0.13) * 0.43 } },
        vertex: /* glsl */ `
          uniform float uTime; uniform float uBuild;
          attribute vec3 aTarget; attribute float aRand;
          varying vec3 vW; varying vec3 vL; varying float vWave; varying float vR; varying vec3 vT;
          void main(){
            float b = smoothstep(aRand * 0.7, aRand * 0.7 + 0.3, uBuild);
            vec3 dir = normalize(aTarget + vec3(aRand - 0.5, aRand * 0.3, 0.2));
            float wave = sin(dot(aTarget, normalize(vec3(0.3, 1.0, 0.2))) * 5.0 - uTime * 2.0);
            vec3 p = position * (0.55 + 0.45 * b) + aTarget * (1.0 + 0.035 * wave) + dir * (1.0 - b) * 1.6;
            vL = position; vWave = wave; vR = aRand; vT = aTarget;
            vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz;
            gl_Position = projectionMatrix * viewMatrix * w;
          }`,
        fragment: /* glsl */ `
          ${GLSL_COMMON}
          uniform vec3 uA; uniform vec3 uB; uniform float uHalf;
          varying vec3 vW; varying vec3 vL; varying float vWave; varying float vR; varying vec3 vT;
          void main(){
            vec3 a = abs(vL) / uHalf;
            // glowing cube edges: where two of the three local coords are near the surface
            float m1 = max(a.x, max(a.y, a.z));
            float m2 = a.x + a.y + a.z - m1 - min(a.x, min(a.y, a.z));
            float edge = smoothstep(0.78, 0.95, m2);
            vec3 base = mix(uB, uA, smoothstep(-1.0, 1.0, vT.y) * 0.7 + vR * 0.3);
            float lit = 0.35 + 0.65 * smoothstep(0.3, 1.0, vWave);
            vec3 col = base * (0.5 + 0.6 * lit) + uA * edge * (0.9 + lit) + uA * uGlow * 0.25;
            gl_FragColor = vec4(fogIt(col, vW), uOpacity);
          }`,
      }),
    [fog, colA, colB, cheap]
  );
  useDriven([mat], drive);
  const s = useRef({ b: 0 });
  useFrame((_, dt) => {
    if (asleep(drive)) return;
    // assembles while visible, falls apart when hidden
    s.current.b += ((drive.opacity > 0.3 ? 1.05 : 0) - s.current.b) * (1 - Math.exp(-dt * 1.2));
    mat.uniforms.uBuild.value = s.current.b;
  });
  return <mesh geometry={geo} material={mat} frustumCulled={false} userData={{ count }} />;
}

/* ───────── content: a bioluminescent jellyfish ───────── */
const JELLY_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uPhase;
  varying vec3 vW; varying vec3 vN; varying vec3 vP;
  void main(){
    vec3 p = position;
    float t = uTime * 1.6 + uPhase;
    float rim = 1.0 - smoothstep(-0.1, 0.9, p.y);       // 1 at the rim, 0 at the top
    float pulse = sin(t) * 0.5 + 0.5;
    p.xz *= 1.0 + 0.16 * pulse * rim - 0.05 * (1.0 - pulse);
    p.y *= 1.0 - 0.1 * pulse;
    p.y -= rim * rim * 0.12 * (1.0 - pulse);           // the skirt flares
    vP = p;
    vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const JELLY_FRAG = /* glsl */ `
  ${GLSL_COMMON}
  uniform vec3 uA; uniform vec3 uB;
  varying vec3 vW; varying vec3 vN; varying vec3 vP;
  void main(){
    vec3 N = normalize(vN);
    if (!gl_FrontFacing) N = -N;
    vec3 V = normalize(cameraPosition - vW);
    float fres = pow(1.0 - abs(dot(N, V)), 2.0);
#ifdef CHEAP
    float wv = sin(vP.x * 9.0 + uTime) * sin(vP.y * 11.0 - uTime * 0.7) * sin(vP.z * 10.0 + 1.3);
    float veins = smoothstep(0.75, 0.98, abs(wv) * 1.6);
#else
    float e = voronoiEdge(vP * 3.2);
    float veins = 1.0 - smoothstep(0.0, 0.09, e);
#endif
    float crown = smoothstep(0.1, 0.9, vP.y);
    vec3 col = uB * 0.25 + uA * veins * 1.2 + uA * fres * 0.9 + uA * crown * 0.25;
    col += uA * uGlow * 0.3;
    float a = clamp(0.28 + fres * 0.5 + veins * 0.4, 0.0, 1.0);
    gl_FragColor = vec4(fogIt(col, vW), a * uOpacity);
  }`;

function jellyMaterial(fog: boolean, colA: string, colB: string, phase: number, cheap: boolean) {
  return shader({
    fog,
    defines: cheap ? { CHEAP: "" } : {},
    double: true,
    depthWrite: false,
    vertex: JELLY_VERT,
    fragment: JELLY_FRAG,
    uniforms: { uA: { value: new THREE.Color(colA) }, uB: { value: new THREE.Color(colB) }, uPhase: { value: phase } },
  });
}
const bellGeo = (w: number, h: number) => new THREE.SphereGeometry(1, w, h, 0, Math.PI * 2, 0, Math.PI * 0.56);

function Jellyfish({ drive, fog, colA, colB, cheap = false }: BodyProps) {
  const bell = useMemo(() => (cheap ? bellGeo(32, 16) : bellGeo(56, 28)), [cheap]);
  const mat = useMemo(() => jellyMaterial(fog, colA, colB, 0, cheap), [fog, colA, colB, cheap]);
  const T = 10;
  const SEG = 28;
  const tent = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(T * (SEG - 1) * 2 * 3);
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  const tentMat = useMemo(
    () =>
      shader({
        fog,
        additive: true,
        vertex: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
        uniforms: { uC: { value: new THREE.Color(colA) } },
        fragment: `${GLSL_COMMON} uniform vec3 uC; varying vec3 vW; void main(){ gl_FragColor = vec4(fogIt(uC, vW), 0.7 * uOpacity); }`,
      }),
    [fog, colA]
  );
  useDriven([mat, tentMat], drive);
  useFrame((state) => {
    if (asleep(drive)) return;
    const t = state.clock.elapsedTime;
    const pulse = Math.sin(t * 1.6) * 0.5 + 0.5;
    const arr = tent.attributes.position.array as Float32Array;
    let o = 0;
    for (let i = 0; i < T; i++) {
      const a = (i / T) * Math.PI * 2;
      const r0 = 0.82 * (1 + 0.16 * pulse);
      let px = Math.cos(a) * r0;
      let py = -0.12;
      let pz = Math.sin(a) * r0;
      for (let k = 1; k < SEG; k++) {
        const f = k / SEG;
        // drift and curl, stronger toward the tips (noise-driven tentacles)
        const nx = Math.cos(a) * r0 * (1 - f * 0.55) + Math.sin(t * 1.3 + i * 1.7 + f * 4) * 0.18 * f;
        const ny = -0.12 - f * (1.9 + (i % 3) * 0.25);
        const nz = Math.sin(a) * r0 * (1 - f * 0.55) + Math.cos(t * 1.1 + i * 2.3 + f * 5) * 0.18 * f;
        arr.set([px, py, pz, nx, ny, nz], o);
        o += 6;
        px = nx;
        py = ny;
        pz = nz;
      }
    }
    tent.attributes.position.needsUpdate = true;
  });
  return (
    <group position={[0, 0.45, 0]}>
      <mesh geometry={bell} material={mat} />
      <lineSegments geometry={tent} material={tentMat} frustumCulled={false} />
    </group>
  );
}

/** small jelly for the content swarm (bell only) */
const miniBell = bellGeo(20, 10);
export const MiniJelly = forwardRef<THREE.Group, { drive: Drive; fog: boolean; colA: string; colB: string; phase: number; scale: number }>(function MiniJelly(
  { drive, fog, colA, colB, phase, scale },
  ref
) {
  // swarm members are tiny on screen: always the cheap veins
  const mat = useMemo(() => jellyMaterial(fog, colA, colB, phase, true), [fog, colA, colB, phase]);
  useDriven([mat], drive, 1);
  return (
    <group ref={ref} scale={scale}>
      <mesh geometry={miniBell} material={mat} />
    </group>
  );
});

/* ───────── automation: a chrome torus knot with streams flowing endlessly along it ───────── */
function FlowKnot({ drive, fog, colA, cheap = false }: BodyProps) {
  const P = 3;
  const Q = 5;
  const R = 0.62;
  const geo = useMemo(() => new THREE.TorusKnotGeometry(R, 0.15, cheap ? 180 : 320, cheap ? 16 : 32, P, Q), [cheap]);
  const mat = useMemo(
    () =>
      shader({
        fog,
        uniforms: { uC: { value: new THREE.Color(colA) } },
        fragment: /* glsl */ `
          ${GLSL_COMMON}
          uniform vec3 uC;
          varying vec3 vW; varying vec3 vN; varying vec2 vUv;
          void main(){
            vec3 N = normalize(vN);
            vec3 V = normalize(cameraPosition - vW);
            vec3 chrome = envStudio(reflect(-V, N)) * 0.9 + vec3(0.03, 0.035, 0.05);
            // streams running along the tube, forever
            float s = fract(vUv.x * 9.0 - uTime * 0.35);
            float stream = smoothstep(0.0, 0.04, s) * (1.0 - smoothstep(0.18, 0.3, s));
            float lane = smoothstep(0.35, 0.5, abs(fract(vUv.y * 2.0) - 0.5) * 2.0);
            vec3 col = chrome * (1.0 - stream * 0.6) + uC * stream * (1.6 + uGlow) * (0.4 + lane * 0.6);
            gl_FragColor = vec4(fogIt(col, vW), uOpacity);
          }`,
      }),
    [fog, colA]
  );
  // sparks travelling the same path
  const N = 36;
  const sparkGeo = useMemo(() => new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3)), []);
  const sparkMat = useMemo(
    () =>
      shader({
        fog,
        additive: true,
        uniforms: { uC: { value: new THREE.Color(colA) }, uPx: { value: 500 } },
        vertex: `uniform float uPx; varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mv = viewMatrix * w; float sc = length(modelMatrix[0].xyz); gl_PointSize = clamp(0.09 * sc * projectionMatrix[1][1] * uPx / -mv.z, 1.0, 48.0); gl_Position = projectionMatrix * mv; }`,
        fragment: `${GLSL_COMMON} uniform vec3 uC; varying vec3 vW; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(fogIt(uC * 1.6, vW), a * a * uOpacity); }`,
      }),
    [fog, colA]
  );
  useDriven([mat, sparkMat], drive);
  const knot = useRef<THREE.Group>(null!);
  useFrame((state, dt) => {
    if (asleep(drive)) return;
    knot.current.rotation.y += dt * 0.25;
    sparkMat.uniforms.uPx.value = state.gl.domElement.height * 0.5;
    const t = state.clock.elapsedTime;
    const arr = sparkGeo.attributes.position.array as Float32Array;
    for (let i = 0; i < N; i++) {
      const u = ((i / N + t * 0.06) % 1) * Math.PI * 2 * P;
      // same parametrisation as THREE.TorusKnotGeometry
      const cu = Math.cos(u);
      const su = Math.sin(u);
      const quOverP = (Q / P) * u;
      const cs = Math.cos(quOverP);
      arr[i * 3] = R * (2 + cs) * 0.5 * cu;
      arr[i * 3 + 1] = R * (2 + cs) * su * 0.5;
      arr[i * 3 + 2] = R * Math.sin(quOverP) * 0.5;
    }
    sparkGeo.attributes.position.needsUpdate = true;
  });
  return (
    <group ref={knot}>
      <mesh geometry={geo} material={mat} />
      <points geometry={sparkGeo} material={sparkMat} frustumCulled={false} />
    </group>
  );
}

/** The body of a wonder by its id. */
export function WonderBody({ id, drive, fog, colA, colB, cheap }: { id: string } & BodyProps) {
  const p = { drive, fog, colA, colB, cheap };
  switch (id) {
    case "research":
      return <Prism {...p} />;
    case "strategy":
      return <Constellation {...p} />;
    case "packaging":
      return <FoilGift {...p} />;
    case "prototype":
      return <Hologram {...p} />;
    case "web":
      return <Voxels {...p} />;
    case "content":
      return <Jellyfish {...p} />;
    default:
      return <FlowKnot {...p} />;
  }
}
