import { marquee, microTrust, tools } from "@/lib/content";
import { Roll } from "../ui";

export default function Hero() {
  return (
    <>
      <section className="hero" id="top">
        <div className="hero__meta">
          <span>Агентство полного цикла</span>
          <span>От идеи до заявок</span>
          <span className="hero__live">
            <i /> Открыты к новым проектам
          </span>
        </div>

        <h1 className="hero__title" aria-label="Маркетинг × Разработка × ИИ">
          <span className="w" aria-hidden>
            <span>Маркетинг</span>
          </span>
          <span className="w hero__row2" aria-hidden>
            <span>
              <em className="serif x">×</em>Разработка
            </span>
          </span>
          <span className="w" aria-hidden>
            <span>
              <em className="serif x">×</em>
              <span className="hero__ai">ИИ</span>
            </span>
          </span>
        </h1>

        <div className="hero__bottom">
          <p className="hero__lead hero-in">
            Делаем так, чтобы ваш бизнес выглядел как <em className="serif">чудо</em> — и продавал как
            система.
          </p>
          <div className="hero__actions hero-in">
            <Roll href="#contact" cursor="15 минут">
              Получить разбор за 15 минут
            </Roll>
            <Roll href="#cases" variant="ghost" cursor="смотреть">
              Смотреть кейсы
            </Roll>
          </div>
          <ul className="hero__trust hero-in">
            {microTrust.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>

        <div className="hero__scroll" aria-hidden>
          <span>скролл</span>
          <i />
        </div>
      </section>

      <div className="marquee" aria-label={marquee.join(", ")}>
        {[0, 1].map((k) => (
          <div className="marquee__track" key={k} aria-hidden>
            {[...marquee, ...marquee].map((m, i) => (
              <span key={i}>
                {m}
                <b>✦</b>
              </span>
            ))}
          </div>
        ))}
      </div>

      <section className="trust">
        <p className="trust__label">Работаем с инструментами</p>
        <ul className="trust__list">
          {tools.map((t) => (
            <li key={t} data-reveal>
              {t}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
