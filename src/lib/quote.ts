import type { DeliveryMethod, Prisma, PrismaClient, PromoCode } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export type QuoteInput = {
  items: { variantId: string; quantity: number }[];
  promoCode?: string | null;
  deliveryCode?: string | null;
  city?: string | null;
};

export type QuoteLine = {
  variantId: string;
  productId: string;
  slug: string;
  article: string;
  sku: string;
  nameRu: string;
  nameKz: string;
  colorRu: string;
  colorKz: string;
  colorHex: string;
  size: string;
  height: string | null;
  imageUrl: string | null;
  price: number;
  oldPrice: number | null;
  requested: number;
  quantity: number; // скорректированное количество
  available: number;
  isDemo: boolean;
  issue: "unavailable" | "reduced" | null;
  lineTotal: number;
};

export type PromoResult = { code: string; discount: number; error: null } | { code: string; discount: 0; error: string };

export type Quote = {
  lines: QuoteLine[];
  subtotal: number;
  itemsDiscount: number;
  promo: PromoResult | null;
  promoCodeId: string | null;
  delivery: { code: string; cost: number; type: DeliveryMethod["type"]; calcByManager: boolean } | null;
  deliveryError: string | null;
  total: number;
  hasIssues: boolean;
  hasDemo: boolean;
};

export const MAX_QTY_PER_LINE = 20;
export const MAX_LINES = 50;

export function promoError(promo: PromoCode | null, subtotal: number, now = new Date()): string | null {
  if (!promo || !promo.isActive) return "not_found";
  if (promo.startsAt && promo.startsAt > now) return "not_started";
  if (promo.endsAt && promo.endsAt < now) return "expired";
  if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) return "exhausted";
  if (subtotal < promo.minOrder) return "min_order";
  return null;
}

export function computePromoDiscount(promo: PromoCode, lines: Pick<QuoteLine, "lineTotal" | "oldPrice" | "price">[]): number {
  const eligible = lines
    .filter((l) => promo.applyToSale || !(l.oldPrice && l.oldPrice > l.price))
    .reduce((s, l) => s + l.lineTotal, 0);
  if (eligible <= 0) return 0;
  const raw = promo.type === "PERCENT" ? Math.floor((eligible * Math.min(100, Math.max(0, promo.value))) / 100) : promo.value;
  return Math.max(0, Math.min(raw, eligible));
}

export function deliveryCost(method: Pick<DeliveryMethod, "price" | "freeFrom" | "calcByManager">, amount: number): number {
  if (method.calcByManager) return 0;
  if (method.freeFrom !== null && method.freeFrom !== undefined && amount >= method.freeFrom) return 0;
  return method.price;
}

export function deliveryAvailableInCity(method: Pick<DeliveryMethod, "cities" | "type">, city?: string | null): boolean {
  if (!method.cities.length) return true;
  if (!city) return false;
  const c = city.trim().toLowerCase();
  return method.cities.some((x) => x.trim().toLowerCase() === c);
}

/**
 * Серверный расчёт корзины: актуальные цены и остатки из БД.
 * Используется и для отображения корзины, и (в транзакции) при создании заказа.
 */
export async function computeQuote(db: Db, input: QuoteInput): Promise<Quote> {
  // Схлопываем дубликаты
  const merged = new Map<string, number>();
  for (const it of input.items.slice(0, MAX_LINES)) {
    const q = Math.max(0, Math.min(MAX_QTY_PER_LINE, Math.floor(it.quantity)));
    if (q > 0) merged.set(it.variantId, Math.min(MAX_QTY_PER_LINE, (merged.get(it.variantId) ?? 0) + q));
  }
  const ids = Array.from(merged.keys());
  const variants = ids.length
    ? await db.productVariant.findMany({
        where: { id: { in: ids } },
        include: {
          color: true,
          stocks: { where: { warehouse: { isActive: true } }, select: { quantity: true } },
          product: {
            select: {
              id: true,
              slug: true,
              article: true,
              nameRu: true,
              nameKz: true,
              status: true,
              isDemo: true,
              images: { orderBy: { sortOrder: "asc" }, select: { url: true, colorId: true } },
            },
          },
        },
      })
    : [];
  const byId = new Map(variants.map((v) => [v.id, v]));

  const lines: QuoteLine[] = [];
  for (const [variantId, requested] of merged) {
    const v = byId.get(variantId);
    if (!v) continue; // вариант удалён — молча убираем
    const sellable = v.isActive && v.product.status === "ACTIVE";
    const available = sellable ? v.stocks.reduce((s, st) => s + Math.max(0, st.quantity), 0) : 0;
    const quantity = Math.min(requested, available);
    const image = v.product.images.find((i) => i.colorId === v.colorId) ?? v.product.images[0];
    lines.push({
      variantId,
      productId: v.product.id,
      slug: v.product.slug,
      article: v.product.article,
      sku: v.sku,
      nameRu: v.product.nameRu,
      nameKz: v.product.nameKz,
      colorRu: v.color.nameRu,
      colorKz: v.color.nameKz,
      colorHex: v.color.hex,
      size: v.size,
      height: v.height,
      imageUrl: image?.url ?? null,
      price: v.price,
      oldPrice: v.oldPrice && v.oldPrice > v.price ? v.oldPrice : null,
      requested,
      quantity,
      available,
      isDemo: v.product.isDemo,
      issue: available === 0 ? "unavailable" : quantity < requested ? "reduced" : null,
      lineTotal: v.price * quantity,
    });
  }

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const itemsDiscount = lines.reduce((s, l) => s + (l.oldPrice ? (l.oldPrice - l.price) * l.quantity : 0), 0);

  let promo: PromoResult | null = null;
  let promoCodeId: string | null = null;
  const code = input.promoCode?.trim().toUpperCase();
  if (code) {
    const p = await db.promoCode.findUnique({ where: { code } });
    const err = promoError(p, subtotal);
    if (err || !p) promo = { code, discount: 0, error: err ?? "not_found" };
    else {
      const discount = computePromoDiscount(p, lines);
      promo = discount > 0 ? { code, discount, error: null } : { code, discount: 0, error: "not_applicable" };
      if (discount > 0) promoCodeId = p.id;
    }
  }
  const promoDiscount = promo && !promo.error ? promo.discount : 0;
  const afterPromo = subtotal - promoDiscount;

  let delivery: Quote["delivery"] = null;
  let deliveryError: string | null = null;
  if (input.deliveryCode) {
    const m = await db.deliveryMethod.findUnique({ where: { code: input.deliveryCode } });
    if (!m || !m.isActive) deliveryError = "not_found";
    else if (!deliveryAvailableInCity(m, input.city)) deliveryError = "not_available_in_city";
    else delivery = { code: m.code, type: m.type, calcByManager: m.calcByManager, cost: deliveryCost(m, afterPromo) };
  }

  return {
    lines,
    subtotal,
    itemsDiscount,
    promo,
    promoCodeId,
    delivery,
    deliveryError,
    total: afterPromo + (delivery?.cost ?? 0),
    hasIssues: lines.some((l) => l.issue !== null),
    hasDemo: lines.some((l) => l.isDemo),
  };
}
