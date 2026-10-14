"use client";

import { createPortal, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { inspect, live, REACH, useQuest, WORLD_R } from "@/lib/forest";
import { getWorld } from "@/lib/world";
import { interactables, onMiss } from "@/lib/interact";
import { sfxStep } from "@/lib/audio";
import { getGlowTexture } from "./creatureMaterial";
import { QUALITY } from "@/lib/quality";

const WALK = 1.35;
const RUN = 2.8;
const STEP = 0.8;
const EYE = 1.68;
const SENS = 0.0021;

const center = new THREE.Vector2(0, 0);

/** Hand-held lantern rendered in camera space. */
function LanternModel({ group, flame }: { group: React.RefObject<THREE.Group | null>; flame: React.RefObject<THREE.Mesh | null> }) {
  const glow = useMemo(() => getGlowTexture(), []);
  const metal = <meshStandardMaterial color="#16161a" metalness={0.8} roughness={0.35} />;
  return (
    <group ref={group} position={[0.34, -0.36, -0.72]} scale={0.62}>
      {/* handle: the arc's ends sit on the cap's slope (cone radius = 0.15 - y), stretched up into a bail */}
      <mesh position={[0, 0.105, 0]} scale={[1, 1.7, 1]}>
        <torusGeometry args={[0.045, 0.005, 6, 20, Math.PI]} />
        {metal}
      </mesh>
      {/* finial */}
      <mesh position={[0, 0.152, 0]}>
        <sphereGeometry args={[0.009, 8, 6]} />
        {metal}
      </mesh>
      {/* cap */}
      <mesh position={[0, 0.115, 0]}>
        <coneGeometry args={[0.07, 0.07, 8]} />
        {metal}
      </mesh>
      <mesh position={[0, 0.075, 0]}>
        <cylinderGeometry args={[0.068, 0.068, 0.012, 12]} />
        {metal}
      </mesh>
      {/* glass */}
      <mesh>
        <cylinderGeometry args={[0.052, 0.052, 0.14, 12]} />
        <meshStandardMaterial color="#ffd9a0" emissive="#ffb85c" emissiveIntensity={0.55} transparent opacity={0.4} roughness={0.1} />
      </mesh>
      {/* flame */}
      <mesh ref={flame} position={[0, -0.01, 0]}>
        <sphereGeometry args={[0.02, 10, 8]} />
        <meshBasicMaterial color={[2, 1.35, 0.6]} toneMapped={false} />
      </mesh>
      {/* frame posts */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[Math.cos((i * Math.PI) / 2 + 0.78) * 0.056, 0, Math.sin((i * Math.PI) / 2 + 0.78) * 0.056]}>
          <boxGeometry args={[0.008, 0.15, 0.008]} />
          {metal}
        </mesh>
      ))}
      {/* base */}
      <mesh position={[0, -0.078, 0]}>
        <cylinderGeometry args={[0.064, 0.07, 0.022, 12]} />
        {metal}
      </mesh>
      <sprite scale={[0.36, 0.36, 1]}>
        <spriteMaterial map={glow} color="#ffb860" transparent opacity={0.25} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
    </group>
  );
}

export function Player() {
  const { camera, scene, gl } = useThree();
  const cam = camera as THREE.PerspectiveCamera;
  const lantern = useRef<THREE.Group>(null);
  const flame = useRef<THREE.Mesh>(null);
  const spot = useRef<THREE.SpotLight>(null!);
  const warm = useRef<THREE.PointLight>(null);
  const warmLight = QUALITY.warmLight;
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(0, -0.3, -12);
    return o;
  }, []);
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const s = useRef({ vx: 0, vz: 0, wheelVel: 0, stepAcc: 0, prevYaw: 0, sway: new THREE.Vector2(), fov: 64, roll: 0, hy: 0, lastHit: null as string | null, hold: 0 });

  // the camera must be in the scene for the hand-held lantern to render
  useEffect(() => {
    scene.add(camera);
    return () => void scene.remove(camera);
  }, [scene, camera]);

  useEffect(() => {
    gl.domElement.dataset.fps = "1";
    const w = window as unknown as { __dbg?: Record<string, unknown> };
    if (w.__dbg) w.__dbg.scene = scene; // debug / screenshots
  }, [gl, scene]);

  useFrame((state, dt) => {
    const d = Math.min(dt, 1 / 20);
    const st = s.current;
    const world = getWorld();
    const k = live.keys;
    let f = 0;
    let side = 0;
    let turn = 0;
    const run = k.has("ShiftLeft") || k.has("ShiftRight");

    if (!live.frozen) {
      f = (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) - (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0) - live.joy.y;
      side = (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0) + live.joy.x;
      turn = (k.has("KeyQ") || k.has("ArrowLeft") ? 1 : 0) - (k.has("KeyE") || k.has("ArrowRight") ? 1 : 0);
      live.yaw += turn * 1.7 * d - live.lookDX * SENS;
      live.pitch = THREE.MathUtils.clamp(live.pitch - live.lookDY * SENS, -1.25, 1.2);
      if (k.has("Space") && live.grounded) {
        live.vy = 4.3;
        live.grounded = false;
        live.jumps++;
      }
    }
    // inspecting a wonder: the mouse turns the wonder, not your head
    const holding = !!useQuest.getState().card;
    if (holding) {
      inspect.ry += live.lookDX * 0.006;
      inspect.rx += live.lookDY * 0.006;
    }
    st.hold += ((holding ? 1 : 0) - st.hold) * (1 - Math.exp(-d * 5));
    // lantern sway follows mouse *speed*, smoothed by real frame time (frame-rate independent)
    const swayK = 1 - Math.exp(-d * 9);
    st.sway.x += ((live.lookDX / Math.max(d, 1e-3)) * 0.00001 - st.sway.x) * swayK;
    st.sway.y += ((live.lookDY / Math.max(d, 1e-3)) * 0.00001 - st.sway.y) * swayK;
    st.sway.clampScalar(-0.03, 0.03);
    live.lookDX = 0;
    live.lookDY = 0;
    live.yawVel = (live.yaw - st.prevYaw) / Math.max(d, 1e-3);
    st.prevYaw = live.yaw;

    // wheel = small walking impulses
    st.wheelVel = THREE.MathUtils.clamp(st.wheelVel * Math.exp(-d * 2.5) + live.wheel * 0.004, -1.2, 1.2);
    live.wheel = 0;
    f = THREE.MathUtils.clamp(f + (live.frozen ? 0 : st.wheelVel), -1, 1);

    const sp = run ? RUN : WALK;
    const len = Math.max(Math.hypot(f, side), 1);
    const fx = -Math.sin(live.yaw);
    const fz = -Math.cos(live.yaw);
    const rx = Math.cos(live.yaw);
    const rz = -Math.sin(live.yaw);
    const tvx = ((fx * f + rx * side) / len) * sp;
    const tvz = ((fz * f + rz * side) / len) * sp;
    const acc = 1 - Math.exp(-d * (live.grounded ? 5 : 1.2));
    st.vx += (tvx - st.vx) * acc;
    st.vz += (tvz - st.vz) * acc;

    let nx = live.x + st.vx * d;
    let nz = live.z + st.vz * d;
    for (const c of world.colliders(nx, nz)) {
      const dx = nx - c.x;
      const dz = nz - c.z;
      const rr = c.r + 0.3;
      const dd = dx * dx + dz * dz;
      if (dd < rr * rr && dd > 1e-6) {
        const dl = Math.sqrt(dd);
        nx = c.x + (dx / dl) * rr;
        nz = c.z + (dz / dl) * rr;
      }
    }
    const rad = Math.hypot(nx, nz);
    if (rad > WORLD_R) {
      nx *= WORLD_R / rad;
      nz *= WORLD_R / rad;
    }
    const moved = Math.hypot(nx - live.x, nz - live.z);
    live.x = nx;
    live.z = nz;
    live.speed = moved / Math.max(d, 1e-3);

    // jump / gravity
    if (!live.grounded) {
      live.vy -= 12 * d;
      live.y += live.vy * d;
      if (live.y <= 0) {
        live.y = 0;
        live.vy = 0;
        live.grounded = true;
        sfxStep();
      }
    }

    if (live.grounded) {
      live.walked += moved;
      st.stepAcc += moved;
      if (st.stepAcc > STEP) {
        st.stepAcc = 0;
        sfxStep();
      }
    }

    // camera: ground-follow, bob, strafe roll, sprint FOV
    const gy = world.height(live.x, live.z);
    st.hy += (gy - st.hy) * (1 - Math.exp(-d * 10));
    const bobAmt = live.grounded ? Math.min(live.speed / WALK, 1.8) : 0;
    const phase = (live.walked / STEP) * Math.PI;
    const bobY = Math.abs(Math.sin(phase)) * 0.035 * bobAmt;
    const bobX = Math.cos(phase) * 0.018 * bobAmt;
    camera.position.set(live.x + Math.cos(live.yaw) * bobX, st.hy + EYE + live.y + bobY, live.z - Math.sin(live.yaw) * bobX);
    st.roll += (-side * 0.025 - st.roll) * (1 - Math.exp(-d * 5));
    camera.rotation.order = "YXZ";
    camera.rotation.set(live.pitch, live.yaw, st.roll + Math.sin(state.clock.elapsedTime * 0.4) * 0.003);
    const fovT = run && live.speed > 2 ? 72 : 64;
    st.fov += (fovT - st.fov) * (1 - Math.exp(-d * 4));
    if (Math.abs(cam.fov - st.fov) > 0.01) {
      cam.fov = st.fov;
      cam.updateProjectionMatrix();
    }

    // lantern sway + flicker
    if (lantern.current) {
      const t = state.clock.elapsedTime;
      // hands busy while holding a wonder: the lantern sinks out of the way
      lantern.current.position.set(0.34 - st.sway.x * 2 + bobX * 0.6 + st.hold * 0.06, -0.36 + st.sway.y * 2 - bobY * 0.5 + Math.sin(t * 1.3) * 0.004 - st.hold * 0.22, -0.72);
      lantern.current.rotation.set(st.sway.y * 3 + bobY * 2, -st.sway.x * 3, st.sway.x * 6 + Math.sin(phase) * 0.06 * bobAmt);
    }
    // light breathes slowly (no strobing); only the tiny flame model flickers
    const tt = state.clock.elapsedTime;
    const breath = 0.97 + Math.sin(tt * 1.1) * 0.03;
    spot.current.intensity = 34 * breath;
    if (warm.current) warm.current.intensity = 1.6 * breath;
    if (flame.current) flame.current.scale.setScalar(0.92 + Math.sin(tt * 13) * 0.05 + Math.sin(tt * 7.3) * 0.04);

    // aim: what is under the crosshair?
    ray.setFromCamera(center, camera);
    ray.far = REACH;
    let hit: string | null = null;
    const objs: THREE.Object3D[] = [];
    interactables.forEach((it) => it.enabled() && objs.push(it.object));
    if (objs.length && !holding) {
      // only the low-poly hit spheres are tested, never the detailed shader meshes
      const res = ray.intersectObjects(objs, false);
      if (res.length) hit = res[0].object.userData.interact ?? null;
    }
    live.hover = hit;
    if (hit !== st.lastHit) {
      st.lastHit = hit;
      document.documentElement.classList.toggle("is-grab", !!hit);
    }
    if (live.fire) {
      live.fire = false;
      if (holding) inspect.release();
      else if (hit) interactables.get(hit)?.activate();
      else onMiss.current();
    }
  });

  return (
    <>
      {createPortal(
        <>
          <LanternModel group={lantern} flame={flame} />
          <spotLight
            ref={spot}
            position={[0.3, -0.25, -0.5]}
            target={target}
            color="#ffd9a6"
            intensity={34}
            distance={28}
            angle={0.55}
            penumbra={0.95}
            decay={1.4}
          />
          <primitive object={target} />
          {warmLight && <pointLight ref={warm} position={[0.3, -0.25, -0.6]} color="#ffb86b" intensity={1.6} distance={4.5} decay={1.5} />}
        </>,
        camera
      )}
    </>
  );
}
