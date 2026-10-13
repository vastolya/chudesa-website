"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { lenisRef, sceneState } from "@/lib/store";

const Scene = dynamic(() => import("./scene/Scene"), { ssr: false });

gsap.registerPlugin(ScrollTrigger);

export default function Experience() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lenis = new Lenis({ lerp: 0.09, smoothWheel: !reduce, anchors: { offset: -40 } });
    lenisRef.current = lenis;

    lenis.on("scroll", (l: Lenis) => {
      sceneState.scroll = l.limit > 0 ? l.scroll / l.limit : 0;
      sceneState.velocity = l.velocity;
      document.documentElement.style.setProperty("--scroll", String(sceneState.scroll));
      ScrollTrigger.update();
    });
    const tick = (t: number) => lenis.raf(t * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    const onMove = (e: PointerEvent) => {
      sceneState.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      sceneState.pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      lenisRef.current = null;
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <div className="scene" aria-hidden>
      <Scene />
    </div>
  );
}
