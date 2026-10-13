"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import clsx from "clsx";
import { useFavorites, useI18n } from "./providers";
import { ProductImage } from "./product-image";
import { formatPrice } from "@/lib/format";
import { pick } from "@/i18n/config";
import type { ProductCardData } from "@/lib/catalog";

export function ProductCard({ p, priority = false }: { p: ProductCardData; priority?: boolean }) {
  const { locale, t } = useI18n();
  const fav = useFavorites();
  const name = pick(locale, p.nameRu, p.nameKz);
  const [img1, img2] = p.images;
  const liked = fav.has(p.id);

  return (
    <article className="group relative">
      <Link href={`/${locale}/product/${p.slug}`} className="block">
        <div className="relative aspect-[3/4] bg-milk overflow-hidden">
          {img1 ? (
            <ProductImage
              src={img1.url}
              alt={pick(locale, img1.altRu, img1.altKz) || name}
              fill
              priority={priority}
              sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
              className={clsx("object-cover transition-all duration-700 ease-out", img2 ? "group-hover:opacity-0" : "group-hover:scale-[1.03]")}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-ink-muted text-xs tracking-[0.2em]">M‑TREND</div>
          )}
          {img2 && (
            <ProductImage
              src={img2.url}
              alt={name}
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
              className="object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-700"
            />
          )}
          <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
            {p.isDemo && <span className="bg-white/90 text-[9px] tracking-[0.16em] px-1.5 py-0.5 text-danger font-semibold">{t.product.demoBadge}</span>}
            {p.discount > 0 && <span className="bg-ink text-white text-[10px] tracking-[0.08em] px-1.5 py-0.5">−{p.discount}%</span>}
            {p.isNew && <span className="bg-white text-[10px] uppercase tracking-[0.14em] px-1.5 py-0.5">{t.product.new}</span>}
          </div>
          {!p.inStock && (
            <div className="absolute inset-x-0 bottom-0 bg-white/85 text-center text-[11px] uppercase tracking-[0.14em] py-2">{t.product.outOfStock}</div>
          )}
          {p.sizes.length > 0 && p.inStock && (
            <div className="hidden md:flex absolute inset-x-0 bottom-0 bg-white/90 backdrop-blur px-3 py-2.5 gap-2 flex-wrap justify-center text-[11px] tracking-wide translate-y-full group-hover:translate-y-0 transition-transform duration-300">
              {p.sizes.slice(0, 8).map((s) => (
                <span key={s}>{s}</span>
              ))}
            </div>
          )}
        </div>
      </Link>
      <button
        onClick={() => fav.toggle(p.id)}
        className="absolute right-1.5 top-1.5 p-2 rounded-full hover:bg-white/70 transition-colors"
        aria-label={liked ? t.product.inFavorites : t.product.toFavorites}
        aria-pressed={liked}
      >
        <Heart className={clsx("w-[18px] h-[18px]", liked && "fill-ink")} strokeWidth={1.4} />
      </button>
      <div className="pt-3 pb-2 px-0.5">
        <Link href={`/${locale}/product/${p.slug}`} className="block text-[13px] md:text-sm leading-snug line-clamp-2 hover:text-wood">
          {name}
        </Link>
        <div className="mt-1.5 flex items-baseline gap-2 flex-wrap">
          <span className={clsx("text-sm font-medium", p.oldPrice && "text-wood-dark")}>{formatPrice(p.price, locale)}</span>
          {p.oldPrice && <span className="text-xs text-ink-muted line-through">{formatPrice(p.oldPrice, locale)}</span>}
        </div>
        {p.colors.length > 1 && (
          <div className="mt-2 flex gap-1.5">
            {p.colors.slice(0, 6).map((c) => (
              <span key={c.code} title={pick(locale, c.nameRu, c.nameKz)} className="w-3 h-3 rounded-full border border-black/10" style={{ background: c.hex }} />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

export function ProductGrid({ items, priorityCount = 0 }: { items: ProductCardData[]; priorityCount?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-3 gap-y-8 md:gap-x-5 md:gap-y-12">
      {items.map((p, i) => (
        <ProductCard key={p.id} p={p} priority={i < priorityCount} />
      ))}
    </div>
  );
}

export function ProductRail({ items }: { items: ProductCardData[] }) {
  return (
    <div className="flex gap-3 md:gap-5 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0">
      {items.map((p) => (
        <div key={p.id} className="snap-start shrink-0 w-[46%] sm:w-[31%] lg:w-[23.5%]">
          <ProductCard p={p} />
        </div>
      ))}
    </div>
  );
}
