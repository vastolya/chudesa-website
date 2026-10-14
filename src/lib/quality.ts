/**
 * One look for everyone: the best picture a mid-range computer (integrated Intel/AMD
 * graphics, a few years old) renders smoothly. There are no quality tiers on purpose —
 * guessing the GPU, stepping down at runtime and recompiling every material on each step
 * caused more freezes than it ever saved.
 */
export const QUALITY = {
  dpr: [1, 1.15] as [number, number], // device pixel ratio, clamped to this range
  shadows: true,
  shadowSize: 1024,
  bloomScale: 0.5, // bloom render resolution scale
  bloomLevels: 6, // mip levels of the bloom blur
  drawDist: 66, // props / creatures beyond this are not drawn (fog hides them anyway)
  wonderDist: 36, // wonder bodies are drawn/animated only this close (beacons are always on)
  creatures: 46, // how many ambient creatures exist
  creatureDetail: 0.6, // multiplier for sphere tessellation
  detailFloor: 12, // smallest sphere tessellation allowed
  cheap: false, // simplified shaders (one noise octave, no Voronoi veins, no snow glitter)
  snow: 3200, // falling flakes
  drift: 1000, // ground drift particles
  stars: 2500,
  auroras: 3, // aurora ribbons in the sky
  groundTex: 2048, // size of the painted snow texture
  warmLight: true, // small point light on the hand lantern
};
