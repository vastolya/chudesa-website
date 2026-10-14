"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { Hud, PerspectiveCamera, Sparkles } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { inspect, landmarks, live, useQuest, wonders } from "@/lib/forest";
import { sfxTick } from "@/lib/audio";
import { getGlowTexture } from "./creatureMaterial";
import { WONDER_SPECIES } from "@/lib/species";
import { WonderBody } from "./WonderBodies";
import { QUALITY } from "@/lib/quality";
import type { Drive } from "./wonderGlsl";

const ease = (x: number) => 1 - Math.pow(1 - Math.min(Math.max(x, 0), 1), 3);

/**
 * The caught wonder floats into your hands; drag to turn it and look at it from
 * every side while the world falls out of focus. Its meaning is shown in the
 * glass panel (ForestUI → InspectPanel), in the same style as the rest of the site.
 */
function Held({ id }: { id: string }) {
  const { camera, size } = useThree();
  const fov = (camera as THREE.PerspectiveCamera).fov;
  const close = useQuest((s) => s.closeCard);
  const say = useQuest((s) => s.say);
  const w = wonders.find((x) => x.id === id)!;

  const sp = WONDER_SPECIES[w.id];
  const drive = useRef<Drive>({ opacity: 1, glow: 0.5 }).current;
  const glow = useMemo(() => getGlowTexture(), []);

  // wonder sits in the left part of the frame (the panel takes the right); on portrait it sits on top
  const L = useMemo(() => {
    const D = 0.82;
    const halfH = D * Math.tan(THREE.MathUtils.degToRad(fov / 2));
    const aspect = size.width / size.height;
    const halfW = halfH * aspect;
    if (aspect < 1.15) return { pos: [0, halfH * 0.4] as [number, number], scale: 0.095 };
    // the panel starts 24px right of centre (see .ipanel); the ring ends ~30px before it
    const px = halfW / (size.width / 2); // world units per screen pixel at this depth
    const scale = 0.15;
    const ringR = 1.75 * scale;
    return { pos: [-(24 + 30) * px - ringR, 0] as [number, number], scale };
  }, [fov, size.width, size.height]);

  const holder = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group>(null!);
  const st = useRef({ t: 0, closing: -1, want: false, rx: 0, ry: 0, moved: 0, lastRy: 0 });

  useEffect(() => {
    inspect.rx = 0.25;
    inspect.ry = 0;
    const release = (want: boolean) => {
      const s = st.current;
      if (s.closing >= 0) return;
      s.closing = s.t;
      s.want = want;
      sfxTick(want ? 7 : 4);
      setTimeout(() => {
        if (want) {
          const f = landmarks.find((l) => l.id === "final")!;
          live.x = f.x;
          live.z = f.z + 11;
          live.yaw = 0;
          say("Хорошо, срежем путь. В лесу так нельзя, но для вас — можно.", "wall");
        } else {
          const n = useQuest.getState().found.length;
          say(
            n === 7
              ? "Все семь у вас. Идите на зелёный столб — на поляну."
              : n === 1
                ? "Первое чудо — ваше. Осталось шесть, они где-то среди столбов света."
                : `Чудо отпущено. Найдено ${n} из 7.`,
            "story"
          );
        }
        close();
      }, 650);
    };
    inspect.release = () => release(false);
    inspect.want = () => release(true);
    say("Оно у вас в руках. Потяните его мышью — рассмотрите со всех сторон.", "story");
    return () => {
      inspect.release = () => {};
      inspect.want = () => {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useFrame((state, dt) => {
    const s = st.current;
    s.t += dt;
    const t = s.t;
    const out = s.closing >= 0 ? 1 - ease((t - s.closing) / 0.6) : 1;
    const enter = ease(t / 0.9);
    inspect.amount = enter * out;

    // fly in from the forest, settle in the hands; on release float up and fade
    holder.current.position.set(L.pos[0], L.pos[1] + (1 - out) * (s.want ? 0 : 0.25), -0.82 - (1 - enter) * 2.4 - (s.want ? (1 - out) * 3 : 0));
    holder.current.scale.setScalar(L.scale * (0.4 + 0.6 * enter) * (0.2 + 0.8 * out));

    // drag turns it; until touched it slowly turns by itself as an invitation
    s.moved += Math.abs(inspect.ry - s.lastRy);
    if (s.moved < 0.15) inspect.ry += dt * 0.25;
    s.lastRy = inspect.ry;
    inspect.rx = THREE.MathUtils.clamp(inspect.rx, -1.3, 1.3);
    s.rx += (inspect.rx - s.rx) * (1 - Math.exp(-dt * 8));
    s.ry += (inspect.ry - s.ry) * (1 - Math.exp(-dt * 8));
    body.current.rotation.set(s.rx, s.ry, 0);

    drive.glow = 0.5 + 0.15 * Math.sin(t * 1.3);
  });

  // drawn as a separate layer on top of the finished, defocused frame — the blur never touches it
  return (
    <Hud renderPriority={2}>
      <PerspectiveCamera makeDefault position={[0, 0, 0]} fov={fov} near={0.01} far={10} />
      <group ref={holder} scale={0}>
        <group ref={body}>
          <WonderBody id={w.id} drive={drive} fog={false} colA={sp.colA} colB={sp.colB} cheap={QUALITY.cheap} />
        </group>
        <sprite scale={[5.5, 5.5, 1]}>
          <spriteMaterial map={glow} color={sp.glow} transparent opacity={0.3} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
        <Sparkles count={30} scale={4} size={2.5} speed={0.35} color={sp.glow} />
      </group>
    </Hud>
  );
}

export function Inspect() {
  const card = useQuest((s) => s.card);
  useEffect(() => {
    if (!card) inspect.amount = 0;
  }, [card]);
  return card ? <Held key={card} id={card} /> : null;
}
