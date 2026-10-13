"use client";

import { useFrame } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { landmarks, live } from "@/lib/forest";
import { getWorld } from "@/lib/world";
import { useQuality } from "@/lib/quality";
import { sfxPing } from "@/lib/audio";
import { getGlowTexture, makeCreatureMaterial, speciesMaterial, sphereGeo } from "./creatureMaterial";
import type { Species } from "@/lib/species";
import { Accessory } from "./Accessory";

const tmp = new THREE.Vector3();
const invQ = new THREE.Quaternion();

/** Screen-space distance (≈ fraction of half-height) from the lantern to a world point. */
export function pointerDist(world: THREE.Vector3, camera: THREE.Camera) {
  tmp.copy(world).project(camera);
  if (tmp.z > 1) return Infinity;
  const aspect = window.innerWidth / window.innerHeight;
  return Math.hypot((tmp.x - live.pointer.x) * aspect, tmp.y - live.pointer.y);
}

type CreatureProps = {
  position: [number, number, number];
  size: number;
  seed: number;
  species: Species;
  morphSpeed: number;
  drift: number;
};

/** Ambient creature: morphs between two forms, breathes, shies away from the light. */
function Creature({ position, size, seed, species, morphSpeed, drift }: CreatureProps) {
  const color = species.glow;
  const hue = seed;
  const group = useRef<THREE.Group>(null!);
  const mesh = useRef<THREE.Mesh>(null!);
  const q = useQuality((x) => x.s);
  // level-of-detail: tessellation by size, quality tier and distance
  const lods = useMemo(() => {
    // never drop to blocky low-poly: the smallest level is still a smooth sphere
    const f = q.detailFloor;
    const base = Math.max(f, Math.round((size > 0.9 ? 44 : size > 0.35 ? 28 : 16) * q.creatureDetail));
    return [sphereGeo(base), sphereGeo(Math.max(Math.round(f * 0.75), Math.round(base / 2))), sphereGeo(Math.max(Math.round(f * 0.55), Math.round(base / 3)))];
  }, [size, q.creatureDetail, q.detailFloor]);
  const lod = useRef(-1);
  const mat = useMemo(() => speciesMaterial(species, seed, q.cheap), [species, seed, q.cheap]);
  const glow = useMemo(() => getGlowTexture(), []);
  const s = useRef({ off: new THREE.Vector3(), touched: false, base: new THREE.Vector3(...position), excite: 0 });

  useFrame((state, dt) => {
    const st = s.current;
    // skip everything far inside the fog
    const fd = Math.hypot(st.base.x - live.x, st.base.z - live.z);
    const show = fd < q.drawDist + size * 8;
    group.current.visible = show;
    if (!show) return;
    const lv = fd < 14 ? 0 : fd < 32 ? 1 : 2;
    if (lv !== lod.current) {
      lod.current = lv;
      mesh.current.geometry = lods[lv];
    }
    const t = state.clock.elapsedTime + seed * 40;
    const u = mat.uniforms;
    u.uTime.value = t;
    u.uMorph.value = 0.5 + 0.5 * Math.sin(t * morphSpeed);
    const wx = st.base.x + st.off.x + Math.sin(t * 0.13) * drift;
    const wy = st.base.y + st.off.y + Math.sin(t * 0.7) * 0.3 * (0.4 + size);
    const wz = st.base.z + st.off.z + Math.cos(t * 0.11) * drift;
    group.current.position.set(wx, wy, wz);
    mesh.current.rotation.x += dt * 0.15;
    mesh.current.rotation.y += dt * (0.12 + seed * 0.25);

    const camD = state.camera.position.distanceTo(group.current.position);
    let lit = false;
    if (camD < 28) {
      const d = pointerDist(group.current.position, state.camera);
      lit = d < 0.12 + (size / Math.max(camD, 1)) * 1.2;
      if (lit) {
        // the light tickles it: bulge toward the viewer, drift away
        const away = tmp.subVectors(group.current.position, state.camera.position).setY(0).normalize();
        st.off.addScaledVector(away, dt * 1.6);
        st.off.y += dt * 0.5;
        if (!st.touched) {
          st.touched = true;
          sfxPing(hue);
        }
        u.uTouch.value.copy(state.camera.position).sub(group.current.position).applyQuaternion(invQ.copy(mesh.current.quaternion).invert());
      } else st.touched = false;
    }
    st.excite += ((lit ? 1 : 0) - st.excite) * (1 - Math.exp(-dt * 4));
    u.uExcite.value = st.excite;
    u.uGlow.value = 0.25 + st.excite * 0.9;
    st.off.multiplyScalar(1 - dt * 0.08);
  });

  return (
    <group ref={group} scale={size}>
      <mesh ref={mesh} geometry={lods[0]} material={mat} />
      {size > 0.5 && <Accessory kind={species.accessory} color={color} colB={species.colB} />}
      <sprite scale={[4.5, 4.5, 1]}>
        <spriteMaterial map={glow} color={color} transparent opacity={0.3} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
    </group>
  );
}

export function Decor() {
  const world = getWorld();
  const count = useQuality((x) => x.s.creatures);
  return (
    <>
      {world.creatures.slice(0, count).map((c, i) => (
        <Creature
          key={i}
          position={[c.x, c.y, c.z]}
          size={c.size}
          seed={c.seed}
          species={c.species}
          morphSpeed={c.morphSpeed}
          drift={c.drift}
        />
      ))}
    </>
  );
}

/** The big wonder in the final clearing — the original orb, now a shapeshifter. */
export function FinalOrb() {
  const f = landmarks.find((l) => l.id === "final")!;
  const group = useRef<THREE.Group>(null!);
  const ring = useRef<THREE.Mesh>(null!);
  const mat = useMemo(() => makeCreatureMaterial({ hue: 0, form: { a: [0, 0], b: [2, 6] }, amp: 0.22 }), []);
  const glow = useMemo(() => getGlowTexture(), []);
  const baseY = getWorld().height(f.x, f.z) + 3.8;

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const near = Math.hypot(live.x - f.x, live.z - f.z);
    mat.uniforms.uTime.value = t;
    mat.uniforms.uMorph.value = (0.5 - 0.5 * Math.cos(t * 0.15)) * 0.6;
    mat.uniforms.uGlow.value = 0.25 + THREE.MathUtils.smoothstep(16, 6, near) * 0.6;
    mat.uniforms.uHue.value = t * 0.02;
    group.current.position.y = baseY + Math.sin(t * 0.6) * 0.25;
    group.current.rotation.y += dt * 0.15;
    ring.current.rotation.z += dt * 0.3;
    ring.current.rotation.x = 1.2 + live.pointer.y * 0.3;
  });

  return (
    <group ref={group} position={[f.x, baseY, f.z]} scale={2.4}>
      <mesh geometry={sphereGeo(48)} material={mat} />
      <mesh ref={ring}>
        <torusGeometry args={[1.8, 0.008, 8, 200]} />
        <meshBasicMaterial color="#c8ff2e" transparent opacity={0.8} fog={false} />
      </mesh>
      <sprite scale={[9, 9, 1]}>
        <spriteMaterial map={glow} color="#c8ff2e" transparent opacity={0.25} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
      </sprite>
      <Sparkles count={80} scale={5} size={3} speed={0.4} color="#e9ffb0" />
    </group>
  );
}
