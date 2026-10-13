"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useFavorites, useI18n } from "./providers";
import { ProductGrid } from "./product-card";
import type { ProductCardData } from "@/lib/catalog";

export function FavoritesView() {
  const { t, locale } = useI18n();
  const fav = useFavorites();
  const [items, setItems] = useState<ProductCardData[] | null>(null);
  const key = fav.ids.join(",");

  useEffect(() => {
    if (!fav.ids.length) {
      setItems([]);
      return;
    }
    fetch("/api/products/cards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: fav.ids }) })
      .then((r) => r.json())
      .then((d) => setItems(d.items))
      .catch(() => setItems([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div className="container pt-8 md:pt-12">
      <h1 className="font-display text-4xl md:text-5xl mb-8">{t.favorites.title}</h1>
      {items === null ? (
        <p className="text-ink-muted">{t.common.loading}</p>
      ) : items.length ? (
        <ProductGrid items={items} />
      ) : (
        <div className="py-16 text-center">
          <p className="text-ink-muted">{t.favorites.empty}</p>
          <Link href={`/${locale}/catalog`} className="btn-primary mt-6">{t.cart.goCatalog}</Link>
        </div>
      )}
    </div>
  );
}
