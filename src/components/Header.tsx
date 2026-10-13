"use client";

import { useEffect, useState } from "react";
import { nav } from "@/lib/content";
import { Roll } from "./ui";

export default function Header() {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let last = 0;
    const onScroll = () => {
      const y = window.scrollY;
      setHidden(y > 200 && y > last && !open);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [open]);

  return (
    <header className={`header ${hidden ? "is-hidden" : ""} ${open ? "is-open" : ""}`}>
      <a href="#top" className="logo" data-cursor="наверх">
        <span className="logo__star">✦</span>Чудеса
      </a>
      <nav className="header__nav">
        {nav.map((n) => (
          <a key={n.href} href={n.href} onClick={() => setOpen(false)}>
            {n.label}
          </a>
        ))}
      </nav>
      <div className="header__cta">
        <Roll href="#contact" variant="ghost">
          Обсудить проект
        </Roll>
      </div>
      <button className="burger" aria-label="Меню" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span />
        <span />
      </button>
    </header>
  );
}
