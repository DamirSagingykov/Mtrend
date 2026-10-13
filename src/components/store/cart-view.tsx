"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Minus, Plus, X, AlertCircle } from "lucide-react";
import clsx from "clsx";
import { useCart, useI18n } from "./providers";
import { useQuote, promoErrors } from "./use-quote";
import { ProductImage } from "./product-image";
import { formatPrice } from "@/lib/format";
import { fmt } from "@/i18n";
import type { QuoteLine } from "@/lib/quote";

export function CartView() {
  const { t, locale } = useI18n();
  const cart = useCart();
  const { quote, loading, error } = useQuote(cart.items, { promoCode: cart.promoCode, enabled: cart.ready });
  const [promoInput, setPromoInput] = useState("");

  // Убираем из локальной корзины то, чего уже нет в базе
  useEffect(() => {
    if (!quote) return;
    const known = new Set(quote.lines.map((l) => l.variantId));
    const missing = cart.items.filter((i) => !known.has(i.variantId));
    if (missing.length) cart.replace(cart.items.filter((i) => known.has(i.variantId)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote]);

  if (!cart.ready) return <div className="container py-24 text-center text-ink-muted">{t.common.loading}</div>;

  if (!cart.items.length) {
    return (
      <div className="container py-24 md:py-32 text-center">
        <h1 className="font-display text-4xl md:text-5xl">{t.cart.empty}</h1>
        <p className="text-ink-muted mt-3">{t.cart.emptyText}</p>
        <Link href={`/${locale}/catalog`} className="btn-primary mt-8">{t.cart.goCatalog}</Link>
      </div>
    );
  }

  const lines = quote?.lines ?? [];
  const promoErr = quote?.promo?.error ? promoErrors[quote.promo.error]?.[locale] : null;
  const canCheckout = !!quote && !quote.hasIssues && lines.length > 0;

  return (
    <div className="container pt-8 md:pt-12">
      <h1 className="font-display text-4xl md:text-5xl">{t.cart.title}</h1>
      <div className="mt-8 grid lg:grid-cols-[1fr_380px] gap-10 lg:gap-14 items-start">
        <div>
          {error && <p className="text-danger text-sm mb-4">{t.common.error}</p>}
          {!quote && loading && <p className="text-ink-muted text-sm">{t.cart.checking}</p>}
          <ul className="divide-y divide-line border-y border-line">
            {lines.map((l) => (
              <CartLine key={l.variantId} l={l} />
            ))}
          </ul>
          <Link href={`/${locale}/catalog`} className="inline-block mt-6 text-[12px] uppercase tracking-[0.14em] underline underline-offset-4">
            {t.cart.continue}
          </Link>
        </div>

        <aside className="bg-milk p-6 md:p-8 lg:sticky lg:top-24">
          <div className="space-y-3 text-sm">
            <Row label={t.cart.subtotal} value={quote ? formatPrice(quote.subtotal + quote.itemsDiscount, locale) : "…"} />
            {!!quote?.itemsDiscount && <Row label={t.cart.discount} value={`−${formatPrice(quote.itemsDiscount, locale)}`} accent />}
            {quote?.promo && !quote.promo.error && <Row label={`${t.cart.promo} ${quote.promo.code}`} value={`−${formatPrice(quote.promo.discount, locale)}`} accent />}
            <Row label={t.cart.delivery} value={t.cart.deliveryCalc} muted />
          </div>

          <div className="mt-6">
            {cart.promoCode && quote?.promo && !quote.promo.error ? (
              <div className="flex items-center justify-between text-sm border border-success/40 bg-white px-3 h-11">
                <span className="text-success">✓ {t.cart.promoApplied}: {cart.promoCode}</span>
                <button onClick={() => cart.setPromo(null)} className="underline text-xs">{t.cart.promoRemove}</button>
              </div>
            ) : (
              <form
                className="flex"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (promoInput.trim()) cart.setPromo(promoInput.trim().toUpperCase());
                }}
              >
                <input value={promoInput} onChange={(e) => setPromoInput(e.target.value)} placeholder={t.cart.promoPlaceholder} className="input h-11 text-sm bg-white uppercase" aria-label={t.cart.promo} />
                <button className="btn-outline h-11 px-4 shrink-0">{t.cart.promoApply}</button>
              </form>
            )}
            {promoErr && <p className="text-xs text-danger mt-2">{promoErr}</p>}
          </div>

          <div className="flex items-baseline justify-between mt-6 pt-6 border-t border-line">
            <span className="uppercase text-[12px] tracking-[0.14em]">{t.cart.total}</span>
            <span className="text-2xl">{quote ? formatPrice(quote.total, locale) : "…"}</span>
          </div>
          {!!quote && quote.itemsDiscount + (quote.promo && !quote.promo.error ? quote.promo.discount : 0) > 0 && (
            <p className="text-xs text-wood-dark mt-1 text-right">
              {t.cart.savings}: {formatPrice(quote.itemsDiscount + (quote.promo && !quote.promo.error ? quote.promo.discount : 0), locale)}
            </p>
          )}
          <Link
            href={canCheckout ? `/${locale}/checkout` : "#"}
            aria-disabled={!canCheckout}
            className={clsx("btn-primary w-full mt-6", !canCheckout && "pointer-events-none opacity-40")}
          >
            {t.cart.checkout}
          </Link>
          {quote?.hasIssues && <p className="text-xs text-danger mt-3">{t.checkout.stockError}</p>}
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, accent, muted }: { label: string; value: string; accent?: boolean; muted?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-ink-muted">{label}</span>
      <span className={clsx(accent && "text-wood-dark", muted && "text-ink-muted text-xs")}>{value}</span>
    </div>
  );
}

function CartLine({ l }: { l: QuoteLine }) {
  const { t, locale } = useI18n();
  const cart = useCart();
  const name = locale === "kz" ? l.nameKz || l.nameRu : l.nameRu;
  const color = locale === "kz" ? l.colorKz || l.colorRu : l.colorRu;
  const qtyInCart = cart.items.find((i) => i.variantId === l.variantId)?.quantity ?? l.requested;

  // Автоматически снижаем количество до доступного
  useEffect(() => {
    if (l.issue === "reduced" && l.available > 0 && qtyInCart > l.available) cart.setQty(l.variantId, l.available);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [l.issue, l.available]);

  return (
    <li className="py-5 flex gap-4">
      <Link href={`/${locale}/product/${l.slug}`} className="relative w-24 md:w-28 aspect-[3/4] bg-milk shrink-0">
        {l.imageUrl && <ProductImage src={l.imageUrl} alt={name} fill sizes="112px" className="object-cover" />}
      </Link>
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex justify-between gap-3">
          <div>
            <Link href={`/${locale}/product/${l.slug}`} className="text-sm md:text-[15px] leading-snug hover:text-wood">{name}</Link>
            {l.isDemo && <span className="ml-2 text-[9px] tracking-[0.14em] text-danger font-semibold">{t.product.demoBadge}</span>}
            <div className="text-xs text-ink-muted mt-1.5 space-y-0.5">
              <div>{t.product.article}: {l.article}</div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full border border-black/10" style={{ background: l.colorHex }} /> {color} · {t.product.size} {l.size}
                {l.height && ` · ${t.product.height} ${l.height}`}
              </div>
            </div>
          </div>
          <button onClick={() => cart.remove(l.variantId)} className="p-1 -mr-1 self-start text-ink-muted hover:text-ink" aria-label={t.cart.remove}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {l.issue === "unavailable" && (
          <p className="mt-2 text-xs text-danger flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> {t.cart.unavailable}</p>
        )}
        {l.issue === "reduced" && l.available > 0 && <p className="mt-2 text-xs text-wood-dark">{fmt(t.cart.reduced, { n: l.available })}</p>}

        <div className="mt-auto pt-3 flex items-end justify-between">
          <div className="flex items-center border border-line h-9">
            <button className="w-9 h-full flex items-center justify-center disabled:opacity-30" disabled={qtyInCart <= 1} onClick={() => cart.setQty(l.variantId, qtyInCart - 1)} aria-label="-">
              <Minus className="w-3 h-3" />
            </button>
            <span className="w-7 text-center text-sm">{qtyInCart}</span>
            <button className="w-9 h-full flex items-center justify-center disabled:opacity-30" disabled={qtyInCart >= l.available || qtyInCart >= 20} onClick={() => cart.setQty(l.variantId, qtyInCart + 1)} aria-label="+">
              <Plus className="w-3 h-3" />
            </button>
          </div>
          <div className="text-right">
            <div className={clsx("text-sm", l.oldPrice && "text-wood-dark")}>{formatPrice(l.price * Math.max(l.quantity, 1), locale)}</div>
            {l.oldPrice && <div className="text-xs text-ink-muted line-through">{formatPrice(l.oldPrice * Math.max(l.quantity, 1), locale)}</div>}
          </div>
        </div>
      </div>
    </li>
  );
}
