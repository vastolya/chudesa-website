"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { process } from "@/lib/content";
import { Eyebrow, Split } from "../ui";

gsap.registerPlugin(ScrollTrigger);

export default function Process() {
  const list = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        list.current!.parentElement!.querySelector(".process__line i"),
        { scaleY: 0 },
        {
          scaleY: 1,
          ease: "none",
          scrollTrigger: { trigger: list.current, start: "top 60%", end: "bottom 60%", scrub: true },
        }
      );
      gsap.utils.toArray<HTMLElement>(".process__step").forEach((el) => {
        ScrollTrigger.create({
          trigger: el,
          start: "top 60%",
          end: "bottom 60%",
          toggleClass: "is-active",
        });
      });
    });
    return () => ctx.revert();
  }, []);

  return (
    <section className="section process" id="process">
      <div className="process__side">
        <Eyebrow n="03">Как работаем</Eyebrow>
        <Split text="От заявки до результата — *5 шагов*" />
        <div className="guarantee" data-reveal>
          <span className="guarantee__icon">✦</span>
          <p>
            Работаем по договору, оплата этапами. Не устраивает промежуточный результат —{" "}
            <b>переделаем бесплатно.</b>
          </p>
        </div>
      </div>

      <div className="process__track">
      <div className="process__line" aria-hidden>
        <i />
      </div>
      <ol className="process__list" ref={list}>
        {process.map((s, i) => (
          <li key={s.title} className="process__step">
            <span className="process__n">0{i + 1}</span>
            <div>
              <span className="process__tag">{s.tag}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
      </div>
    </section>
  );
}
