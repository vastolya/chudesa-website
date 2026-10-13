"use client";

import { useEffect, useRef, useState, type FormEvent, type PointerEvent as RPointerEvent } from "react";
import { distTo, inspect, landmarks, live, useQuest, wonders } from "@/lib/forest";
import { cases, factoryCounts, factorySteps, needChips, process, services, stats } from "@/lib/content";
import { lockPointer } from "@/lib/pointerLock";
import { WONDER_SPECIES } from "@/lib/species";
import { audioStart, audioStop } from "@/lib/audio";
import { interactables } from "@/lib/interact";

function useRaf(fn: () => void, deps: unknown[] = []) {
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      fn();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/* ───────── gate ───────── */
function Gate() {
  const phase = useQuest((s) => s.phase);
  const enter = useQuest((s) => s.enter);
  const say = useQuest((s) => s.say);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = [700, 2100, 3700, 5000].map((ms, i) => setTimeout(() => setStep(i + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, []);

  const go = (sound: boolean) => {
    if (sound) audioStart();
    enter(sound);
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const night = d.getHours() >= 18 || d.getHours() < 6;
    setTimeout(
      () =>
        say(
          night
            ? `На ваших часах ${hh}:${mm}. В лесу тоже ночь. Видите столбы света? Под каждым — чудо.`
            : `На ваших часах ${hh}:${mm} — день. Но в этом лесу всегда ночь. Видите столбы света? Под каждым — чудо.`,
          "wall"
        ),
      900
    );
  };

  return (
    <div className={`gate ${phase !== "gate" ? "is-gone" : ""}`}>
      <div className="gate__lines">
        <p className={step >= 1 ? "on" : ""}>Это не сайт.</p>
        <p className={step >= 2 ? "on" : ""}>
          Это зимний лес. В нём спрятано <em className="serif">семь чудес</em> — семь вещей, которые мы умеем делать для
          бизнеса.
        </p>
        <p className={`gate__small ${step >= 3 ? "on" : ""}`}>
          Ходите куда хотите, в любом порядке. Найдёте все — получите разбор бесплатно. Не найдёте — тоже получите. Мы не злые.
        </p>
      </div>
      <div className={`gate__actions ${step >= 4 ? "on" : ""}`}>
        <button className="gate__btn gate__btn--main" onClick={() => go(true)}>
          <span>♪</span> Войти со звуком
          <small>лучше в наушниках</small>
        </button>
        <button className="gate__btn" onClick={() => go(false)}>
          Войти в тишине
        </button>
        <a className="gate__escape" href="/classic">
          или обычный сайт, если вы спешите →
        </a>
      </div>
    </div>
  );
}

/* ───────── compass: where the wonders and places are ───────── */
const FOV = 1.9; // radians shown across the bar
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

type CompassItem = { id: string; at: { x: number; z: number }; label: string; kind: "card" | "place" | "wonder"; color?: string; title?: string };
const compassItems: CompassItem[] = [
  { id: "N", at: { x: 0, z: -1e6 }, label: "С", kind: "card" },
  { id: "E", at: { x: 1e6, z: 0 }, label: "В", kind: "card" },
  { id: "S", at: { x: 0, z: 1e6 }, label: "Ю", kind: "card" },
  { id: "W", at: { x: -1e6, z: 0 }, label: "З", kind: "card" },
  // live references: positions are filled in by the world generator
  ...landmarks.map((l): CompassItem => ({ id: l.id, at: l, label: l.icon, kind: "place", title: l.label })),
  ...wonders.map((w): CompassItem => ({ id: w.id, at: w, label: "?", kind: "wonder", color: w.color })),
];

function Compass() {
  const found = useQuest((s) => s.found);
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  useRaf(() => {
    for (const it of compassItems) {
      const el = refs.current[it.id];
      if (!el) continue;
      const dx = it.at.x - live.x;
      const dz = it.at.z - live.z;
      const rel = wrap(Math.atan2(-dx, -dz) - live.yaw);
      const vis = Math.abs(rel) < FOV / 2;
      const hidden = it.kind === "wonder" && found.includes(it.id);
      el.style.opacity = vis && !hidden ? String(1 - Math.pow(Math.abs(rel) / (FOV / 2), 4)) : "0";
      el.style.left = `${50 - (rel / (FOV / 2)) * 50}%`;
      if (it.kind !== "card") {
        const lab = el.querySelector("small");
        if (lab) lab.textContent = `${Math.round(Math.hypot(dx, dz))} м`;
      }
    }
  }, [found]);

  return (
    <div className="compass" aria-hidden>
      {compassItems.map((it) => (
        <div
          key={it.id}
          ref={(el) => void (refs.current[it.id] = el)}
          className={`compass__item compass__item--${it.kind}`}
          style={{ ["--c" as string]: it.color }}
          title={it.title}
        >
          <span>{it.label}</span>
          {it.kind !== "card" && <small />}
        </div>
      ))}
    </div>
  );
}

/* ───────── HUD ───────── */
function Hud() {
  const phase = useQuest((s) => s.phase);
  const found = useQuest((s) => s.found);
  const sound = useQuest((s) => s.sound);
  const setSound = useQuest((s) => s.setSound);
  const say = useQuest((s) => s.say);
  const coords = useRef<HTMLSpanElement>(null);
  const seed = useRef<HTMLSpanElement>(null);

  useRaf(() => {
    if (coords.current) coords.current.textContent = `${live.x.toFixed(0)} · ${(-live.z).toFixed(0)}`;
    if (seed.current && live.seed) seed.current.textContent = String(live.seed);
  });

  const toggleSound = () => {
    if (sound) audioStop();
    else audioStart();
    setSound(!sound);
  };

  return (
    <div className={`hud ${phase === "walk" ? "on" : ""}`}>
      <span className="hud__logo">
        <span className="logo__star">✦</span>Чудеса
      </span>
      <div className="hud__jar" title="Найденные чудеса">
        <div className="hud__slots">
          {wonders.map((w) => (
            <i key={w.id} className={found.includes(w.id) ? "is-found" : ""} style={{ ["--c" as string]: w.color }} />
          ))}
        </div>
        <span>{found.length} / 7 чудес</span>
      </div>
      <Compass />
      <div className="hud__right">
        <button className={`hud__sound ${sound ? "is-on" : ""}`} onClick={toggleSound} aria-label="Звук">
          <i />
          <i />
          <i />
          <i />
        </button>
        <a className="hud__escape" href="/classic" onMouseEnter={() => say("Уже уходите? Понимаем. Не все любят лес.", "wall")}>
          обычный сайт →
        </a>
      </div>
      <div className="hud__depth">
        лес № <span ref={seed}>—</span> · вы здесь <span ref={coords}>0 · 0</span>
      </div>
    </div>
  );
}

/* ───────── controls hint ───────── */
function Controls() {
  const phase = useQuest((s) => s.phase);
  const ref = useRef<HTMLDivElement>(null);
  useRaf(() => {
    if (!ref.current) return;
    ref.current.classList.toggle("on", phase === "walk" && live.walked < 8 && !useQuest.getState().card);
    ["KeyW", "KeyA", "KeyS", "KeyD"].forEach((k) =>
      ref.current!.querySelector(`.k-${k.slice(3).toLowerCase()}`)?.classList.toggle("down", live.keys.has(k))
    );
  }, [phase]);
  return (
    <div className="controls" ref={ref}>
      <div className="controls__keys">
        <kbd className="k-w">W</kbd>
        <kbd className="k-a">A</kbd>
        <kbd className="k-s">S</kbd>
        <kbd className="k-d">D</kbd>
      </div>
      <ul>
        <li>
          <b>WASD</b> — идти, <b>Shift</b> — бежать, <b>Space</b> — прыжок
        </li>
        <li>
          <b>Мышь</b> — смотреть, фонарь светит в центр прицела
        </li>
        <li>
          <b>ЛКМ</b> — поймать чудо, <b>Esc</b> — освободить курсор
        </li>
      </ul>
    </div>
  );
}

/* ───────── mobile joystick ───────── */
function Joystick() {
  const knob = useRef<HTMLDivElement>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const move = (e: RPointerEvent<HTMLDivElement>) => {
    if (!origin.current) return;
    let dx = e.clientX - origin.current.x;
    let dy = e.clientY - origin.current.y;
    const l = Math.hypot(dx, dy);
    if (l > 46) {
      dx = (dx / l) * 46;
      dy = (dy / l) * 46;
    }
    live.joy.x = dx / 46;
    live.joy.y = dy / 46;
    live.lastInput = performance.now();
    if (knob.current) knob.current.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  const end = () => {
    origin.current = null;
    live.joy.x = 0;
    live.joy.y = 0;
    if (knob.current) knob.current.style.transform = "";
  };
  return (
    <div
      className="joy"
      onPointerDown={(e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        const r = e.currentTarget.getBoundingClientRect();
        origin.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        move(e);
      }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="joy__knob" ref={knob} />
    </div>
  );
}

/* ───────── narrator ───────── */
function Narrator() {
  const narr = useQuest((s) => s.narr);
  const [shown, setShown] = useState("");
  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(narr.text.slice(0, i));
      if (i >= narr.text.length) clearInterval(id);
    }, 24);
    return () => clearInterval(id);
  }, [narr]);
  return (
    <div className={`narr narr--${narr.tone} ${narr.text ? "on" : ""}`} key={narr.id} aria-live="polite">
      <span className="narr__tag">
        {narr.tone === "riddle" ? "загадка" : narr.tone === "hint" ? "подсказка" : narr.tone === "wall" ? "лес" : "голос"}
      </span>
      <p>
        {shown}
        <i className="narr__caret" />
      </p>
    </div>
  );
}

/* ───────── crosshair + click-to-play ───────── */
function Crosshair() {
  const phase = useQuest((s) => s.phase);
  const ring = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const play = useRef<HTMLDivElement>(null);
  useRaf(() => {
    if (ring.current) {
      const g = live.near === "prototype" ? live.gazeProgress : 0;
      ring.current.style.setProperty("--g", String(g));
      ring.current.classList.toggle("on", g > 0.02 && g < 1);
    }
    if (label.current) {
      const swarm = live.near === "content" && live.swarmLeft > 0;
      label.current.textContent = live.hover ? interactables.get(live.hover)?.label ?? "поймать" : swarm ? `рой: ещё ${live.swarmLeft}` : "";
    }
    if (play.current) {
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      play.current.classList.toggle("on", phase === "walk" && !live.locked && !coarse && !useQuest.getState().card);
    }
  }, [phase]);
  return (
    <>
      <div className="lantern" aria-hidden />
      <div className="xhair" aria-hidden>
        <i />
        <div className="gaze-ring" ref={ring} />
        <span ref={label} />
      </div>
      <div className="clickplay" ref={play}>
        <span>✦</span>
        <p>Кликните, чтобы взять фонарь</p>
        <small>Esc — отпустить. Подойдёте к поляне — отпустите, чтобы заполнить форму.</small>
      </div>
      <button className="action" onPointerDown={() => (live.fire = true)} aria-label="Поймать">
        ✦
      </button>
    </>
  );
}

/* ───────── places: panels appear when you walk up to them ───────── */
function useNear(test: () => number) {
  const ref = useRef<HTMLDivElement>(null);
  useRaf(() => {
    const o = live.frozen ? 0 : test();
    const el = ref.current;
    if (!el) return;
    el.style.opacity = String(o);
    el.style.transform = `translateY(${(1 - o) * 24}px)`;
    el.style.pointerEvents = o > 0.5 ? "auto" : "none";
    el.style.visibility = o > 0.001 ? "visible" : "hidden";
  });
  return ref;
}
const nearPlace = (id: string) => {
  const l = landmarks.find((x) => x.id === id)!;
  return Math.min(Math.max((l.r + 4 - distTo(l.x, l.z)) / 4, 0), 1);
};

function TitleChapter() {
  const phase = useQuest((s) => s.phase);
  const ref = useNear(() => (phase === "walk" ? Math.min(Math.max(1 - live.walked / 5, 0), 1) : 0));
  return (
    <div className="ch ch--title" ref={ref}>
      <span className="ch__eyebrow">агентство · лес · ночь</span>
      <h1>
        <span>Маркетинг</span>
        <span>
          <em className="serif">×</em> Разработка
        </span>
        <span>
          <em className="serif">×</em> <span className="ai">ИИ</span>
        </span>
      </h1>
    </div>
  );
}

function ProcessChapter() {
  const ref = useNear(() => nearPlace("process"));
  return (
    <div className="ch ch--panel ch--left" ref={ref}>
      <span className="ch__eyebrow">камни пяти шагов</span>
      <h2>
        От заявки до результата — <em className="serif">5 шагов</em>
      </h2>
      <ol className="ch__steps">
        {process.map((s, i) => (
          <li key={s.title}>
            <span>0{i + 1}</span>
            <div>
              <b>{s.title}</b>
              <p>{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="ch__guarantee">✦ Договор, оплата этапами. Не устроит промежуточный результат — переделаем бесплатно.</p>
      <div className="ch__stats">
        {stats.map((s) => (
          <div key={s.label}>
            <strong>
              {s.value}
              {s.suffix}
            </strong>
            <span>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CasesChapter() {
  const ref = useNear(() => nearPlace("cases"));
  return (
    <div className="ch ch--cases" ref={ref}>
      <h2>
        Чудеса, которые <em className="serif">уже</em> случились
      </h2>
      <div className="ch__cases">
        {cases.map((c) => (
          <article key={c.niche}>
            <span className="ch__badge">демо-кейс</span>
            <strong>{c.result}</strong>
            <span className="ch__rl">{c.resultLabel}</span>
            <h3>
              {c.niche}, {c.city}
            </h3>
            <p>Было: {c.before}</p>
            <div className="ch__tags">
              {c.tags.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function FinalChapter() {
  const ref = useNear(() => nearPlace("final"));
  const found = useQuest((s) => s.found);
  const [picked, setPicked] = useState<string[]>([]);
  const [sent, setSent] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    // TODO: Telegram-бот + CRM, цель Метрики
    setSent(true);
  };
  return (
    <div className="ch ch--panel ch--final" ref={ref}>
      {sent ? (
        <div className="final__done">
          <span>✦</span>
          <h2>Готово!</h2>
          <p>Ответим за 2 часа в рабочее время. Пока ждёте — заберите чек-лист «10 ошибок в упаковке бизнеса» в нашем Telegram.</p>
        </div>
      ) : (
        <>
          <span className="ch__eyebrow">
            {found.length === 7 ? "вы нашли все 7 чудес" : `найдено ${found.length} из 7 · остальные покажем на созвоне`}
          </span>
          <h2>
            Расскажите о задаче — найдём, где спрятано ваше <em className="serif">чудо</em>
          </h2>
          <p className="ch__sub">Бесплатный разбор 15 минут. Уйдёте с 3 идеями для роста, даже если не станете нашим клиентом.</p>
          <p className="ch__esc">Нажмите <kbd>Esc</kbd>, чтобы освободить курсор и заполнить форму</p>
          <form onSubmit={submit} className="final__form">
            <input required placeholder="Имя" />
            <input required placeholder="Telegram или телефон" />
            <div className="final__chips">
              {needChips.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={picked.includes(c) ? "on" : ""}
                  onClick={() => setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]))}
                >
                  {c}
                </button>
              ))}
            </div>
            <label className="final__check">
              <input type="checkbox" required /> Согласен на обработку персональных данных (152-ФЗ)
            </label>
            <button className="fbtn fbtn--main fbtn--big" type="submit">
              Хочу чудо ✦
            </button>
          </form>
        </>
      )}
    </div>
  );
}

/* ───────── held wonder: the meaning, in the same glass as the rest of the site ───────── */
function InspectPanel() {
  const card = useQuest((s) => s.card);
  const found = useQuest((s) => s.found);
  const [leaving, setLeaving] = useState<string | null>(null);
  const w = wonders.find((x) => x.id === card);
  const svc = services.find((x) => x.id === w?.service);
  if (!w || !svc) return null;
  const idx = wonders.indexOf(w) + 1;

  // the click is a user gesture, so the mouse can be grabbed again right away
  const back = () => lockPointer(document.querySelector<HTMLCanvasElement>(".forest__stage canvas"));
  const go = (want: boolean) => {
    setLeaving(card);
    if (want) inspect.want();
    else inspect.release();
    back();
  };

  const outputs = svc.output.split(/,\s*/).map((o) => o.charAt(0).toUpperCase() + o.slice(1));
  const kind = WONDER_SPECIES[w.id]?.name;

  return (
    <aside className={`ipanel ${leaving === card ? "is-leaving" : ""}`} key={card} style={{ ["--c" as string]: WONDER_SPECIES[w.id]?.glow ?? w.color }}>
      <header className="ip-head">
        <div className="ip-meta">
          <span className="ip-num">{String(idx).padStart(2, "0")}</span>
          <span className="ip-kind">
            {kind && <b>{kind}</b>}
            <span>
              найдено {found.length} из 7
            </span>
          </span>
        </div>
        <h2>{svc.title}</h2>
        <p className="ip-lead">{svc.benefit}</p>
      </header>

      <section className="ip-sec">
        <h3>На выходе</h3>
        <ul className="ip-tags">
          {outputs.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      </section>

      <section className="ip-sec ip-row">
        <h3>Срок</h3>
        <p>{svc.term}</p>
      </section>

      {w.id === "content" && (
        <section className="ip-sec">
          <h3>Контент-завод</h3>
          <p className="ip-sub">Месяц контента за одну встречу</p>
          <ol className="ip-steps">
            {factorySteps.map((s) => (
              <li key={s.n}>
                <span>{s.n}</span>
                <div>
                  <b>{s.title}</b>
                  <p>{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="ip-counts">
            {factoryCounts.map((c) => (
              <div key={c.label}>
                <strong>{c.value}</strong>
                <span>{c.label}</span>
              </div>
            ))}
          </div>
          <p className="ip-note">Telegram, VK, YouTube, Instagram*, Dzen, маркетплейсы. *Meta признана экстремистской в РФ.</p>
        </section>
      )}

      <footer className="ip-foot">
        <div className="ip-actions">
          <button className="fbtn fbtn--main" onClick={() => go(false)}>
            Дальше в лес →
          </button>
          <button className="fbtn" onClick={() => go(true)}>
            Хочу это чудо себе
          </button>
        </div>
        <p className="ip-hint">Потяните чудо мышью, чтобы рассмотреть · F — хочу такое себе</p>
      </footer>
    </aside>
  );
}

export default function ForestUI() {
  return (
    <>
      <Crosshair />
      <TitleChapter />
      <ProcessChapter />
      <CasesChapter />
      <FinalChapter />
      <Controls />
      <Narrator />
      <InspectPanel />
      <Hud />
      <Joystick />
      <Gate />
    </>
  );
}
