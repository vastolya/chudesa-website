import type * as THREE from "three";

/** Things the crosshair can aim at. The player raycasts from screen center. */
export type Interactable = {
  id: string;
  object: THREE.Object3D;
  enabled: () => boolean;
  activate: () => void;
  label?: string; // crosshair hint, defaults to "поймать"
};

export const interactables = new Map<string, Interactable>();

/** Called when the player fires at nothing (used by the orbit wonder). */
export const onMiss: { current: () => void } = { current: () => {} };
