"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import ForestUI from "./ForestUI";
import { useDirector } from "./useDirector";
import { generateWorld } from "@/lib/world";
import { inspect, landmarks, live, SPAWN, useQuest, wonders } from "@/lib/forest";

const ForestCanvas = dynamic(() => import("./ForestCanvas"), { ssr: false });

export default function Forest() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // every visit grows its own forest; ?seed=123 shares one
    const q = new URLSearchParams(window.location.search).get("seed");
    const seed = q && /^\d{1,9}$/.test(q) ? Number(q) : Math.floor(100000 + Math.random() * 900000);
    live.seed = seed;
    const world = generateWorld(seed);
    (window as unknown as { __dbg: object }).__dbg = { live, world, wonders, landmarks, quest: useQuest, inspect }; // debug / screenshots
    live.x = SPAWN.x;
    live.z = SPAWN.z;
    // the world must exist before the canvas mounts
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true);
  }, []);

  useDirector();

  // the GPU dropped the WebGL context: grow a fresh canvas (new context)
  const [gen, setGen] = useState(0);
  const onLost = useCallback(() => {
    setTimeout(() => setGen((g) => g + 1), 300);
    useQuest.getState().say("Лес моргнул — видеокарта попросила передышку. Чудеса на месте.", "wall");
  }, []);

  return (
    <div className="forest">
      <div className="forest__stage">{ready && <ForestCanvas key={gen} onLost={onLost} />}</div>
      <ForestUI />
      <div className="grain" aria-hidden />
    </div>
  );
}
