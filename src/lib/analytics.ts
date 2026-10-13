"use client";

/**
 * Отслеживание событий для GA4 / Meta Pixel / Яндекс Метрики.
 * События отправляются только если соответствующие счётчики подключены в настройках.
 * ВАЖНО: событие оформления заказа — «order_created», а не «purchase», т.к. на момент оформления оплата не подтверждена.
 */
type Item = { item_id: string; item_name: string; price: number; quantity?: number; item_variant?: string; item_category?: string };

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    ym?: (...args: unknown[]) => void;
    __MT_YM_ID?: string;
  }
}

function send(gaEvent: string, gaParams: Record<string, unknown>, fbEvent: string | null, fbParams: Record<string, unknown>, custom = false) {
  try {
    window.gtag?.("event", gaEvent, gaParams);
    if (fbEvent) window.fbq?.(custom ? "trackCustom" : "track", fbEvent, fbParams);
    if (window.__MT_YM_ID) window.ym?.(Number(window.__MT_YM_ID), "reachGoal", gaEvent, gaParams);
  } catch {
    /* аналитика не должна ломать сайт */
  }
}

export const analytics = {
  viewItem(item: Item) {
    send("view_item", { currency: "KZT", value: item.price, items: [item] }, "ViewContent", {
      content_ids: [item.item_id],
      content_type: "product",
      value: item.price,
      currency: "KZT",
    });
  },
  addToCart(item: Item) {
    send("add_to_cart", { currency: "KZT", value: item.price * (item.quantity ?? 1), items: [item] }, "AddToCart", {
      content_ids: [item.item_id],
      content_type: "product",
      value: item.price * (item.quantity ?? 1),
      currency: "KZT",
    });
  },
  beginCheckout(value: number, items: Item[]) {
    send("begin_checkout", { currency: "KZT", value, items }, "InitiateCheckout", { value, currency: "KZT", num_items: items.length });
  },
  /** Заказ оформлен (не оплачен!) */
  orderCreated(orderNumber: string, value: number, items: Item[]) {
    send("order_created", { currency: "KZT", value, transaction_id: orderNumber, items }, "OrderCreated", { value, currency: "KZT", order_id: orderNumber }, true);
  },
};
