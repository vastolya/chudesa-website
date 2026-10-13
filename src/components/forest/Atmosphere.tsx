"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { live, useQuest } from "@/lib/forest";
import { getWorld } from "@/lib/world";
import { mulberry32 } from "@/lib/noise";
import { getGlowTexture } from "./creatureMaterial";
import { useQuality } from "@/lib/quality";

export const FOG = "#0b1431";

/* ───────── sky dome ───────── */
const skyVert = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
const skyFrag = /* glsl */ `
uniform vec3 uMoonDir;
varying vec3 vDir;
void main(){
  float h = clamp(vDir.y, -0.2, 1.0);
  vec3 horizon = vec3(0.075, 0.115, 0.26);
  vec3 mid = vec3(0.03, 0.045, 0.11);
  vec3 zenith = vec3(0.008, 0.01, 0.03);
  vec3 col = mix(horizon, mid, smoothstep(0.0, 0.25, h));
  col = mix(col, zenith, smoothstep(0.25, 0.9, h));
  float m = max(dot(vDir, uMoonDir), 0.0);
  col += vec3(0.35, 0.45, 0.8) * pow(m, 18.0) * 0.5 + vec3(0.2, 0.3, 0.6) * pow(m, 4.0) * 0.12;
  gl_FragColor = vec4(col, 1.0);
}`;

const MOON_DIR = new THREE.Vector3(-0.45, 0.42, -0.79).normalize();

function SkyDome() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: skyVert,
        fragmentShader: skyFrag,
        uniforms: { uMoonDir: { value: MOON_DIR } },
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    []
  );
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(({ camera }) => ref.current.position.copy(camera.position));
  return (
    <mesh ref={ref} material={mat} renderOrder={-10}>
      <sphereGeometry args={[150, 32, 16]} />
    </mesh>
  );
}

/* ───────── aurora borealis ───────── */
const auroraVert = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
void main(){
  vUv = uv;
  vec3 p = position;
  p.z += sin(uv.x * 9.0 + uTime * 0.25) * 6.0 + sin(uv.x * 23.0 - uTime * 0.4) * 1.5;
  p.y += sin(uv.x * 5.0 + uTime * 0.15) * 4.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const auroraFrag = /* glsl */ `
uniform float uTime;
uniform vec3 uA;
uniform vec3 uB;
varying vec2 vUv;
void main(){
  float x = vUv.x;
  float rays = 0.5 + 0.5 * sin(x * 140.0 + sin(x * 11.0 + uTime * 0.12) * 6.0 + uTime * 0.15);
  rays = pow(clamp(rays, 0.0, 1.0), 2.5) * 0.7 + 0.3;
  float folds = 0.5 + 0.5 * sin(x * 17.0 - uTime * 0.2 + sin(x * 3.0 + uTime * 0.1) * 4.0);
  float fy = smoothstep(0.0, 0.12, vUv.y) * pow(clamp(1.0 - vUv.y, 0.0, 1.0), 1.6);
  float ends = smoothstep(0.0, 0.15, x) * smoothstep(1.0, 0.85, x);
  vec3 col = mix(uA, uB, smoothstep(0.15, 0.9, vUv.y));
  float a = rays * fy * ends * (0.35 + 0.65 * folds) * (0.75 + 0.25 * sin(uTime * 0.37 + x * 4.0));
  // kept well below the bloom threshold so it never tints the whole frame
  gl_FragColor = vec4(col * a * 0.42, a * 0.6);
}`;

function AuroraRibbon({ angle, radius, height, span, a, b, speed }: { angle: number; radius: number; height: number; span: number; a: string; b: string; speed: number }) {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1, 220, 1);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) + 0.5;
      const v = pos.getY(i) + 0.5;
      const ang = angle + (u - 0.5) * span;
      pos.setXYZ(i, Math.sin(ang) * radius, height + v * 32, -Math.cos(ang) * radius);
    }
    return g;
  }, [angle, radius, height, span]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: auroraVert,
        fragmentShader: auroraFrag,
        uniforms: { uTime: { value: 0 }, uA: { value: new THREE.Color(a) }, uB: { value: new THREE.Color(b) } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        fog: false,
      }),
    [a, b]
  );
  useFrame((s) => (mat.uniforms.uTime.value = s.clock.elapsedTime * speed));
  return <mesh geometry={geo} material={mat} frustumCulled={false} />;
}

function SkyObjects() {
  const stars = useQuality((x) => x.s.stars);
  const auroras = useQuality((x) => x.s.auroras);
  const group = useRef<THREE.Group>(null!);
  const glow = useMemo(() => getGlowTexture(), []);
  useFrame(({ camera }) => group.current.position.set(camera.position.x, 0, camera.position.z));
  const moon = MOON_DIR.clone().multiplyScalar(120);
  return (
    <group ref={group}>
      <Stars key={stars} radius={110} depth={30} count={stars} factor={3.2} fade speed={0.3} />
      <mesh position={moon}>
        <sphereGeometry args={[4.2, 32, 32]} />
        <meshBasicMaterial color={[1.6, 1.65, 1.8]} fog={false} toneMapped={false} />
      </mesh>
      <sprite position={moon} scale={[46, 46, 1]}>
        <spriteMaterial map={glow} color="#8fa9ff" transparent opacity={0.5} fog={false} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <AuroraRibbon angle={0.5} radius={125} height={38} span={1.6} a="#5dff8f" b="#7a5cff" speed={1} />
      {auroras > 1 && <AuroraRibbon angle={-0.2} radius={135} height={46} span={1.2} a="#c8ff2e" b="#ff7ad9" speed={0.8} />}
      {auroras > 2 && <AuroraRibbon angle={2.6} radius={130} height={42} span={1.3} a="#3dffd0" b="#8f7bff" speed={1.2} />}
    </group>
  );
}

/* ───────── moonlight: the shadow map is re-rendered only when you walk a few metres ───────── */
function Moonlight() {
  const light = useRef<THREE.DirectionalLight>(null!);
  const { scene } = useThree();
  const q = useQuality((x) => x.s);
  const last = useRef({ x: 1e9, z: 1e9 });
  const basis = useMemo(() => {
    const right = new THREE.Vector3().crossVectors(MOON_DIR, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, MOON_DIR).normalize();
    return { right, up, p: new THREE.Vector3(), c: new THREE.Vector3() };
  }, []);

  useEffect(() => {
    const t = light.current.target;
    scene.add(t);
    return () => void scene.remove(t);
  }, [scene]);

  // apply quality: map size / on-off (dispose the old map so the new size takes effect)
  useEffect(() => {
    const l = light.current;
    l.castShadow = q.shadows;
    l.shadow.mapSize.set(q.shadowSize, q.shadowSize);
    l.shadow.map?.dispose();
    (l.shadow as unknown as { map: THREE.WebGLRenderTarget | null }).map = null;
    l.shadow.autoUpdate = false;
    l.shadow.needsUpdate = true;
    last.current.x = 1e9;
  }, [q.shadows, q.shadowSize]);

  useFrame(() => {
    const l = last.current;
    // static casters only (trees, rocks) — so the map can stay put until we move far enough
    if (Math.hypot(live.x - l.x, live.z - l.z) < 4) return;
    l.x = live.x;
    l.z = live.z;
    // snap the centre to whole shadow texels in light space so edges never shimmer
    const step = (80 / q.shadowSize) * Math.round(4 / (80 / q.shadowSize));
    const { right, up, p, c } = basis;
    p.set(live.x, getWorld().height(live.x, live.z), live.z);
    c.copy(right)
      .multiplyScalar(Math.round(p.dot(right) / step) * step)
      .addScaledVector(up, Math.round(p.dot(up) / step) * step)
      .addScaledVector(MOON_DIR, p.dot(MOON_DIR));
    light.current.target.position.copy(c);
    light.current.position.copy(c).addScaledVector(MOON_DIR, 70);
    light.current.target.updateMatrixWorld();
    light.current.updateMatrixWorld();
    light.current.shadow.needsUpdate = true;
  });

  return (
    <directionalLight
      ref={light}
      color="#9fb6ff"
      intensity={1.5}
      castShadow
      shadow-camera-left={-40}
      shadow-camera-right={40}
      shadow-camera-top={40}
      shadow-camera-bottom={-40}
      shadow-camera-near={1}
      shadow-camera-far={160}
      shadow-bias={-0.0006}
      shadow-normalBias={0.05}
    />
  );
}

/* ───────── snow: falling flakes + ground drift ───────── */
const snowVert = /* glsl */ `
uniform float uTime;
uniform vec3 uCam;
uniform float uSize;
uniform vec3 uBox;
uniform vec3 uWind;
uniform float uFall;
uniform float uBase;
attribute float aSeed;
varying float vA;
void main(){
  vec3 p = position;
  p.y -= uTime * uFall * (0.6 + aSeed * 0.8);
  p += uWind * uTime * (0.7 + aSeed * 0.6);
  p.x += sin(uTime * 0.6 + aSeed * 40.0) * 0.5;
  p.z += cos(uTime * 0.5 + aSeed * 30.0) * 0.4;
  vec3 c = vec3(uCam.x, uBase, uCam.z);
  p = mod(p - c + uBox * 0.5, uBox) - uBox * 0.5 + c;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = min(uSize * (0.5 + aSeed) * (60.0 / -mv.z), 12.0);
  vA = smoothstep(30.0, 3.0, -mv.z) * smoothstep(0.2, 1.2, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const snowFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
varying float vA;
void main(){
  float d = length(gl_PointCoord - 0.5);
  gl_FragColor = vec4(uColor, smoothstep(0.5, 0.05, d) * vA * uAlpha);
}`;

function SnowLayer({ count, box, fall, wind, size, alpha, ground }: { count: number; box: [number, number, number]; fall: number; wind: [number, number, number]; size: number; alpha: number; ground: boolean }) {
  const golden = useQuest((s) => s.golden);
  const target = useMemo(() => new THREE.Color(), []);
  const geo = useMemo(() => {
    const r = mulberry32(count);
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos.set([r() * box[0], r() * box[1], r() * box[2]], i * 3);
      seed[i] = r();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    return g;
  }, [count, box]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: snowVert,
        fragmentShader: snowFrag,
        uniforms: {
          uTime: { value: 0 },
          uCam: { value: new THREE.Vector3() },
          uSize: { value: size },
          uBox: { value: new THREE.Vector3(...box) },
          uWind: { value: new THREE.Vector3(...wind) },
          uFall: { value: fall },
          uBase: { value: 0 },
          uColor: { value: new THREE.Color("#eef3ff") },
          uAlpha: { value: alpha },
        },
        transparent: true,
        depthWrite: false,
      }),
    [size, box, wind, fall, alpha]
  );
  useFrame((state) => {
    const u = mat.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    u.uCam.value.copy(state.camera.position);
    const gy = getWorld().height(live.x, live.z);
    u.uBase.value = ground ? gy + box[1] / 2 - 0.1 : state.camera.position.y + 3;
    target.set(golden ? "#ffd36a" : "#eef3ff");
    (u.uColor.value as THREE.Color).lerp(target, 0.03);
  });
  return <points geometry={geo} material={mat} frustumCulled={false} />;
}

export function Atmosphere() {
  const q = useQuality((x) => x.s);
  return (
    <>
      <fogExp2 attach="fog" args={[FOG, 0.034]} />
      <SkyDome />
      <SkyObjects />
      <hemisphereLight args={["#40569a", "#0b1020", 0.75]} />
      <ambientLight color="#1a2550" intensity={0.25} />
      <Moonlight />
      <SnowLayer key={"s" + q.snow} count={q.snow} box={[40, 20, 40]} fall={0.7} wind={[0.35, 0, 0.1]} size={1.45} alpha={0.9} ground={false} />
      <SnowLayer key={"d" + q.drift} count={q.drift} box={[26, 0.9, 26]} fall={0.03} wind={[2.6, 0, 0.9]} size={1.0} alpha={0.55} ground />
    </>
  );
}
