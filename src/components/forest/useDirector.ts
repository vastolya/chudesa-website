"use client";

import { useEffect } from "react";
import { distTo, inspect, landmarks, live, REACH, useQuest, WORLD_R, wonders } from "@/lib/forest";
import { audioStart, audioStop, sfxUncanny } from "@/lib/audio";
import { lockPointer } from "@/lib/pointerLock";

const landmarkLines: Record<string, string> = {
  process: "Камни пяти шагов. Так мы работаем — без магии. Ну, почти.",
  cases: "Дерево историй. На каждой ветке — чудо, которое уже случилось у кого-то другого.",
  final: "Поляна. Здесь живёт главное чудо. Ваше.",
};

const idleLines = [
  "Вы замерли. Лес тоже.",
  "Мы видим, что вы не двигаетесь. Читаете — или ушли за чаем?",
  "W — вперёд. Мы не настаиваем, просто напоминаем.",
  "Тишина. Слышите, как падает снег? Если звук включён — слышите.",
];

const GAME_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ShiftLeft", "ShiftRight", "Space"]);

export function useDirector() {
  useEffect(() => {
    const q = useQuest.getState;
    const say = (t: string, tone?: "story" | "riddle" | "hint" | "wall") => q().say(t, tone);
    document.documentElement.classList.add("forest-mode");
    (window as unknown as { __forest: typeof live }).__forest = live; // debug / screenshots
    (window as unknown as { __quest: unknown }).__quest = useQuest; // TEMP

    let raf = 0;
    let firstStep = false;
    let idleSaidAt = 0;
    let idleIdx = 0;
    let edgeSaidAt = 0;
    let runSince = 0;
    let runSaidAt = 0;
    let wanderFrom = 0;
    let spin = 0;
    let spinSaidAt = 0;
    let lastYaw = 0;
    let jumpSaid = false;
    const zoneEnter = new Map<string, number>();
    const hinted = new Set<string>();
    const leftBehind = new Set<string>();
    const visited = new Set<string>();
    live.lastInput = performance.now();

    const loop = () => {
      const now = performance.now();
      const { phase, found } = q();
      // holding a wonder pauses walking (the mouse turns the wonder instead)
      const holding = !!q().card;
      live.frozen = phase !== "walk" || holding;
      // holding a wonder frees the cursor: drag turns the wonder, the panel has real buttons
      if (holding && document.pointerLockElement) document.exitPointerLock();
      document.documentElement.classList.toggle("is-holding", holding);

      if (!live.frozen) {
        if (live.speed > 0.2) live.lastInput = now;

        if (live.jumps >= 6 && !jumpSaid) {
          jumpSaid = true;
          say("Прыгать в лесу — смело. Чудеса не впечатлены. Но мы — немного да.", "wall");
        }
        if (!firstStep && live.walked > 1.5) {
          firstStep = true;
          say(`Этот лес вырос только для вас — лес № ${live.seed}. Обновите страницу, и его больше не будет. Никогда. Идите на любой столб света — порядок не важен.`, "wall");
        }

        // wonders: riddles, hints, regrets
        let nearAny: string | null = null;
        for (const w of wonders) {
          if (found.includes(w.id)) continue;
          const d = distTo(w.x, w.z);
          if (d < REACH) {
            nearAny = w.id;
            if (!zoneEnter.has(w.id)) {
              zoneEnter.set(w.id, now);
              say(w.riddle, "riddle");
              wanderFrom = live.walked;
            } else if (!hinted.has(w.id) && now - zoneEnter.get(w.id)! > 20000) {
              hinted.add(w.id);
              say("Подсказка: " + w.hint, "hint");
            }
          } else if (d > REACH + 6 && zoneEnter.has(w.id) && !leftBehind.has(w.id)) {
            leftBehind.add(w.id);
            say("Чудо осталось позади. Оно подождёт — столб света никуда не денется.", "wall");
          }
        }
        live.near = nearAny;

        // landmarks
        live.landmark = null;
        for (const l of landmarks) {
          if (distTo(l.x, l.z) < l.r + 3) {
            live.landmark = l.id;
            if (!visited.has(l.id)) {
              visited.add(l.id);
              wanderFrom = live.walked;
              say(
                l.id === "final" && found.length < 7
                  ? `${landmarkLines.final} Вы нашли ${found.length} из 7 — остальные покажем на созвоне.`
                  : landmarkLines[l.id],
                "story"
              );
            }
          }
        }

        // the edge of the world
        if (Math.hypot(live.x, live.z) > WORLD_R - 0.5 && now - edgeSaidAt > 30000) {
          edgeSaidAt = now;
          say("Дальше лес не пускает. Там начинаются сайты конкурентов — вам туда не надо.", "wall");
          sfxUncanny();
        }

        // running
        if (live.speed > 2.4) {
          if (!runSince) runSince = now;
          if (now - runSince > 4000 && now - runSaidAt > 45000) {
            runSaidAt = now;
            say("Не бегите. В лесу так теряются. И чудеса пропускают.", "wall");
          }
        } else runSince = 0;

        // wandering in circles
        if (live.walked - wanderFrom > 150) {
          wanderFrom = live.walked;
          say(
            `Вы ходите кругами. Буквально — мы видим ваши координаты: ${live.x.toFixed(0)}, ${live.z.toFixed(0)}. Ищите столбы света.`,
            "wall"
          );
        }

        // spinning around
        spin = spin * Math.exp(-1 / 60 / 3) + Math.abs(live.yaw - lastYaw);
        lastYaw = live.yaw;
        if (spin > Math.PI * 4 && now - spinSaidAt > 40000) {
          spinSaidAt = now;
          spin = 0;
          say("Кружитесь? Чудеса так не ловятся. Хотя одно — может быть.", "wall");
        }

        // idle
        const inStill = nearAny === "strategy";
        if (!inStill && now - live.lastInput > 22000 && now - idleSaidAt > 45000) {
          idleSaidAt = now;
          say(idleLines[idleIdx++ % idleLines.length], "wall");
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    /* ── input: shooter-style look with pointer lock, drag-look on touch ── */
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    let drag: { x: number; y: number } | null = null;
    // locked look uses mousemove: pointermove gets coalesced by Chrome and can drop movement
    let lastDX = 0;
    const onMouseLook = (e: MouseEvent) => {
      if (!document.pointerLockElement) return;
      live.lastInput = performance.now();
      const dx = e.movementX;
      const dy = e.movementY;
      // Chrome on Windows occasionally reports a bogus huge jump under pointer lock — drop it
      if (Math.abs(dx) > 220 && Math.abs(lastDX) < 60) {
        lastDX = 0;
        return;
      }
      if (Math.abs(dy) > 220) return;
      lastDX = dx;
      live.lookDX += dx;
      live.lookDY += dy;
    };
    const onMove = (e: PointerEvent) => {
      live.lastInput = performance.now();
      if (document.pointerLockElement) return;
      if (drag) {
        live.lookDX += (e.clientX - drag.x) * 1.4;
        live.lookDY += (e.clientY - drag.y) * 1.4;
        drag = { x: e.clientX, y: e.clientY };
      }
    };
    const onDown = (e: PointerEvent) => {
      live.lastInput = performance.now();
      const onCanvas = (e.target as HTMLElement).tagName === "CANVAS";
      if (!onCanvas || q().phase !== "walk") return;
      if (coarse || e.pointerType === "touch" || q().card) {
        drag = { x: e.clientX, y: e.clientY };
        return;
      }
      if (!document.pointerLockElement) {
        lockPointer(e.target as HTMLCanvasElement);
        return;
      }
      if (e.button === 0) live.fire = true;
    };
    const onUp = () => (drag = null);
    let unlockSaid = false;
    const onLock = () => {
      live.locked = !!document.pointerLockElement;
      document.documentElement.classList.toggle("is-locked", live.locked);
      if (!live.locked && q().phase === "walk" && !q().card && !unlockSaid) {
        unlockSaid = true;
        say("Отпустили фонарь? Мы подождём. Кликните по лесу, чтобы взять его снова.", "wall");
      }
    };
    const onWheel = (e: WheelEvent) => {
      if (live.frozen) return;
      live.wheel += -e.deltaY;
      live.lastInput = performance.now();
    };

    let typed = "";
    const onKeyDown = (e: KeyboardEvent) => {
      live.lastInput = performance.now();
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (q().card && e.code === "KeyF") {
        inspect.want();
        return;
      }
      if (GAME_KEYS.has(e.code)) {
        e.preventDefault();
        live.keys.add(e.code);
      }
      if (e.key.length === 1) {
        typed = (typed + e.key.toLowerCase()).slice(-8);
        if ((typed.endsWith("чудо") || typed.endsWith("chudo")) && !q().golden) {
          q().setGolden();
          say("Вы назвали его по имени. Снег теперь золотой. Это восьмое чудо — и оно ваше.", "wall");
          sfxUncanny();
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => live.keys.delete(e.code);
    const onBlur = () => live.keys.clear();

    /* ── fourth wall ── */
    const origTitle = document.title;
    let hiddenAt = 0;
    let titleTimer: ReturnType<typeof setInterval> | null = null;
    const onVisibility = () => {
      if (q().phase !== "walk") return;
      if (document.hidden) {
        hiddenAt = performance.now();
        const t = ["✦ Чудо ждёт…", "Вы ушли из леса", "Снег всё ещё идёт", "✦ Вернитесь"];
        let i = 0;
        titleTimer = setInterval(() => (document.title = t[i++ % t.length]), 1600);
        if (q().sound) audioStop();
      } else {
        if (titleTimer) clearInterval(titleTimer);
        document.title = origTitle;
        const sec = Math.round((performance.now() - hiddenAt) / 1000);
        if (sec >= 3) {
          say(
            sec > 60
              ? `Вас не было ${Math.round(sec / 60)} мин. Мы не обиделись. Снег, правда, замёл следы.`
              : `Вас не было ${sec} сек. Лес заметил.`,
            "wall"
          );
        }
        if (q().sound) audioStart();
      }
    };
    let leaveSaidAt = 0;
    const onLeave = (e: MouseEvent) => {
      if (q().phase !== "walk" || e.relatedTarget || e.clientY > 10) return;
      const now = performance.now();
      if (now - leaveSaidAt < 40000) return;
      leaveSaidAt = now;
      say("Не уходите. Самое интересное — в чаще.", "wall");
    };
    const onCopy = () => say("Чудо нельзя скопировать. Только найти.", "wall");
    const onContext = (e: MouseEvent) => {
      if ((e.target as HTMLElement).tagName === "CANVAS") e.preventDefault();
      say("Правой кнопкой чудеса не открываются. Попробуйте левой.", "wall");
    };
    let resizeT: ReturnType<typeof setTimeout> | null = null;
    let resizeSaid = false;
    const onResize = () => {
      if (resizeT) clearTimeout(resizeT);
      resizeT = setTimeout(() => {
        if (resizeSaid || q().phase !== "walk") return;
        resizeSaid = true;
        say("Вы изменили окно. Лес тоже изменился. Заметили?", "wall");
      }, 600);
    };

    console.log(
      "%c✦ Вы заглянули под капот.%c\nЗначит, вам нужна разработка. Мы как раз её делаем.\nПодсказка для любопытных: наберите на клавиатуре слово «чудо».",
      "font: 700 16px sans-serif; color: #c8ff2e",
      "font: 13px sans-serif; color: #aaa"
    );

    document.addEventListener("pointerlockchange", onLock);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("mousemove", onMouseLook, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("mouseout", onLeave);
    document.addEventListener("copy", onCopy);
    document.addEventListener("contextmenu", onContext);
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      document.documentElement.classList.remove("forest-mode");
      if (titleTimer) clearInterval(titleTimer);
      document.removeEventListener("pointerlockchange", onLock);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("mousemove", onMouseLook);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("mouseout", onLeave);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("contextmenu", onContext);
      window.removeEventListener("resize", onResize);
    };
  }, []);
}
