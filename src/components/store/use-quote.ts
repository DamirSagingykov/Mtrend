"use client";

import { useEffect, useRef, useState } from "react";
import type { Quote } from "@/lib/quote";
import type { CartItem } from "./providers";

/** Серверный расчёт корзины с отменой устаревших запросов */
export function useQuote(items: CartItem[], opts: { promoCode?: string | null; deliveryCode?: string | null; city?: string | null; enabled?: boolean }) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const ctrl = useRef<AbortController | null>(null);
  const key = JSON.stringify([items, opts.promoCode, opts.deliveryCode, opts.city]);

  useEffect(() => {
    if (opts.enabled === false) return;
    if (!items.length) {
      setQuote(null);
      return;
    }
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setLoading(true);
    const timer = setTimeout(() => {
      fetch("/api/cart/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, promoCode: opts.promoCode || null, deliveryCode: opts.deliveryCode || null, city: opts.city || null }),
        signal: c.signal,
      })
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((q: Quote) => {
          setQuote(q);
          setError(false);
        })
        .catch((e) => {
          if (e?.name !== "AbortError") setError(true);
        })
        .finally(() => !c.signal.aborted && setLoading(false));
    }, 150);
    return () => {
      clearTimeout(timer);
      c.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, opts.enabled]);

  return { quote, loading, error, setQuote };
}

export const promoErrors: Record<string, { ru: string; kz: string }> = {
  not_found: { ru: "Промокод не найден", kz: "Промокод табылмады" },
  not_started: { ru: "Промокод ещё не действует", kz: "Промокод әлі жарамсыз" },
  expired: { ru: "Срок действия промокода истёк", kz: "Промокодтың мерзімі өтті" },
  exhausted: { ru: "Лимит использования промокода исчерпан", kz: "Промокодты пайдалану лимиті таусылды" },
  min_order: { ru: "Сумма заказа меньше минимальной для промокода", kz: "Тапсырыс сомасы промокод үшін ең аз сомадан төмен" },
  not_applicable: { ru: "Промокод не применяется к товарам в корзине", kz: "Промокод себеттегі тауарларға қолданылмайды" },
};
