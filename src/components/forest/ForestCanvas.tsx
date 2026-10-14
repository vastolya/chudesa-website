"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode, type VignetteEffect } from "postprocessing";
import { useRef } from "react";
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
import { QUALITY } from "@/lib/quality";
import { inspect } from "@/lib/forest";

/** While a wonder is held, the edges of the world darken around it. */
function FocusDriver({ vig }: { vig: React.RefObject<VignetteEffect | null> }) {
  useFrame(() => {
    if (vig.current) vig.current.darkness = 0.78 + inspect.amount * 0.17;
  });
  return null;
}

export default function ForestCanvas({ onLost }: { onLost?: () => void }) {
  const vig = useRef<VignetteEffect>(null);
  const noBloom = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("nobloom"); // debug

  return (
    <Canvas
      className="forest-canvas"
      dpr={QUALITY.dpr}
      shadows={{ type: THREE.PCFShadowMap, enabled: QUALITY.shadows }}
      camera={{ position: [0, 1.7, 6], fov: 64, near: 0.05, far: 200 }}
      gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
      style={{ touchAction: "none" }}
      onCreated={({ gl }) => {
        // a driver reset kills the context: the loop keeps running (compass turns), the picture freezes
        gl.domElement.addEventListener(
          "webglcontextlost",
          (e) => {
            e.preventDefault();
            onLost?.();
          },
          { once: true }
        );
      }}
    >
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
      <FocusDriver vig={vig} />
      <EffectComposer multisampling={0}>
        <Bloom intensity={noBloom ? 0 : 0.7} key={noBloom ? "nb" : "b"} luminanceThreshold={1.1} luminanceSmoothing={0.35} mipmapBlur radius={0.6} levels={QUALITY.bloomLevels} resolutionScale={QUALITY.bloomScale} />
        {/* the composer renders to an HDR target, so tone mapping must happen here — otherwise highlights clip hard */}
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
        <Vignette ref={vig} offset={0.28} darkness={0.78} />
        {/* last: hides 8-bit banding rings in dark gradients */}
        <Dither />
      </EffectComposer>
    </Canvas>
  );
}
