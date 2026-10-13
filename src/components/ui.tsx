import type { ReactNode } from "react";

/** Heading split into masked words; animated by <Effects/>. Use "*word*" for serif-italic accent. */
export function Split({ text, as: Tag = "h2", className }: { text: string; as?: "h1" | "h2" | "h3"; className?: string }) {
  return (
    <Tag className={className} data-split aria-label={text.replace(/\*/g, "")}>
      {text.split(" ").map((w, i) => {
        const accent = w.startsWith("*") && w.endsWith("*");
        return (
          <span className="w" key={i} aria-hidden>
            <span className={accent ? "serif" : undefined}>{accent ? w.slice(1, -1) : w}</span>{" "}
          </span>
        );
      })}
    </Tag>
  );
}

/** Button with vertical text roll on hover. */
export function Roll({
  children,
  href,
  variant = "primary",
  onClick,
  type,
  cursor,
}: {
  children: string;
  href?: string;
  variant?: "primary" | "ghost" | "dark";
  onClick?: () => void;
  type?: "submit" | "button";
  cursor?: string;
}) {
  const inner: ReactNode = (
    <span className="roll__inner">
      <span>{children}</span>
      <span aria-hidden>{children}</span>
    </span>
  );
  const cls = `btn btn--${variant}`;
  if (href)
    return (
      <a href={href} className={cls} data-magnetic data-cursor={cursor}>
        {inner}
      </a>
    );
  return (
    <button type={type ?? "button"} className={cls} onClick={onClick} data-magnetic data-cursor={cursor}>
      {inner}
    </button>
  );
}

export function Eyebrow({ n, children }: { n: string; children: ReactNode }) {
  return (
    <div className="eyebrow" data-reveal>
      <span className="eyebrow__n">{n}</span>
      <span>{children}</span>
    </div>
  );
}
