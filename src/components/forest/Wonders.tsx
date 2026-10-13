"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { live, REACH, useQuest, wonders, type WonderDef } from "@/lib/forest";
import { sfxCatch, sfxPing, sfxTick } from "@/lib/audio";
import { getGlowTexture } from "./creatureMaterial";
import { PALETTES, WONDER_SPECIES } from "@/lib/species";
import { pointerDist } from "./Creatures";
import { getWorld } from "@/lib/world";
import { interactables, onMiss } from "@/lib/interact";
import { useQuality } from "@/lib/quality";
import { Beacon } from "./Environment";
import { FoilLayer, MiniJelly, WonderBody } from "./WonderBodies";
import type { Drive } from "./wonderGlsl";

const v = new THREE.Vector3();

function Wonder({ w }: { w: WonderDef }) {
  const found = useQuest((s) => s.found.includes(w.id));
  const catchWonder = useQuest((s) => s.catchWonder);
  const say = useQuest((s) => s.say);
  const drawDist = useQuality((x) => x.s.drawDist);
  const sp = WONDER_SPECIES[w.id];

  const group = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group>(null!);
  const halo = useRef<THREE.Sprite>(null!);
  const shells = useRef<(THREE.Mesh | null)[]>([]);
  const hit = useRef<THREE.Mesh>(null!);
  const swarm = useRef<(THREE.Group | null)[]>([]);
  // what the body shaders read every frame
  const drive = useRef<Drive>({ opacity: 0, glow: 0.3 }).current;

  const ground = useMemo(() => getWorld().height(w.x, w.z), [w]);
  const home = useMemo(() => new THREE.Vector3(w.x, ground + w.y, w.z), [w, ground]);
  const glow = useMemo(() => getGlowTexture(), []);
  const swarmSeeds = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        a: (i / 22) * Math.PI * 2,
        r: 0.8 + ((i * 37) % 10) / 8,
        y: ((i * 53) % 10) / 10 - 0.5,
        sp: 0.35 + ((i * 17) % 10) / 15,
        pal: PALETTES[(i * 3) % PALETTES.length],
      })),
    []
  );

  const s = useRef({
    vis: 0,
    caught: false,
    catchT: 0,
    layers: 0,
    punch: 0,
    gaze: 0,
    shownUntil: 0,
    pinged: false,
    angle: 0,
    speed: 2.4,
    misses: 0,
    collected: new Set<number>(),
    pos: new THREE.Vector3(w.x, w.y + getWorld().height(w.x, w.z), w.z),
    frozenUntil: 0,
    followSince: 0,
  });

  const doCatch = () => {
    const st = s.current;
    if (st.caught) return;
    st.caught = true;
    st.catchT = 0;
    sfxCatch();
    setTimeout(() => catchWonder(w.id), 700);
  };

  useEffect(() => {
    if (w.mech !== "orbit") return;
    onMiss.current = () => {
      const st = s.current;
      if (st.caught || Math.hypot(live.x - w.x, live.z - w.z) > REACH) return;
      st.misses++;
      st.speed = Math.max(0.45, st.speed * 0.62);
      if (st.misses === 1) say("Мимо. Но смотрите — автоматизация уже подстраивается под вас.", "riddle");
      if (st.misses === 3) say("Ещё медленнее. Мы не торопим клиентов.", "riddle");
    };
  }, [w, say]);

  useFrame((state, dt) => {
    const st = s.current;
    const t = state.clock.elapsedTime;
    const cam = state.camera;

    if (st.caught) {
      st.catchT += dt;
      const k = Math.min(st.catchT / 0.9, 1);
      group.current.scale.setScalar((w.mech === "swarm" ? 1 : w.size) * (1 + k * 0.6) * (1 - k));
      group.current.position.y += dt * 2;
      body.current.rotation.y += dt * 12;
      drive.glow = 2;
      if (k >= 1) group.current.visible = false;
      return;
    }

    const pos = st.pos;
    const homeD = Math.hypot(live.x - w.x, live.z - w.z);
    const far = homeD > drawDist && w.mech !== "behind";
    group.current.visible = !far;
    if (far) return;
    const near = homeD < REACH;
    let target = 1;
    let glowT = 0.35;
    if (w.mech !== "behind" && w.mech !== "still") pos.copy(home);
    if (w.mech !== "behind" && w.mech !== "still") pos.y = home.y + Math.sin(t * 0.9 + w.hue * 20) * 0.18;
    const groundHere = getWorld().height(live.x, live.z);

    switch (w.mech) {
      case "lantern": {
        const lit = THREE.MathUtils.smoothstep(0.5, 0.12, pointerDist(pos, cam));
        target = 0.03 + lit * 0.97;
        glowT = lit * 1.1;
        if (lit > 0.6 && !st.pinged && near) {
          st.pinged = true;
          sfxPing(w.hue);
        }
        break;
      }
      case "still": {
        const now = performance.now();
        if (near && now - live.lastInput > 2800 && st.vis < 0.05 && st.shownUntil < now) {
          st.shownUntil = now + 9000;
          sfxPing(w.hue);
        }
        target = st.shownUntil > now ? 1 : 0;
        // it walks up to you when you stop fussing
        const fx = -Math.sin(live.yaw);
        const fz = -Math.cos(live.yaw);
        const goal = target > 0 ? v.set(live.x + fx * 4.5, groundHere + w.y, live.z + fz * 4.5) : v.copy(home);
        pos.lerp(goal, 1 - Math.exp(-dt * 0.8));
        glowT = 0.7;
        break;
      }
      case "layers": {
        st.punch *= Math.exp(-dt * 6);
        shells.current.forEach((sh, i) => {
          if (!sh) return;
          sh.visible = i >= st.layers;
          sh.rotation.y += dt * (0.2 + i * 0.15);
        });
        glowT = 0.3 + st.layers * 0.3;
        break;
      }
      case "gaze": {
        if (near && pointerDist(pos, cam) < 0.22) st.gaze = Math.min(1, st.gaze + dt / 1.6);
        else if (st.gaze < 1) st.gaze = Math.max(0, st.gaze - dt * 0.4);
        live.gazeProgress = near ? st.gaze : live.gazeProgress;
        // a faint flickering projection that becomes solid under your gaze
        target = 0.18 + st.gaze * 0.82;
        glowT = st.gaze;
        if (st.gaze >= 1 && !st.pinged) {
          st.pinged = true;
          sfxPing(w.hue);
        }
        break;
      }
      case "behind": {
        // lurks behind your back while you are in its part of the forest
        const now = performance.now();
        if (!near) st.followSince = 0;
        else if (!st.followSince) {
          st.followSince = now;
          pos.set(live.x + Math.sin(live.yaw) * 3.2, groundHere + 1.9, live.z + Math.cos(live.yaw) * 3.2);
          st.vis = 0;
        }
        v.copy(pos).project(cam);
        const inView = v.z < 1 && Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.95;
        if (inView && near && st.frozenUntil < now && now - st.followSince > 1500) {
          st.frozenUntil = now + 2600;
          sfxPing(w.hue);
          if (!st.pinged) {
            st.pinged = true;
            say("Попался. Кликните, пока он не спрятался снова.", "riddle");
          }
        }
        if (near && st.frozenUntil < now) {
          const bx = live.x + Math.sin(live.yaw) * 3.2;
          const bz = live.z + Math.cos(live.yaw) * 3.2;
          pos.lerp(v.set(bx, groundHere + 1.9, bz), 1 - Math.exp(-dt * 1.4));
        } else if (!near) pos.lerp(home, 1 - Math.exp(-dt * 0.5));
        pos.y += Math.sin(t * 1.2) * 0.004;
        target = 1;
        glowT = st.frozenUntil > now ? 1 : 0.5;
        break;
      }
      case "swarm": {
        target = 1;
        let left = 0;
        swarm.current.forEach((m, i) => {
          if (!m) return;
          const sd = swarmSeeds[i];
          if (st.collected.has(i)) {
            m.scale.multiplyScalar(Math.exp(-dt * 5));
            m.position.y += dt * 3;
            return;
          }
          left++;
          const a = sd.a + t * sd.sp;
          m.position.set(Math.cos(a) * sd.r * 1.6, sd.y * 1.8 + Math.sin(t * 1.3 + i) * 0.25, Math.sin(a) * sd.r * 1.2);
          if (near && pointerDist(m.getWorldPosition(v), cam) < 0.07) {
            st.collected.add(i);
            sfxTick(st.collected.size);
          }
        });
        live.swarmLeft = near ? left : live.swarmLeft;
        if (left === 0) doCatch();
        break;
      }
      case "orbit": {
        st.angle += dt * st.speed;
        pos.x += Math.cos(st.angle) * 2.6;
        pos.z += Math.sin(st.angle) * 2.6;
        pos.y += Math.sin(st.angle * 2) * 0.7 + 0.8;
        glowT = 0.8;
        break;
      }
    }

    st.vis += (target - st.vis) * (1 - Math.exp(-dt * 4));
    drive.opacity = st.vis;
    drive.glow += ((live.hover === w.id ? 1.2 : glowT) - drive.glow) * (1 - Math.exp(-dt * 4));
    group.current.position.copy(pos);
    group.current.scale.setScalar(w.mech === "swarm" ? 1 : w.size * (0.6 + st.vis * 0.4) * (1 + st.punch * 0.25));
    body.current.rotation.y += dt * (w.mech === "orbit" ? 1.2 : 0.3);
    body.current.visible = w.mech !== "swarm";
    (halo.current.material as THREE.SpriteMaterial).opacity = (w.mech === "swarm" ? 0.45 : st.vis * 0.5) * (near ? 1 : 0.6);
  });

  const clickable = () => {
    const st = s.current;
    if (st.caught) return false;
    if (w.mech === "gaze") return st.gaze >= 1;
    if (w.mech === "swarm") return false;
    return st.vis > 0.45;
  };

  const activate = () => {
    if (!clickable()) return;
    const st = s.current;
    if (w.mech === "layers") {
      st.layers++;
      st.punch = 1;
      sfxTick(st.layers * 2);
      if (st.layers < 3) {
        say(st.layers === 1 ? "Один слой снят. Под ним — смыслы. Ещё два." : "Остался последний — визуальный стиль. Ещё раз.", "riddle");
        return;
      }
    }
    doCatch();
  };

  useEffect(() => {
    hit.current.userData.interact = w.id;
    interactables.set(w.id, { id: w.id, object: hit.current, enabled: () => !s.current.caught && (clickable() || w.mech === "orbit"), activate });
    return () => void interactables.delete(w.id);
  });

  return (
    <>
      {!found && <Beacon x={w.x} z={w.z} color={w.color} opacity={0.13} />}
      <group ref={group} position={home} scale={w.mech === "swarm" ? 1 : w.size}>
        <group ref={body}>{w.mech !== "swarm" && <WonderBody id={w.id} drive={drive} fog colA={sp.colA} colB={sp.colB} />}</group>
        {/* cheap hit volume for the crosshair ray */}
        <mesh ref={hit} visible={false}>
          <sphereGeometry args={[w.mech === "orbit" ? 2.2 : 1.7, 12, 12]} />
        </mesh>
        {/* gift wrapping: foil layers peeled one click at a time */}
        {w.mech === "layers" &&
          [0, 1].map((i) => (
            <FoilLayer key={i} ref={(m) => void (shells.current[i] = m)} drive={drive} fog colA={sp.colA} radius={1.55 + (1 - i) * 0.35} />
          ))}
        {w.mech === "swarm" &&
          swarmSeeds.map((sd, i) => (
            <MiniJelly
              key={i}
              ref={(m) => void (swarm.current[i] = m)}
              drive={drive}
              fog
              colA={sd.pal[0]}
              colB={sd.pal[1]}
              phase={i * 0.7}
              scale={w.size * (0.9 + (i % 4) * 0.35)}
            />
          ))}
        <sprite ref={halo} scale={[5, 5, 1]}>
          <spriteMaterial map={glow} color={sp.glow} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      </group>
    </>
  );
}

export function Wonders() {
  return (
    <>
      {wonders.map((w) => (
        <Wonder key={w.id} w={w} />
      ))}
    </>
  );
}
