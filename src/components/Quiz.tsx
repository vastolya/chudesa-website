"use client";

import { useEffect, useState } from "react";
import { quiz } from "@/lib/content";
import { lenisRef } from "@/lib/store";

const recs = [
  { title: "Стратегия → Сайт → Контент", text: "Соберём воронку, которая приводит заявки каждый день." },
  { title: "Исследование → Упаковка", text: "Сначала поймём, за что вам платят, потом скажем это за 5 секунд." },
  { title: "Контент-завод", text: "Месяц контента за одну встречу — ИИ делает объём, люди дают смысл." },
  { title: "Автоматизация", text: "CRM, боты и автоворонки — рутина работает сама." },
];


export default function Quiz({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);

  useEffect(() => {
    lenisRef.current?.stop();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      lenisRef.current?.start();
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const pick = (i: number) => {
    setAnswers([...answers.slice(0, step), i]);
    setStep(step + 1);
  };

  const done = step >= quiz.length;
  const rec = recs[answers[1] ?? 0];

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Квиз" onClick={onClose}>
      <div className="modal__box" onClick={(e) => e.stopPropagation()} data-lenis-prevent>
        <button className="modal__close" onClick={onClose} aria-label="Закрыть">
          ✕
        </button>
        <div className="quiz__progress">
          {quiz.map((_, i) => (
            <i key={i} className={i < step ? "is-done" : i === step ? "is-active" : ""} />
          ))}
        </div>

        {!done ? (
          <div className="quiz__step" key={step}>
            <span className="quiz__count">
              Вопрос {step + 1} / {quiz.length}
            </span>
            <h3>{quiz[step].q}</h3>
            <div className="quiz__opts">
              {quiz[step].options.map((o, i) => (
                <button key={o} className="quiz__opt" onClick={() => pick(i)}>
                  <span>{String.fromCharCode(65 + i)}</span>
                  {o}
                </button>
              ))}
            </div>
            {step > 0 && (
              <button className="quiz__back" onClick={() => setStep(step - 1)}>
                ← назад
              </button>
            )}
          </div>
        ) : (
          <div className="quiz__step" key="done">
            <span className="quiz__count">Ваше чудо начинается с</span>
            <h3>{rec.title}</h3>
            <p className="quiz__text">
              {rec.text}
              {answers[2] === 0 && " Стартуем с прототипа — проверим идею до больших вложений."}
            </p>
            <a
              className="btn btn--primary"
              href="#contact"
              onClick={(e) => {
                e.preventDefault();
                onClose();
                setTimeout(() => lenisRef.current?.scrollTo("#contact", { offset: -40 }), 50);
              }}
            >
              <span className="roll__inner">
                <span>Обсудить на разборе</span>
                <span aria-hidden>Обсудить на разборе</span>
              </span>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
