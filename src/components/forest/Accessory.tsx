"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Accessory as Kind } from "@/lib/species";

/**
 * Props that tell what a wonder *is*. All unlit (basic materials) so they read the
 * same in the forest and in the hand-held overlay, which has no lights.
 * Sizes are in the creature's local units (its body is ~1 in radius).
 */
export function Accessory({ kind, color, colB = "#ffffff" }: { kind: Kind; color: string; colB?: string }) {
  const g = useRef<THREE.Group>(null!);
  // a stable phase per prop, so neighbours do not move in lockstep
  const t0 = useMemo(() => [...(kind + color)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 997, 7) / 99.7, [kind, color]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime + t0;
    const o = g.current;
    if (!o) return;
    switch (kind) {
      case "ring":
        o.rotation.set(1.2 + Math.sin(t * 0.4) * 0.15, 0, t * 0.3);
        break;
      case "atom":
        o.children.forEach((c, i) => {
          c.rotation.z += dt * (0.6 + i * 0.25);
        });
        break;
      case "orbiters":
        o.rotation.x = 0.45;
        o.rotation.y += dt * 0.6;
        break;
      case "pixels":
        o.children.forEach((c, i) => {
          const a = i * 1.7 + t * (0.25 + (i % 3) * 0.08);
          const r = 1.35 + Math.sin(t * 0.7 + i) * 0.15;
          c.position.set(Math.cos(a) * r, Math.sin(a * 1.3 + i) * 0.8, Math.sin(a) * r);
          c.rotation.set(t + i, t * 0.7, 0);
        });
        break;
      case "frame":
        o.rotation.y -= dt * 0.25;
        break;
      case "compass":
        // dial tilted towards the viewer so it reads as a compass, not a line
        o.rotation.set(-0.95, Math.sin(t * 0.6) * 0.08, 0);
        break;
    }
  });

  switch (kind) {
    case "ring":
      return (
        <group ref={g}>
          <mesh>
            <torusGeometry args={[1.75, 0.012, 8, 160]} />
            <meshBasicMaterial color={color} transparent opacity={0.75} />
          </mesh>
        </group>
      );
    case "atom":
      // electron shells crossing at angles: the inside, seen through
      return (
        <group ref={g}>
          {[0, 1, 2].map((i) => (
            <group key={i} rotation={[1.2, (i * Math.PI) / 3, 0.3 * i]}>
              <mesh>
                <torusGeometry args={[1.55, 0.01, 6, 140]} />
                <meshBasicMaterial color={color} transparent opacity={0.6} />
              </mesh>
              <mesh position={[1.55, 0, 0]}>
                <sphereGeometry args={[0.07, 10, 8]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
            </group>
          ))}
        </group>
      );
    case "compass":
      // a dial with ticks and a two-coloured needle: one clear direction
      return (
        <group ref={g}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.6, 0.015, 6, 120]} />
            <meshBasicMaterial color={color} transparent opacity={0.85} />
          </mesh>
          {Array.from({ length: 16 }, (_, i) => {
            const a = (i / 16) * Math.PI * 2;
            const big = i % 4 === 0;
            return (
              <mesh key={i} position={[Math.cos(a) * 1.6, 0, Math.sin(a) * 1.6]} rotation={[0, -a, 0]}>
                <boxGeometry args={[big ? 0.22 : 0.12, 0.02, 0.03]} />
                <meshBasicMaterial color={color} />
              </mesh>
            );
          })}
          <mesh position={[0, 0, -1.25]} rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.09, 0.9, 4]} />
            <meshBasicMaterial color="#ff5a6e" />
          </mesh>
          <mesh position={[0, 0, 1.25]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.09, 0.9, 4]} />
            <meshBasicMaterial color="#f4f1ea" />
          </mesh>
        </group>
      );
    case "ribbon":
      // a gift: two golden bands and a bow on top
      return (
        <group ref={g}>
          <mesh>
            <boxGeometry args={[2.3, 2.3, 0.3]} />
            <meshBasicMaterial color="#f3c96b" />
          </mesh>
          <mesh>
            <boxGeometry args={[0.3, 2.3, 2.3]} />
            <meshBasicMaterial color="#e8b85a" />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.3, 1.27, 0]} rotation={[0, 0, s * 0.5]}>
              <torusGeometry args={[0.3, 0.09, 8, 24]} />
              <meshBasicMaterial color="#f7d27c" />
            </mesh>
          ))}
          <mesh position={[0, 1.2, 0]}>
            <sphereGeometry args={[0.14, 12, 10]} />
            <meshBasicMaterial color="#ffdf8f" />
          </mesh>
        </group>
      );
    case "frame":
      // the blueprint's construction box
      return (
        <group ref={g}>
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(2.6, 3.2, 2.6)]} />
            <lineBasicMaterial color={color} transparent opacity={0.55} />
          </lineSegments>
          <lineSegments rotation={[0, Math.PI / 4, 0]}>
            <edgesGeometry args={[new THREE.BoxGeometry(2.0, 2.6, 2.0)]} />
            <lineBasicMaterial color={colB} transparent opacity={0.35} />
          </lineSegments>
        </group>
      );
    case "pixels":
      // pixels breaking off the screen and drifting around it
      return (
        <group ref={g}>
          {Array.from({ length: 10 }, (_, i) => (
            <mesh key={i}>
              <boxGeometry args={[0.16, 0.16, 0.16]} />
              <meshBasicMaterial color={i % 2 ? color : colB} />
            </mesh>
          ))}
        </group>
      );
    case "orbiters":
      // parts riding a track around the gear — the work happens by itself
      return (
        <group ref={g}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.85, 0.01, 6, 160]} />
            <meshBasicMaterial color={color} transparent opacity={0.6} />
          </mesh>
          {Array.from({ length: 6 }, (_, i) => {
            const a = (i / 6) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(a) * 1.85, 0, Math.sin(a) * 1.85]} rotation={[0, -a, 0.4]}>
                <boxGeometry args={[0.2, 0.2, 0.2]} />
                <meshBasicMaterial color={i % 2 ? color : "#dfe3ea"} />
              </mesh>
            );
          })}
        </group>
      );
    default:
      return null;
  }
}
