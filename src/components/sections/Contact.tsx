"use client";

import { useState, type FormEvent } from "react";
import { needChips } from "@/lib/content";
import { Roll, Split } from "../ui";

export default function Contact() {
  const [picked, setPicked] = useState<string[]>([]);
  const [sent, setSent] = useState(false);

  const toggle = (c: string) =>
    setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    // TODO: отправка в Telegram-бот + CRM, цель Яндекс Метрики
    setSent(true);
  };

  return (
    <section className="section contact" id="contact">
      <div className="contact__head">
        <Split text="Расскажите о задаче — найдём, где спрятано ваше *чудо*" />
        <p className="lead" data-reveal>
          Бесплатный разбор 15 минут. Уйдёте с 3 идеями для роста, даже если не станете нашим клиентом.
        </p>
      </div>

      {sent ? (
        <div className="contact__done">
          <span className="contact__star">✦</span>
          <h3>Готово!</h3>
          <p>
            Пока ждёте — заберите чек-лист «10 ошибок в упаковке бизнеса» в нашем{" "}
            <a href="#">Telegram</a>.
          </p>
        </div>
      ) : (
        <form className="form" onSubmit={submit} data-reveal>
          <label className="field">
            <input required name="name" placeholder=" " autoComplete="name" />
            <span>Имя</span>
          </label>
          <label className="field">
            <input required name="contact" placeholder=" " />
            <span>Telegram или телефон</span>
          </label>

          <fieldset className="chips">
            <legend>Что нужно</legend>
            {needChips.map((c) => (
              <button
                type="button"
                key={c}
                className={`chip ${picked.includes(c) ? "is-on" : ""}`}
                aria-pressed={picked.includes(c)}
                onClick={() => toggle(c)}
              >
                {c}
              </button>
            ))}
          </fieldset>

          <div className="form__bottom">
            <Roll type="submit" cursor="✦">
              Хочу чудо
            </Roll>
            <div className="form__meta">
              <span>Ответим за 2 часа в рабочее время</span>
              <label className="check">
                <input type="checkbox" required />
                <i />
                Согласен на обработку персональных данных (152-ФЗ)
              </label>
            </div>
          </div>
        </form>
      )}
    </section>
  );
}
