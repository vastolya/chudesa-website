"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function Counter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current!;
    const obj = { v: 0 };
    const tween = gsap.to(obj, {
      v: value,
      duration: 2,
      ease: "expo.out",
      paused: true,
      onUpdate: () => (el.textContent = Math.round(obj.v) + suffix),
    });
    const st = ScrollTrigger.create({ trigger: el, start: "top 92%", once: true, onEnter: () => tween.play() });
    return () => {
      tween.kill();
      st.kill();
    };
  }, [value, suffix]);

  return (
    <span ref={ref}>
      {value}
      {suffix}
    </span>
  );
}
