"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { mulberry32 } from "@/lib/noise";
import { getWorld, type Prop, type PropKind } from "@/lib/world";
import { live } from "@/lib/forest";
import { QUALITY } from "@/lib/quality";
import { getGlowTexture } from "./creatureMaterial";

/* ───────── geometry kit: every part is painted, snow settles on what faces up ───────── */
const SNOW = new THREE.Color("#e4ecff");
type Painter = (x: number, y: number, z: number, ny: number, out: THREE.Color) => void;

function part(g: THREE.BufferGeometry, paint: Painter) {
  const p = g.index ? g.toNonIndexed() : g;
  p.computeVertexNormals();
  const pos = p.attributes.position;
  const nor = p.attributes.normal;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    paint(pos.getX(i), pos.getY(i), pos.getZ(i), nor.getY(i), c);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  p.setAttribute("color", new THREE.BufferAttribute(col, 3));
  if (!p.attributes.uv) p.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2));
  return p;
}
const solid = (hex: string): Painter => {
  const base = new THREE.Color(hex);
  return (_x, _y, _z, _ny, out) => out.copy(base);
};
const snowy = (hex: string, from = 0.45, to = 0.8): Painter => {
  const base = new THREE.Color(hex);
  return (x, _y, z, ny, out) => {
    const n = Math.sin(x * 9.1 + z * 7.7) * 0.12;
    out.copy(base).lerp(SNOW, THREE.MathUtils.smoothstep(ny + n, from, to));
  };
};
const tiered = (hex: string, h: number): Painter => {
  const base = new THREE.Color(hex);
  return (x, y, z, ny, out) => {
    const k = (y + h / 2) / h;
    const n = Math.sin(x * 7.1 + z * 5.3) * 0.15;
    out.copy(base).lerp(SNOW, THREE.MathUtils.clamp(k * 1.3 - 0.3 + n + (ny > 0.7 ? 0.3 : 0), 0, 1) * 0.92);
  };
};

function branch(r: number, len: number, x: number, y: number, z: number, yaw: number, tilt: number) {
  const g = new THREE.CylinderGeometry(r * 0.5, r, len, 5);
  g.translate(0, len / 2, 0);
  g.rotateZ(tilt);
  g.rotateY(yaw);
  g.translate(x, y, z);
  return g;
}

function buildGeometry(kind: PropKind): THREE.BufferGeometry {
  const r = mulberry32(kind.length * 977 + 13);
  const parts: THREE.BufferGeometry[] = [];
  const trunk = (rt: number, rb: number, h: number, hex: string) => {
    const g = new THREE.CylinderGeometry(rt, rb, h, 7);
    g.translate(0, h / 2, 0);
    parts.push(part(g, solid(hex)));
  };
  switch (kind) {
    case "spruce": {
      trunk(0.14, 0.2, 1.4, "#21160f");
      [
        { r: 1.7, h: 2.2, y: 1.0 },
        { r: 1.35, h: 2.0, y: 2.2 },
        { r: 1.0, h: 1.8, y: 3.3 },
        { r: 0.62, h: 1.5, y: 4.3 },
        { r: 0.3, h: 1.0, y: 5.2 },
      ].forEach((t) => {
        const g = new THREE.ConeGeometry(t.r, t.h, 9, 2);
        const p = part(g, tiered("#0d2119", t.h));
        p.translate(0, t.y + t.h / 2, 0);
        parts.push(p);
      });
      break;
    }
    case "fir": {
      trunk(0.1, 0.16, 1.2, "#21160f");
      for (let i = 0; i < 7; i++) {
        const rr = 1.15 - i * 0.14;
        const h = 1.45;
        const g = new THREE.ConeGeometry(rr, h, 8, 2);
        const p = part(g, tiered("#0a1a14", h));
        p.translate(0, 0.9 + i * 0.95 + h / 2, 0);
        parts.push(p);
      }
      break;
    }
    case "pine": {
      trunk(0.15, 0.24, 6.2, "#3a261b");
      for (let i = 0; i < 6; i++) {
        const g = new THREE.IcosahedronGeometry(0.85 + r() * 0.6, 0);
        g.scale(1.2, 0.7, 1.2);
        const a = r() * Math.PI * 2;
        const d = i === 0 ? 0 : 0.7 + r() * 0.6;
        const p = part(g, snowy("#12281b", 0.35, 0.7));
        p.translate(Math.cos(a) * d, 5.6 + r() * 1.6 + (i === 0 ? 0.9 : 0), Math.sin(a) * d);
        parts.push(p);
      }
      for (let i = 0; i < 3; i++) parts.push(part(branch(0.06, 1.1, 0, 4.4 + i * 0.5, 0, r() * 6.28, -1.1), snowy("#3a261b", 0.6, 0.9)));
      break;
    }
    case "birch": {
      const h = 7;
      const g = new THREE.CylinderGeometry(0.1, 0.15, h, 8, 14);
      g.translate(0, h / 2, 0);
      const white = new THREE.Color("#dcdcd4");
      const mark = new THREE.Color("#262421");
      parts.push(
        part(g, (x, y, z, _ny, out) => {
          const a = Math.atan2(z, x);
          const band = Math.floor(y * 2.6);
          const hsh = Math.abs(Math.sin(band * 12.9898 + Math.floor(a * 1.3) * 78.233) * 43758.5453) % 1;
          out.copy(hsh > 0.72 ? mark : white);
        })
      );
      for (let i = 0; i < 9; i++) {
        const y = 3 + r() * 3.6;
        parts.push(part(branch(0.035, 1.2 + r() * 1.3, 0, y, 0, r() * 6.28, -(0.5 + r() * 0.5)), solid("#7b766f")));
      }
      break;
    }
    case "dead": {
      const g = new THREE.CylinderGeometry(0.12, 0.26, 3, 6);
      g.translate(0, 1.5, 0);
      parts.push(part(g, snowy("#2b2521", 0.7, 0.95)));
      parts.push(part(branch(0.12, 2.6, 0, 2.9, 0, 0.4, 0.25), snowy("#2b2521", 0.6, 0.9)));
      for (let i = 0; i < 5; i++) parts.push(part(branch(0.06, 1 + r() * 1.4, 0, 1.8 + r() * 2.8, 0, r() * 6.28, -(0.6 + r() * 0.6)), snowy("#2b2521", 0.55, 0.85)));
      break;
    }
    case "bush": {
      for (let i = 0; i < 5; i++) {
        const g = new THREE.IcosahedronGeometry(0.4 + r() * 0.35, 0);
        const a = r() * Math.PI * 2;
        const p = part(g, snowy("#13261b", 0.3, 0.65));
        p.translate(Math.cos(a) * 0.5 * r(), 0.25 + r() * 0.35, Math.sin(a) * 0.5 * r());
        parts.push(p);
      }
      break;
    }
    case "rock": {
      const g = new THREE.DodecahedronGeometry(1, 0);
      g.scale(1.1, 0.62, 1.2);
      const p = part(g, snowy("#3f475a", 0.35, 0.7));
      p.translate(0, 0.25, 0);
      parts.push(p);
      const g2 = new THREE.DodecahedronGeometry(0.5, 0);
      const p2 = part(g2, snowy("#4a5266", 0.35, 0.7));
      p2.translate(0.8, 0.1, 0.5);
      parts.push(p2);
      break;
    }
    case "stump": {
      const g = new THREE.CylinderGeometry(0.34, 0.42, 0.55, 9);
      g.translate(0, 0.27, 0);
      parts.push(part(g, snowy("#3a2a20", 0.9, 0.98)));
      break;
    }
  }
  return mergeGeometries(parts)!;
}

const geoCache = new Map<PropKind, THREE.BufferGeometry>();
const propGeometry = (k: PropKind) => {
  if (!geoCache.has(k)) geoCache.set(k, buildGeometry(k));
  return geoCache.get(k)!;
};
let sharedMat: THREE.MeshStandardMaterial | null = null;
const propMaterial = () => (sharedMat ??= new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92 }));

const CHUNK = 32;
type Chunk = { key: string; cx: number; cz: number; byKind: Map<PropKind, Prop[]> };

/** One kind of prop inside one chunk: an instanced mesh with a real bounding sphere, so it can be culled. */
function ChunkLayer({ kind, list }: { kind: PropKind; list: Prop[] }) {
  const world = getWorld();
  const ref = useRef<THREE.InstancedMesh>(null!);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    list.forEach((p, i) => {
      o.position.set(p.x, world.height(p.x, p.z) - 0.08, p.z);
      o.rotation.set(0, p.rot, kind === "dead" || kind === "birch" ? (p.tint - 0.97) * 0.3 : 0);
      o.scale.setScalar(p.s);
      o.updateMatrix();
      ref.current.setMatrixAt(i, o.matrix);
      ref.current.setColorAt(i, c.setScalar(p.tint));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    ref.current.computeBoundingSphere();
    ref.current.computeBoundingBox();
  }, [list, kind, world]);
  return <instancedMesh ref={ref} args={[propGeometry(kind), propMaterial(), list.length]} castShadow receiveShadow={kind === "rock"} />;
}

export function Props() {
  const world = getWorld();
  const drawDist = QUALITY.drawDist;
  const chunks = useMemo(() => {
    const map = new Map<string, Chunk>();
    for (const p of world.props) {
      const cx = Math.floor(p.x / CHUNK);
      const cz = Math.floor(p.z / CHUNK);
      const key = `${cx},${cz}`;
      if (!map.has(key)) map.set(key, { key, cx: (cx + 0.5) * CHUNK, cz: (cz + 0.5) * CHUNK, byKind: new Map() });
      const ch = map.get(key)!;
      if (!ch.byKind.has(p.kind)) ch.byKind.set(p.kind, []);
      ch.byKind.get(p.kind)!.push(p);
    }
    return [...map.values()];
  }, [world]);
  const groups = useRef<(THREE.Group | null)[]>([]);
  const last = useRef({ x: 1e9, z: 1e9, d: 0 });

  // distance culling: chunks that are fully inside the fog are skipped
  useFrame(() => {
    const l = last.current;
    if (Math.hypot(live.x - l.x, live.z - l.z) < 2 && l.d === drawDist) return;
    l.x = live.x;
    l.z = live.z;
    l.d = drawDist;
    const lim = drawDist + CHUNK * 0.71;
    chunks.forEach((c, i) => {
      const g = groups.current[i];
      if (g) g.visible = Math.hypot(c.cx - live.x, c.cz - live.z) < lim;
    });
  });

  return (
    <>
      {chunks.map((c, i) => (
        <group key={c.key} ref={(g) => void (groups.current[i] = g)}>
          {[...c.byKind.entries()].map(([kind, list]) => (
            <ChunkLayer key={kind} kind={kind} list={list} />
          ))}
        </group>
      ))}
    </>
  );
}

/* ───────── trail lamps ───────── */
export function Lamps() {
  const world = getWorld();
  const glow = useMemo(() => getGlowTexture(), []);
  const post = useRef<THREE.InstancedMesh>(null!);
  const bulb = useRef<THREE.InstancedMesh>(null!);
  const postGeo = useMemo(() => {
    const a = new THREE.CylinderGeometry(0.05, 0.07, 2.3, 6);
    a.translate(0, 1.15, 0);
    const b = new THREE.BoxGeometry(0.5, 0.05, 0.05);
    b.translate(0.22, 2.25, 0);
    const c = new THREE.ConeGeometry(0.18, 0.14, 6);
    c.translate(0.42, 2.25, 0);
    return mergeGeometries([a.toNonIndexed(), b.toNonIndexed(), c.toNonIndexed()])!;
  }, []);
  const bulbGeo = useMemo(() => {
    const g = new THREE.SphereGeometry(0.09, 10, 8);
    g.translate(0.42, 2.12, 0);
    return g;
  }, []);

  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    world.lamps.forEach((l, i) => {
      o.position.set(l.x, world.height(l.x, l.z) - 0.05, l.z);
      o.rotation.set(0, l.side > 0 ? Math.PI : 0, 0);
      o.updateMatrix();
      post.current.setMatrixAt(i, o.matrix);
      bulb.current.setMatrixAt(i, o.matrix);
    });
    post.current.instanceMatrix.needsUpdate = true;
    bulb.current.instanceMatrix.needsUpdate = true;
  }, [world]);

  return (
    <>
      <instancedMesh ref={post} args={[postGeo, undefined, world.lamps.length]} castShadow frustumCulled={false}>
        <meshStandardMaterial color="#1b1b20" roughness={0.6} metalness={0.4} />
      </instancedMesh>
      <instancedMesh ref={bulb} args={[bulbGeo, undefined, world.lamps.length]} frustumCulled={false}>
        <meshBasicMaterial color={[2.2, 1.5, 0.7]} toneMapped={false} />
      </instancedMesh>
      {world.lamps.map((l, i) => {
        const dir = l.side > 0 ? -1 : 1;
        return (
          <sprite key={i} position={[l.x + 0.42 * dir, world.height(l.x, l.z) + 2.1, l.z]} scale={[2.6, 2.6, 1]}>
            <spriteMaterial map={glow} color="#ffb860" transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
        );
      })}
    </>
  );
}

/* ───────── frozen lakes ───────── */
export function Lakes() {
  const world = getWorld();
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const g = c.getContext("2d")!;
    g.fillStyle = "#8ea6d4";
    g.fillRect(0, 0, 512, 512);
    const r = mulberry32(world.seed + 5);
    for (let i = 0; i < 60; i++) {
      g.strokeStyle = `rgba(230,240,255,${0.15 + r() * 0.35})`;
      g.lineWidth = 0.5 + r() * 1.5;
      g.beginPath();
      let x = r() * 512;
      let y = r() * 512;
      g.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += (r() - 0.5) * 90;
        y += (r() - 0.5) * 90;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    for (let i = 0; i < 400; i++) {
      g.fillStyle = `rgba(255,255,255,${r() * 0.25})`;
      g.fillRect(r() * 512, r() * 512, 2 + r() * 8, 1);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [world]);
  return (
    <>
      {world.lakes.map((l, i) => (
        <mesh key={i} position={[l.x, l.y, l.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[l.r + 0.6, 64]} />
          <meshStandardMaterial map={tex} roughness={0.12} metalness={0.35} color="#b9c9ec" />
        </mesh>
      ))}
    </>
  );
}
