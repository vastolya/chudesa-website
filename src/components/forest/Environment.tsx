"use client";

import { useFrame } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { landmarks, live } from "@/lib/forest";
import { getWorld } from "@/lib/world";
import { mulberry32 } from "@/lib/noise";
import { getBeamTexture, getGlowTexture } from "./creatureMaterial";

/* ───────── beacons: light pillars visible through the forest ───────── */
export function Beacon({ x, z, color, opacity = 0.16 }: { x: number; z: number; color: string; opacity?: number }) {
  const tex = useMemo(() => getBeamTexture(), []);
  const y = getWorld().height(x, z);
  return (
    <Billboard position={[x, y + 20, z]} lockX lockZ>
      <mesh>
        <planeGeometry args={[1.4, 40]} />
        <meshBasicMaterial map={tex} color={color} transparent opacity={opacity} depthWrite={false} fog={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </Billboard>
  );
}

/* ───────── landmarks ───────── */
function ProcessStones({ x, z }: { x: number; z: number }) {
  const world = getWorld();
  const glow = useMemo(() => getGlowTexture(), []);
  const stones = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) => {
        const a = (i / 5) * Math.PI * 2 + 0.3;
        const sx = x + Math.cos(a) * 4.4;
        const sz = z + Math.sin(a) * 4.4;
        return { x: sx, z: sz, y: world.height(sx, sz), h: 1.7 + (i % 3) * 0.5, rot: a };
      }),
    [x, z, world]
  );
  const lights = useRef<THREE.Sprite[]>([]);
  useFrame((state) => {
    const near = Math.hypot(live.x - x, live.z - z) < 11;
    lights.current.forEach((l, i) => {
      if (!l) return;
      const m = l.material as THREE.SpriteMaterial;
      m.opacity += ((near ? 0.95 : 0.35) * (0.75 + 0.25 * Math.sin(state.clock.elapsedTime * 2 + i)) - m.opacity) * 0.05;
    });
  });
  return (
    <>
      {stones.map((s, i) => (
        <group key={i} position={[s.x, s.y - 0.1, s.z]} rotation={[0, s.rot, 0]}>
          <mesh position={[0, s.h / 2, 0]} scale={[0.6, s.h / 2, 0.38]} castShadow>
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#3a4660" flatShading roughness={0.9} />
          </mesh>
          <mesh position={[0, s.h + 0.05, 0]} scale={[0.42, 0.08, 0.28]}>
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#e4ecff" flatShading roughness={1} />
          </mesh>
          <mesh position={[0, s.h * 0.55, 0.39]}>
            <planeGeometry args={[0.28, 0.28]} />
            <meshBasicMaterial color={[0.9, 1.6, 0.25]} toneMapped={false} transparent opacity={0.9} />
          </mesh>
          <sprite ref={(m) => void (m && (lights.current[i] = m))} position={[0, s.h + 0.6, 0]} scale={[1.8, 1.8, 1]}>
            <spriteMaterial map={glow} color="#c8ff2e" transparent opacity={0.3} depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
        </group>
      ))}
    </>
  );
}

function StoryTree({ x, z }: { x: number; z: number }) {
  const world = getWorld();
  const y = world.height(x, z);
  const glow = useMemo(() => getGlowTexture(), []);
  const lamps = useMemo(() => {
    const r = mulberry32(99);
    const colors = ["#c8ff2e", "#ff7ad9", "#7af0ff", "#ffd36a"];
    return Array.from({ length: 34 }, (_, i) => {
      const ly = 1.2 + r() * 12;
      const rad = (1 - ly / 14.5) * 4.6 + 0.4;
      const a = r() * Math.PI * 2;
      return { p: [Math.cos(a) * rad, ly, Math.sin(a) * rad] as [number, number, number], c: colors[i % 4], ph: r() * 6 };
    });
  }, []);
  const refs = useRef<THREE.Sprite[]>([]);
  useFrame((state) => {
    refs.current.forEach((s, i) => {
      if (s) (s.material as THREE.SpriteMaterial).opacity = 0.55 + 0.4 * Math.sin(state.clock.elapsedTime * 1.5 + lamps[i].ph);
    });
  });
  const tiers = [
    { r: 5.2, h: 5, y: 1.5 },
    { r: 4.2, h: 4.4, y: 4.2 },
    { r: 3.1, h: 3.8, y: 6.8 },
    { r: 2, h: 3.2, y: 9.2 },
    { r: 1, h: 2.6, y: 11.4 },
  ];
  return (
    <group position={[x, y - 0.1, z]}>
      <mesh position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[0.35, 0.6, 2.4, 8]} />
        <meshStandardMaterial color="#21160f" />
      </mesh>
      {tiers.map((t, i) => (
        <mesh key={i} position={[0, t.y + t.h / 2, 0]} castShadow>
          <coneGeometry args={[t.r, t.h, 11]} />
          <meshStandardMaterial color="#10271d" flatShading roughness={0.95} />
        </mesh>
      ))}
      {lamps.map((l, i) => (
        <group key={i} position={l.p}>
          <mesh>
            <sphereGeometry args={[0.08, 8, 6]} />
            <meshBasicMaterial color={new THREE.Color(l.c).multiplyScalar(2.2)} toneMapped={false} />
          </mesh>
          <sprite ref={(m) => void (m && (refs.current[i] = m))} scale={[1.1, 1.1, 1]}>
            <spriteMaterial map={glow} color={l.c} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
        </group>
      ))}
    </group>
  );
}

export function Landmarks() {
  const p = landmarks.find((l) => l.id === "process")!;
  const c = landmarks.find((l) => l.id === "cases")!;
  const f = landmarks.find((l) => l.id === "final")!;
  return (
    <>
      <ProcessStones x={p.x} z={p.z} />
      <StoryTree x={c.x} z={c.z} />
      <Beacon x={p.x} z={p.z} color="#dfe9ff" opacity={0.08} />
      <Beacon x={c.x} z={c.z} color="#ff7ad9" opacity={0.08} />
      <Beacon x={f.x} z={f.z} color="#c8ff2e" opacity={0.16} />
    </>
  );
}
