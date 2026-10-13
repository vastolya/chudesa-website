"use client";

import { useEffect, useState } from "react";

/** Preloader, sticky mobile CTA and cookie banner. */
export default function Overlays() {
  const [loaded, setLoaded] = useState(false);
  const [count, setCount] = useState(0);
  const [cookie, setCookie] = useState(false);
  const [showCta, setShowCta] = useState(false);

  useEffect(() => {
    let n = 0;
    const id = setInterval(() => {
      n = Math.min(100, n + Math.ceil(Math.random() * 14));
      setCount(n);
      if (n >= 100) {
        clearInterval(id);
        setTimeout(() => {
          setLoaded(true);
          document.documentElement.classList.add("is-loaded");
        }, 250);
      }
    }, 70);

    try {
      if (!localStorage.getItem("cookie-ok")) setTimeout(() => setCookie(true), 2500);
    } catch {
      setTimeout(() => setCookie(true), 2500);
    }

    const onScroll = () => setShowCta(window.scrollY > window.innerHeight * 0.8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearInterval(id);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const acceptCookie = () => {
    setCookie(false);
    try {
      localStorage.setItem("cookie-ok", "1");
    } catch {}
  };

  return (
    <>
      <div className={`loader ${loaded ? "is-done" : ""}`} aria-hidden>
        <span className="loader__word">
          Чуд<em className="serif">е</em>са
        </span>
        <span className="loader__count">{String(count).padStart(3, "0")}</span>
      </div>

      <a href="#contact" className={`sticky-cta ${showCta ? "is-on" : ""}`}>
        ✦ Хочу чудо — разбор 15 минут
      </a>

      {cookie && (
        <div className="cookie">
          <p>Мы используем cookie, чтобы сайт работал лучше.</p>
          <button onClick={acceptCookie}>Ок</button>
        </div>
      )}
    </>
  );
}
