"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { ProductImage } from "./product-image";

export type Slide = { id: string; title: string; subtitle?: string | null; button?: string | null; link?: string | null; image: string; mobileImage?: string | null; dark: boolean };

export function HeroSlider({ slides }: { slides: Slide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (slides.length < 2 || paused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), 6500);
    return () => clearInterval(id);
  }, [slides.length, paused]);

  if (!slides.length) return null;

  return (
    <section
      className="relative h-[78svh] min-h-[480px] max-h-[920px] overflow-hidden bg-milk-deep"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
    >
      {slides.map((s, i) => (
        <div
          key={s.id}
          className={clsx("absolute inset-0 transition-opacity duration-1000", i === index ? "opacity-100 z-10" : "opacity-0 z-0")}
          aria-hidden={i !== index}
        >
          <ProductImage src={s.mobileImage || s.image} alt={s.title} fill priority={i === 0} sizes="100vw" className="object-cover md:hidden" />
          <ProductImage src={s.image} alt={s.title} fill priority={i === 0} sizes="100vw" className="object-cover hidden md:block" />
          <div className={clsx("absolute inset-0", s.dark ? "bg-gradient-to-t from-white/70 via-white/10 to-transparent" : "bg-gradient-to-t from-black/55 via-black/10 to-transparent")} />
          <div className={clsx("absolute inset-x-0 bottom-0 container pb-14 md:pb-20", s.dark ? "text-ink" : "text-white")}>
            <h1 className={clsx("font-display text-[40px] leading-[0.98] sm:text-6xl md:text-7xl lg:text-[88px] font-medium max-w-4xl", i === index && "animate-fade-up")}>
              {s.title}
            </h1>
            {s.subtitle && <p className="mt-4 text-sm md:text-base max-w-lg opacity-90">{s.subtitle}</p>}
            {s.button && s.link && (
              <Link href={s.link} className={clsx("mt-8", s.dark ? "btn-primary" : "btn-light")}>
                {s.button}
              </Link>
            )}
          </div>
        </div>
      ))}
      {slides.length > 1 && (
        <div className="absolute z-20 right-4 md:right-10 bottom-6 md:bottom-10 flex gap-2">
          {slides.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setIndex(i)}
              className={clsx("h-[3px] transition-all duration-500", i === index ? "w-10 bg-white" : "w-5 bg-white/50")}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
