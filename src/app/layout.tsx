import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope, Unbounded } from "next/font/google";
import "./globals.css";

const display = Unbounded({
  variable: "--font-display",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "700"],
});

const sans = Manrope({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
});

const serif = Cormorant_Garamond({
  variable: "--font-serif",
  subsets: ["latin", "cyrillic"],
  weight: ["500"],
  style: ["italic"],
});

export const metadata: Metadata = {
  title: "Чудеса — маркетинг, сайты и ИИ-контент для бизнеса",
  description:
    "Маркетинг × Разработка × ИИ. Стратегия, упаковка, сайты, контент-завод и автоматизация — от идеи до заявок.",
};

export const viewport: Viewport = {
  themeColor: "#09090b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${display.variable} ${sans.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
