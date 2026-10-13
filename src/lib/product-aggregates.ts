import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./db";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Пересчёт денормализованных полей товара (мин./макс. цена, макс. скидка, суммарный остаток).
 * Вызывается после любых изменений вариантов, цен и остатков.
 */
export async function recomputeProductAggregates(productIds: string[], db: Db = prisma) {
  const unique = Array.from(new Set(productIds));
  for (const productId of unique) {
    const variants = await db.productVariant.findMany({
      where: { productId, isActive: true },
      select: { price: true, oldPrice: true, stocks: { where: { warehouse: { isActive: true } }, select: { quantity: true } } },
    });
    const prices = variants.map((v) => v.price);
    const discounts = variants.map((v) => (v.oldPrice && v.oldPrice > v.price ? Math.round(((v.oldPrice - v.price) / v.oldPrice) * 100) : 0));
    const totalStock = variants.reduce((s, v) => s + v.stocks.reduce((a, st) => a + Math.max(0, st.quantity), 0), 0);
    await db.product.update({
      where: { id: productId },
      data: {
        minPrice: prices.length ? Math.min(...prices) : 0,
        maxPrice: prices.length ? Math.max(...prices) : 0,
        maxDiscountPercent: discounts.length ? Math.max(...discounts) : 0,
        totalStock,
      },
    });
  }
}

export async function recomputeAllProductAggregates(db: Db = prisma) {
  const ids = await db.product.findMany({ select: { id: true } });
  await recomputeProductAggregates(
    ids.map((p) => p.id),
    db,
  );
}
