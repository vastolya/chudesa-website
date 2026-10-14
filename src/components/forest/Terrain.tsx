"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { mulberry32 } from "@/lib/noise";
import { getWorld } from "@/lib/world";
import { QUALITY } from "@/lib/quality";

const SIZE = 240;


/** Paint snow, trodden trails and footprints into one big texture. */
function paintGround(TEX: number) {
  const world = getWorld();
  const c = document.createElement("canvas");
  c.width = c.height = TEX;
  const g = c.getContext("2d")!;
  const k = TEX / SIZE; // px per metre
  const P = (x: number, z: number) => [(x + SIZE / 2) * k, (z + SIZE / 2) * k] as const;
  const r = mulberry32(world.seed + 1);

  g.fillStyle = "#e6ecf8";
  g.fillRect(0, 0, TEX, TEX);
  // wind-blown sastrugi and soft shading
  for (let i = 0; i < 9000; i++) {
    const x = r() * TEX;
    const y = r() * TEX;
    g.fillStyle = r() < 0.5 ? `rgba(170,188,225,${r() * 0.12})` : `rgba(255,255,255,${r() * 0.25})`;
    g.beginPath();
    g.ellipse(x, y, 4 + r() * 22, 1 + r() * 3, 0.35, 0, Math.PI * 2);
    g.fill();
  }

  const stroke = (pts: { x: number; z: number }[], w: number, style: string) => {
    g.strokeStyle = style;
    g.lineWidth = w * k;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(...P(p.x, p.z)) : g.moveTo(...P(p.x, p.z))));
    g.stroke();
  };
  for (const p of world.paths) stroke(p, 3.4, "rgba(150,168,205,0.22)");
  for (const p of world.paths) stroke(p, 1.6, "rgba(128,146,186,0.45)");
  for (const p of world.paths) stroke(p, 0.7, "rgba(112,128,170,0.35)");

  // footprints
  g.fillStyle = "rgba(92,108,150,0.55)";
  for (const p of world.paths) {
    let acc = 0;
    let left = false;
    for (let i = 1; i < p.length; i++) {
      const dx = p[i].x - p[i - 1].x;
      const dz = p[i].z - p[i - 1].z;
      const l = Math.hypot(dx, dz);
      for (let s = 0; s < l; s += 0.05) {
        acc += 0.05;
        if (acc < 0.72) continue;
        acc = 0;
        left = !left;
        const t = s / l;
        const nx = -dz / l;
        const nz = dx / l;
        const side = (left ? 1 : -1) * 0.17 + (r() - 0.5) * 0.1;
        const [px, py] = P(p[i - 1].x + dx * t + nx * side, p[i - 1].z + dz * t + nz * side);
        g.save();
        g.translate(px, py);
        g.rotate(Math.atan2(dz, dx));
        g.beginPath();
        g.ellipse(0, 0, 0.15 * k, 0.07 * k, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function Terrain() {
  const world = getWorld();
  const time = useMemo(() => ({ value: 0 }), []);

  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(SIZE, SIZE, 240, 240);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const trail = Math.max(0, 1 - world.pathDist(x, z) / 1.2) * 0.08;
      pos.setY(i, world.height(x, z) - trail);
    }
    g.computeVertexNormals();
    return g;
  }, [world]);

  const mat = useMemo(() => {
    const q = QUALITY;
    const m = new THREE.MeshStandardMaterial({ map: paintGround(q.groundTex), roughness: 0.97, color: "#ffffff" });
    if (q.cheap) return m; // simplified shaders: no glitter pass
    // glitter: tiny view-dependent sparkles in the snow
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = time;
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;")
        .replace("#include <project_vertex>", "#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying vec3 vWPos;\nuniform float uTime;\nfloat h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }"
        )
        .replace(
          "#include <dithering_fragment>",
          `#include <dithering_fragment>
          vec2 cell = floor(vWPos.xz * 26.0);
          float rr = h21(cell);
          vec3 vd = normalize(cameraPosition - vWPos);
          float tw = smoothstep(0.94, 1.0, fract(rr * 17.3 + dot(vd, vec3(3.1, 1.7, 2.3)) * 0.6));
          float dd = length(cameraPosition - vWPos);
          gl_FragColor.rgb += tw * step(0.9, rr) * smoothstep(16.0, 2.0, dd) * vec3(0.85, 0.92, 1.0) * 0.7;`
        );
    };
    return m;
  }, [time]);

  useFrame((s) => (time.value = s.clock.elapsedTime));

  return <mesh geometry={geo} material={mat} receiveShadow />;
}
