"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { cases, stats } from "@/lib/content";
import Counter from "../Counter";
import { Eyebrow, Split } from "../ui";

gsap.registerPlugin(ScrollTrigger);

const gradients = [
  "radial-gradient(120% 90% at 20% 10%, #c8ff2e 0%, #2b3d00 45%, #0d0d0f 80%)",
  "radial-gradient(120% 90% at 80% 0%, #ff7ad9 0%, #4a0f3c 45%, #0d0d0f 80%)",
  "radial-gradient(120% 90% at 30% 100%, #6a8cff 0%, #121c4d 45%, #0d0d0f 80%)",
  "radial-gradient(120% 90% at 90% 90%, #ffb35c 0%, #4d2a08 45%, #0d0d0f 80%)",
];

export default function Cases() {
  const wrap = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add("(min-width: 900px)", () => {
      const t = track.current!;
      const distance = () => t.scrollWidth - window.innerWidth;
      gsap.to(t, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: {
          trigger: wrap.current,
          start: "top top",
          end: () => `+=${distance()}`,
          pin: true,
          scrub: 0.8,
          invalidateOnRefresh: true,
        },
      });
    });
    return () => mm.revert();
  }, []);

  return (
    <section className="cases" id="cases">
      <div className="stats">
        {stats.map((s) => (
          <div className="stat" key={s.label} data-reveal>
            <strong>
              <Counter value={s.value} suffix={s.suffix} />
            </strong>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      <div className="cases__pin" ref={wrap}>
        <div className="cases__track" ref={track}>
          <div className="cases__intro">
            <Eyebrow n="04">Кейсы</Eyebrow>
            <Split text="Чудеса, которые *уже* случились" />
            <p className="lead">Листайте дальше — по одному чуду на экран.</p>
          </div>

          {cases.map((c, i) => (
            <article className="case" key={c.niche} data-cursor="открыть">
              <div className="case__visual" style={{ background: gradients[c.hue] }}>
                <span className="case__result">{c.result}</span>
                <span className="case__result-label">{c.resultLabel}</span>
                <span className="case__badge">демо-кейс</span>
              </div>
              <div className="case__body">
                <div className="case__head">
                  <span className="case__n">0{i + 1}</span>
                  <h3>
                    {c.niche}, <span>{c.city}</span>
                  </h3>
                </div>
                <dl>
                  <dt>Было</dt>
                  <dd>{c.before}</dd>
                  <dt>Сделали</dt>
                  <dd className="case__tags">
                    {c.tags.map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </dd>
                </dl>
                <a href="#contact" className="case__more">
                  Подробнее →
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="section reviews">
        <div className="section__head">
          <Eyebrow n="05">Отзывы</Eyebrow>
          <Split text="Говорят *клиенты*" />
        </div>
        <div className="reviews__grid">
          {[0, 1, 2].map((i) => (
            <figure className="review" key={i} data-reveal data-cursor="▶ 0:30">
              <div className="review__video">
                <span className="review__play">▶</span>
                <span className="review__time">0:30</span>
              </div>
              <figcaption>
                <b>[Имя клиента]</b>
                <span>[Компания, ниша]</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
