"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";

/* ───────────── Локаль и словарь ───────────── */

type PublicSettings = { whatsapp: string; phone: string };
const LocaleCtx = createContext<{ locale: Locale; t: Dictionary; settings: PublicSettings; isLoggedIn: boolean } | null>(null);

export function useI18n() {
  const ctx = useContext(LocaleCtx);
  if (!ctx) throw new Error("useI18n outside provider");
  return ctx;
}

/* ───────────── Корзина ───────────── */

export type CartItem = { variantId: string; quantity: number };
type CartState = { items: CartItem[]; promoCode: string | null };

const CART_KEY = "mt_cart_v1";
const FAV_KEY = "mt_fav_v1";

type CartCtx = {
  items: CartItem[];
  promoCode: string | null;
  count: number;
  ready: boolean;
  add: (variantId: string, quantity?: number, max?: number) => void;
  setQty: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  setPromo: (code: string | null) => void;
  replace: (items: CartItem[]) => void;
};
const CartContext = createContext<CartCtx | null>(null);

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart outside provider");
  return ctx;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/* ───────────── Избранное ───────────── */

type FavCtx = { ids: string[]; has: (id: string) => boolean; toggle: (id: string) => void };
const FavContext = createContext<FavCtx | null>(null);
export function useFavorites() {
  const ctx = useContext(FavContext);
  if (!ctx) throw new Error("useFavorites outside provider");
  return ctx;
}

/* ───────────── Уведомления (toast) ───────────── */

type Toast = { id: number; text: string; action?: { label: string; href: string } };
const ToastContext = createContext<(text: string, action?: Toast["action"]) => void>(() => {});
export function useToast() {
  return useContext(ToastContext);
}

export function StoreProviders({
  locale,
  t,
  settings,
  isLoggedIn,
  children,
}: {
  locale: Locale;
  t: Dictionary;
  settings: PublicSettings;
  isLoggedIn: boolean;
  children: React.ReactNode;
}) {
  const [cart, setCart] = useState<CartState>({ items: [], promoCode: null });
  const [ready, setReady] = useState(false);
  const [fav, setFav] = useState<string[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  useEffect(() => {
    const saved = readJson<CartState>(CART_KEY, { items: [], promoCode: null });
    setCart({
      items: Array.isArray(saved.items) ? saved.items.filter((i) => i && typeof i.variantId === "string" && i.quantity > 0) : [],
      promoCode: typeof saved.promoCode === "string" ? saved.promoCode : null,
    });
    setFav(readJson<string[]>(FAV_KEY, []).filter((x) => typeof x === "string"));
    setReady(true);
    // синхронизация вкладок
    const onStorage = (e: StorageEvent) => {
      if (e.key === CART_KEY) setCart(readJson<CartState>(CART_KEY, { items: [], promoCode: null }));
      if (e.key === FAV_KEY) setFav(readJson<string[]>(FAV_KEY, []));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Объединение избранного с сервером для авторизованных
  useEffect(() => {
    if (!isLoggedIn || !ready) return;
    const local = readJson<string[]>(FAV_KEY, []);
    fetch("/api/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ merge: local }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { ids: string[] } | null) => {
        if (data?.ids) {
          setFav(data.ids);
          localStorage.setItem(FAV_KEY, JSON.stringify(data.ids));
        }
      })
      .catch(() => {});
  }, [isLoggedIn, ready]);

  const persist = useCallback((next: CartState) => {
    setCart(next);
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(next));
    } catch {
      /* приватный режим */
    }
  }, []);

  const cartApi = useMemo<CartCtx>(() => {
    const items = cart.items;
    return {
      items,
      promoCode: cart.promoCode,
      ready,
      count: items.reduce((s, i) => s + i.quantity, 0),
      add: (variantId, quantity = 1, max = 20) => {
        const current = readJson<CartState>(CART_KEY, cart);
        const existing = current.items.find((i) => i.variantId === variantId);
        const nextItems = existing
          ? current.items.map((i) => (i.variantId === variantId ? { ...i, quantity: Math.min(max, i.quantity + quantity) } : i))
          : [...current.items, { variantId, quantity: Math.min(max, quantity) }];
        persist({ ...current, items: nextItems });
      },
      setQty: (variantId, quantity) =>
        persist({
          ...cart,
          items: quantity <= 0 ? items.filter((i) => i.variantId !== variantId) : items.map((i) => (i.variantId === variantId ? { ...i, quantity } : i)),
        }),
      remove: (variantId) => persist({ ...cart, items: items.filter((i) => i.variantId !== variantId) }),
      clear: () => persist({ items: [], promoCode: null }),
      setPromo: (promoCode) => persist({ ...cart, promoCode }),
      replace: (next) => persist({ ...cart, items: next }),
    };
  }, [cart, ready, persist]);

  const favApi = useMemo<FavCtx>(
    () => ({
      ids: fav,
      has: (id) => fav.includes(id),
      toggle: (id) => {
        const adding = !fav.includes(id);
        const next = adding ? [id, ...fav] : fav.filter((x) => x !== id);
        setFav(next);
        try {
          localStorage.setItem(FAV_KEY, JSON.stringify(next));
        } catch {}
        if (isLoggedIn) {
          fetch("/api/favorites", {
            method: adding ? "PUT" : "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId: id }),
          }).catch(() => {});
        }
      },
    }),
    [fav, isLoggedIn],
  );

  const showToast = useCallback((text: string, action?: Toast["action"]) => {
    const id = ++toastId.current;
    setToasts((ts) => [...ts.slice(-2), { id, text, action }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 3500);
  }, []);

  return (
    <LocaleCtx.Provider value={{ locale, t, settings, isLoggedIn }}>
      <CartContext.Provider value={cartApi}>
        <FavContext.Provider value={favApi}>
          <ToastContext.Provider value={showToast}>
            {children}
            <div className="fixed inset-x-0 bottom-20 md:bottom-6 z-[70] flex flex-col items-center gap-2 px-4 pointer-events-none" aria-live="polite">
              {toasts.map((toast) => (
                <div key={toast.id} className="pointer-events-auto animate-fade-up bg-ink text-white text-sm px-5 py-3 flex items-center gap-4 shadow-xl max-w-md w-full md:w-auto">
                  <span className="flex-1">{toast.text}</span>
                  {toast.action && (
                    <a href={toast.action.href} className="uppercase text-[11px] tracking-[0.16em] underline underline-offset-4 whitespace-nowrap">
                      {toast.action.label}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </ToastContext.Provider>
        </FavContext.Provider>
      </CartContext.Provider>
    </LocaleCtx.Provider>
  );
}
