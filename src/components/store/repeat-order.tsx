"use client";

import { useRouter } from "next/navigation";
import { useCart, useI18n, useToast } from "./providers";

export function RepeatOrderButton({ items }: { items: { variantId: string; quantity: number }[] }) {
  const cart = useCart();
  const { t, locale } = useI18n();
  const toast = useToast();
  const router = useRouter();
  if (!items.length) return null;
  return (
    <button
      className="btn-ghost border border-line"
      onClick={() => {
        for (const i of items) cart.add(i.variantId, i.quantity);
        toast(t.order.repeated);
        router.push(`/${locale}/cart`);
      }}
    >
      {t.order.repeat}
    </button>
  );
}
