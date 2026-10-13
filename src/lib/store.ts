// Mutable, non-reactive state shared between DOM and the WebGL scene.
// Read inside useFrame — never triggers React renders.
export const sceneState = {
  scroll: 0, // 0..1 page progress
  velocity: 0, // lenis velocity
  pointer: { x: 0, y: 0 }, // -1..1
  excite: 0, // bumped by hovering CTAs
  theme: 0, // 0 = dark, 1 = inside lime section
};

import type Lenis from "lenis";
export const lenisRef: { current: Lenis | null } = { current: null };
