import { factoryCounts, factorySteps } from "@/lib/content";
import Counter from "../Counter";
import { Eyebrow, Roll, Split } from "../ui";

export default function Factory() {
  return (
    <section className="factory" id="factory">
      <div className="factory__inner">
        <div className="section__head">
          <Eyebrow n="02">ИИ-контент-завод</Eyebrow>
          <Split text="Контент-завод: месяц контента за *одну* встречу" />
          <p className="lead" data-reveal>
            ИИ делает объём, люди — смысл и вкус. Вы тратите 1 час в месяц — мы выдаём контент на каждый
            день.
          </p>
        </div>

        <ol className="factory__steps">
          {factorySteps.map((s, i) => (
            <li key={s.n} data-reveal style={{ ["--i" as string]: i }}>
              <span className="factory__n">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>

        <div className="factory__counts">
          <span className="factory__counts-label" data-reveal>
            Что входит в месяц
          </span>
          {factoryCounts.map((c) => (
            <div key={c.label} className="factory__count" data-reveal>
              <strong>
                <Counter value={c.value} />
              </strong>
              <span>{c.label}</span>
            </div>
          ))}
        </div>

        <div className="factory__bottom">
          <p data-reveal>
            Объём и каналы настраиваем под вас: Telegram, VK, YouTube, Instagram*, Dzen, маркетплейсы.
          </p>
          <div data-reveal>
            <Roll href="#contact" variant="dark" cursor="7 дней">
              Хочу тестовую неделю контента
            </Roll>
          </div>
        </div>
        <p className="factory__note">
          * Instagram принадлежит компании Meta, признанной экстремистской организацией и запрещённой в
          РФ.
        </p>
      </div>
    </section>
  );
}
