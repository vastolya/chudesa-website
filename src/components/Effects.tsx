"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { sceneState } from "@/lib/store";

gsap.registerPlugin(ScrollTrigger);

/** Global micro-interactions: cursor, magnetic buttons, scroll reveals, word splits. */
export default function Effects() {
  const dot = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const ctx = gsap.context(() => {
      // Word-by-word headings
      gsap.utils.toArray<HTMLElement>("[data-split]").forEach((el) => {
        const words = el.querySelectorAll(".w > span");
        gsap.from(words, {
          yPercent: 115,
          rotate: 4,
          duration: 1.1,
          ease: "expo.out",
          stagger: 0.06,
          scrollTrigger: { trigger: el, start: "top 88%" },
        });
      });

      // Generic fade-up
      gsap.set("[data-reveal]", { opacity: 0 });
      ScrollTrigger.batch("[data-reveal]", {
        start: "top 90%",
        once: true,
        onEnter: (els) =>
          gsap.fromTo(
            els,
            { y: 50, opacity: 0 },
            { y: 0, opacity: 1, duration: 1, ease: "expo.out", stagger: 0.08 }
          ),
      });
    });

    // Magnetic buttons + orb excitement
    const magnets = Array.from(document.querySelectorAll<HTMLElement>("[data-magnetic]"));
    const cleanups: (() => void)[] = [];
    magnets.forEach((el) => {
      const move = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - (r.left + r.width / 2);
        const y = e.clientY - (r.top + r.height / 2);
        gsap.to(el, { x: x * 0.25, y: y * 0.35, duration: 0.6, ease: "power3.out" });
      };
      const enter = () => (sceneState.excite = 1);
      const leave = () => {
        sceneState.excite = 0;
        gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: "elastic.out(1, 0.4)" });
      };
      if (fine) el.addEventListener("pointermove", move);
      el.addEventListener("pointerenter", enter);
      el.addEventListener("pointerleave", leave);
      cleanups.push(() => {
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerenter", enter);
        el.removeEventListener("pointerleave", leave);
      });
    });

    // Custom cursor
    if (fine && dot.current) {
      document.documentElement.classList.add("has-cursor");
      const xTo = gsap.quickTo(dot.current, "x", { duration: 0.35, ease: "power3" });
      const yTo = gsap.quickTo(dot.current, "y", { duration: 0.35, ease: "power3" });
      const move = (e: PointerEvent) => {
        xTo(e.clientX);
        yTo(e.clientY);
        const t = (e.target as HTMLElement).closest<HTMLElement>("[data-cursor], a, button, label");
        const text = t?.dataset.cursor ?? "";
        dot.current!.classList.toggle("is-hover", !!t);
        dot.current!.classList.toggle("is-label", !!text);
        if (label.current) label.current.textContent = text;
      };
      window.addEventListener("pointermove", move);
      cleanups.push(() => window.removeEventListener("pointermove", move));
    }

    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener("load", refresh);
    cleanups.push(() => window.removeEventListener("load", refresh));

    return () => {
      ctx.revert();
      cleanups.forEach((c) => c());
    };
  }, []);

  return (
    <div ref={dot} className="cursor" aria-hidden>
      <span ref={label} />
    </div>
  );
}
