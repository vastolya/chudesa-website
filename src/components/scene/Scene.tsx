"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { blobFragment, blobVertex } from "./shaders";
import { sceneState } from "@/lib/store";

// Orb path along the page: p = scroll progress, x/y in viewport fractions, s = scale
const KEYS = [
  { p: 0.0, x: 0.22, y: 0.02, s: 1.0, hue: 0.0 },
  { p: 0.12, x: -0.3, y: 0.05, s: 0.62, hue: 0.15 },
  { p: 0.3, x: 0.3, y: -0.1, s: 0.55, hue: 0.3 },
  { p: 0.5, x: -0.28, y: 0.0, s: 0.7, hue: 0.45 },
  { p: 0.72, x: 0.32, y: 0.12, s: 0.5, hue: 0.6 },
  { p: 0.88, x: 0.0, y: 0.0, s: 1.15, hue: 0.8 },
  { p: 1.0, x: 0.0, y: -0.05, s: 0.9, hue: 1.0 },
];

function sample(p: number) {
  for (let i = 0; i < KEYS.length - 1; i++) {
    const a = KEYS[i];
    const b = KEYS[i + 1];
    if (p <= b.p) {
      const t = THREE.MathUtils.smootherstep((p - a.p) / (b.p - a.p), 0, 1);
      return {
        x: THREE.MathUtils.lerp(a.x, b.x, t),
        y: THREE.MathUtils.lerp(a.y, b.y, t),
        s: THREE.MathUtils.lerp(a.s, b.s, t),
        hue: THREE.MathUtils.lerp(a.hue, b.hue, t),
      };
    }
  }
  return KEYS[KEYS.length - 1];
}

function Orb() {
  const group = useRef<THREE.Group>(null!);
  const mesh = useRef<THREE.Mesh>(null!);
  const ring = useRef<THREE.Mesh>(null!);
  const mat = useRef<THREE.ShaderMaterial>(null!);
  const { viewport } = useThree();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAmp: { value: 0.22 },
      uFreq: { value: 0.9 },
      uMouse: { value: new THREE.Vector3(0, 0, 1) },
      uExcite: { value: 0 },
      uHue: { value: 0 },
      uTheme: { value: 0 },
    }),
    []
  );

  const smooth = useRef({ x: 0, y: 0, s: 1, mx: 0, my: 0, excite: 0, vel: 0 });

  useFrame((state, dt) => {
    const d = Math.min(dt, 1 / 30);
    const sm = smooth.current;
    const mobile = viewport.width < 7;
    const k = sample(sceneState.scroll);

    const tx = mobile ? k.x * 0.4 : k.x * viewport.width;
    const ty = k.y * viewport.height + (mobile ? viewport.height * 0.12 : 0);
    const base = Math.min(viewport.width, viewport.height) * (mobile ? 0.36 : 0.3);
    const ts = k.s * base;

    const ease = 1 - Math.exp(-d * 3.2);
    sm.x += (tx + sceneState.pointer.x * 0.25 - sm.x) * ease;
    sm.y += (ty + sceneState.pointer.y * 0.2 - sm.y) * ease;
    sm.s += (ts - sm.s) * ease;
    sm.mx += (sceneState.pointer.x - sm.mx) * (1 - Math.exp(-d * 5));
    sm.my += (sceneState.pointer.y - sm.my) * (1 - Math.exp(-d * 5));
    sm.excite += (sceneState.excite - sm.excite) * (1 - Math.exp(-d * 4));
    sm.vel += (Math.min(Math.abs(sceneState.velocity) / 40, 1) - sm.vel) * (1 - Math.exp(-d * 3));

    group.current.position.set(sm.x, sm.y, 0);
    group.current.scale.setScalar(sm.s);

    const u = mat.current.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    u.uMouse.value.set(sm.mx * 1.4, sm.my * 1.4, 1).normalize();
    u.uExcite.value = sm.excite;
    u.uAmp.value = 0.2 + sm.vel * 0.22;
    u.uHue.value = k.hue;

    mesh.current.rotation.y += d * (0.12 + sm.vel * 0.8);
    mesh.current.rotation.x = sm.my * 0.35;
    ring.current.rotation.z += d * 0.25;
    ring.current.rotation.x = 1.15 + sm.my * 0.4 + Math.sin(state.clock.elapsedTime * 0.4) * 0.08;
    ring.current.rotation.y = sm.mx * 0.5;
  });

  return (
    <group ref={group}>
      <mesh ref={mesh}>
        <icosahedronGeometry args={[1, 48]} />
        <shaderMaterial
          ref={mat}
          vertexShader={blobVertex}
          fragmentShader={blobFragment}
          uniforms={uniforms}
        />
      </mesh>
      <mesh ref={ring}>
        <torusGeometry args={[1.75, 0.006, 8, 200]} />
        <meshBasicMaterial color="#c8ff2e" transparent opacity={0.7} />
      </mesh>
      <Sparkles count={60} scale={4.2} size={2.4} speed={0.35} color="#e9ffb0" opacity={0.8} />
    </group>
  );
}

function Dust() {
  const ref = useRef<THREE.Points>(null!);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const n = 500;
    const pos = new Float32Array(n * 3);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (rnd() - 0.5) * 30;
      pos[i * 3 + 1] = (rnd() - 0.5) * 20;
      pos[i * 3 + 2] = (rnd() - 0.5) * 10 - 4;
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);

  useFrame((_, dt) => {
    ref.current.rotation.y += dt * 0.01;
    ref.current.position.y = sceneState.scroll * 6;
  });

  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial size={0.025} color="#f2efe8" transparent opacity={0.45} sizeAttenuation />
    </points>
  );
}

export default function Scene() {
  return (
    <Canvas
      className="scene-canvas"
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 8], fov: 40 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      <Orb />
      <Dust />
    </Canvas>
  );
}
