"use client";

import { useState, type PointerEvent } from "react";
import { services } from "@/lib/content";
import { Eyebrow, Split } from "../ui";
import Quiz from "../Quiz";

function onCardMove(e: PointerEvent<HTMLElement>) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width;
  const y = (e.clientY - r.top) / r.height;
  el.style.setProperty("--mx", `${x * 100}%`);
  el.style.setProperty("--my", `${y * 100}%`);
  el.style.setProperty("--rx", `${(0.5 - y) * 6}deg`);
  el.style.setProperty("--ry", `${(x - 0.5) * 6}deg`);
}

function onCardLeave(e: PointerEvent<HTMLElement>) {
  e.currentTarget.style.setProperty("--rx", "0deg");
  e.currentTarget.style.setProperty("--ry", "0deg");
}

export default function Services() {
  const [quiz, setQuiz] = useState(false);

  return (
    <section className="section services" id="services">
      <div className="section__head">
        <Eyebrow n="01">Услуги</Eyebrow>
        <Split text="Что мы *делаем*" />
        <p className="lead" data-reveal>
          Берём одну задачу или весь цикл — от идеи до заявок.
        </p>
      </div>

      <div className="bento">
        {services.map((s) => (
          <article
            key={s.id}
            className={`card card--${s.size}`}
            onPointerMove={onCardMove}
            onPointerLeave={onCardLeave}
            data-reveal
            data-cursor="подробнее"
          >
            <div className="card__top">
              <span className="card__id">{s.id}</span>
              <span className="card__term">{s.term}</span>
            </div>
            <h3 className="card__title">{s.title}</h3>
            <p className="card__benefit">{s.benefit}</p>
            <div className="card__out">
              <span>На выходе</span>
              <p>{s.output}</p>
            </div>
            <span className="card__arrow" aria-hidden>
              ↗
            </span>
          </article>
        ))}
        <button className="card card--quiz" onClick={() => setQuiz(true)} data-reveal data-cursor="3 вопроса">
          <span className="card__id">?</span>
          <span className="card__title">
            Не знаю, что нужно — <em className="serif">помогите выбрать</em>
          </span>
          <span className="card__benefit">Квиз из 3 вопросов · 30 секунд</span>
          <span className="card__arrow" aria-hidden>
            →
          </span>
        </button>
      </div>

      {quiz && <Quiz onClose={() => setQuiz(false)} />}
    </section>
  );
}
