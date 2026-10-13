"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, DepthOfField, EffectComposer, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode, type DepthOfFieldEffect, type VignetteEffect } from "postprocessing";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { Atmosphere } from "./Atmosphere";
import { Player } from "./Player";
import { Terrain } from "./Terrain";
import { Lakes, Lamps, Props } from "./Props";
import { Landmarks } from "./Environment";
import { Decor, FinalOrb } from "./Creatures";
import { Wonders } from "./Wonders";
import { Dither } from "./Dither";
import { Inspect } from "./Inspect";
import { useQuality } from "@/lib/quality";
import { inspect, useQuest } from "@/lib/forest";

/**
 * Watches real frame times and steps quality DOWN only (never back up),
 * at most once per ~6 s — no ping-pong, so no flashing.
 */
function FpsGuard() {
  const s = useRef({ frames: 0, time: 0, since: 0, said: false });
  const { scene, gl } = useThree();
  const shadows = useQuality((q) => q.s.shadows);
  const soft = useQuality((q) => q.s.softShadows);

  // shadow on/off or type change needs every material to rebuild its program
  useEffect(() => {
    gl.shadowMap.enabled = shadows;
    gl.shadowMap.type = soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    gl.shadowMap.needsUpdate = true;
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (!m) return;
      (Array.isArray(m) ? m : [m]).forEach((x) => (x.needsUpdate = true));
    });
  }, [shadows, soft, scene, gl]);

  useFrame((_, dt) => {
    const st = s.current;
    if (useQuest.getState().phase !== "walk") return;
    st.since += dt;
    if (st.since < 4) return; // let shaders compile and the first frames settle
    st.frames++;
    st.time += Math.min(dt, 0.25);
    if (st.time < 3) return;
    const fps = st.frames / st.time;
    st.frames = 0;
    st.time = 0;
    if (fps < 38 && useQuality.getState().downgrade()) {
      st.since = -2; // wait ~6 s before judging again
      if (!st.said) {
        st.said = true;
        useQuest.getState().say("Ваш компьютер тяжело вздохнул. Мы убрали пару теней — лес не обиделся.", "wall");
      }
    }
  });
  return null;
}

/** While a wonder is held, the world drifts out of focus and the edges darken. */
function FocusDriver({ dof, vig }: { dof: React.RefObject<DepthOfFieldEffect | null>; vig: React.RefObject<VignetteEffect | null> }) {
  useFrame(() => {
    const a = inspect.amount;
    if (dof.current) dof.current.bokehScale = a * 7;
    if (vig.current) vig.current.darkness = 0.78 + a * 0.17;
  });
  return null;
}

export default function ForestCanvas() {
  const q = useQuality((x) => x.s);
  const coarse = useQuality((x) => x.coarse);
  const tier = useQuality((x) => x.tier);
  const dof = useRef<DepthOfFieldEffect>(null);
  const vig = useRef<VignetteEffect>(null);
  const withDof = tier !== "low";
  const noBloom = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("nobloom"); // debug

  return (
    <Canvas
      className="forest-canvas"
      dpr={q.dpr}
      shadows={{ type: q.softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap, enabled: q.shadows }}
      camera={{ position: [0, 1.7, 6], fov: 64, near: 0.05, far: 200 }}
      gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
      style={{ touchAction: "none" }}
    >
      <FpsGuard />
      <Atmosphere />
      <Player />
      <Terrain />
      <Props />
      <Lakes />
      <Lamps />
      <Landmarks />
      <Decor />
      <Wonders />
      <FinalOrb />
      <Inspect />
      <FocusDriver dof={dof} vig={vig} />
      <EffectComposer multisampling={coarse ? 0 : q.msaa}>
        {withDof && <DepthOfField ref={dof} focusDistance={0.4} focusRange={0.3} bokehScale={0} resolutionScale={0.5} />}
        <Bloom intensity={noBloom ? 0 : 0.7} key={noBloom ? "nb" : "b"} luminanceThreshold={1.1} luminanceSmoothing={0.35} mipmapBlur radius={0.6} resolutionScale={q.bloomScale} />
        {/* the composer renders to an HDR target, so tone mapping must happen here — otherwise highlights clip hard */}
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
        <Vignette ref={vig} offset={0.28} darkness={0.78} />
        {/* last: hides 8-bit banding rings in dark gradients */}
        <Dither />
      </EffectComposer>
    </Canvas>
  );
}
