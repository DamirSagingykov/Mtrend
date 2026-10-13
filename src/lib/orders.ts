import { randomBytes } from "node:crypto";
import { Prisma, type OrderStatus, type PaymentStatus } from "@prisma/client";
import { prisma } from "./db";
import { computeQuote, type Quote } from "./quote";
import { isProviderUsable } from "./payments";
import { recomputeProductAggregates } from "./product-aggregates";

export class OrderError extends Error {
  constructor(
    public code:
      | "empty_cart"
      | "stock"
      | "promo"
      | "delivery"
      | "payment"
      | "pickup_store"
      | "address_required"
      | "conflict",
    public details?: unknown,
  ) {
    super(code);
  }
}

export type CreateOrderInput = {
  idempotencyKey: string;
  items: { variantId: string; quantity: number }[];
  customerName: string;
  customerPhone: string; // нормализованный +7…
  customerEmail?: string | null;
  city: string;
  address?: string | null;
  deliveryCode: string;
  storeId?: string | null;
  paymentCode: string;
  promoCode?: string | null;
  comment?: string | null;
  locale: string;
  userId?: string | null;
  ip?: string | null;
};

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ["PENDING_CONFIRMATION", "CONFIRMED", "CANCELLED"],
  PENDING_CONFIRMATION: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["ASSEMBLING", "SHIPPED", "DELIVERED", "CANCELLED"],
  ASSEMBLING: ["SHIPPED", "DELIVERED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "RETURNED", "CANCELLED"],
  DELIVERED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
};

async function nextOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
  const counter = await tx.orderCounter.upsert({
    where: { id: 1 },
    update: { value: { increment: 1 } },
    create: { id: 1, value: 1 },
  });
  const yy = String(new Date().getFullYear()).slice(-2);
  return `MT${yy}-${String(counter.value).padStart(6, "0")}`;
}

/**
 * Создание заказа. Всё выполняется в одной транзакции:
 *  — повторная серверная проверка цен и остатков (цены из клиента не принимаются);
 *  — атомарное списание остатков по складам условным UPDATE (quantity >= n), что исключает уход в минус при гонке;
 *  — идемпотентность по idempotencyKey (повторная отправка формы не создаёт второй заказ и не списывает дважды).
 */
export async function createOrder(input: CreateOrderInput) {
  const existing = await prisma.order.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) return { order: existing, duplicate: true as const };

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const quote: Quote = await computeQuote(tx, {
          items: input.items,
          promoCode: input.promoCode,
          deliveryCode: input.deliveryCode,
          city: input.city,
        });
        if (!quote.lines.length) throw new OrderError("empty_cart");
        if (quote.hasIssues) throw new OrderError("stock", quote.lines.filter((l) => l.issue));
        if (input.promoCode && (!quote.promo || quote.promo.error)) throw new OrderError("promo", quote.promo?.error);
        if (!quote.delivery) throw new OrderError("delivery", quote.deliveryError);

        const payment = await tx.paymentMethod.findUnique({ where: { code: input.paymentCode } });
        if (!payment || !payment.isActive || !isProviderUsable(payment.provider)) throw new OrderError("payment");

        let pickupWarehouseId: string | null = null;
        let storeId: string | null = null;
        if (quote.delivery.type === "PICKUP") {
          const store = input.storeId
            ? await tx.store.findFirst({ where: { id: input.storeId, isActive: true, isPickup: true } })
            : null;
          if (!store) throw new OrderError("pickup_store");
          storeId = store.id;
          pickupWarehouseId = store.warehouseId;
        } else if (!input.address?.trim()) {
          throw new OrderError("address_required");
        }

        const number = await nextOrderNumber(tx);
        const order = await tx.order.create({
          data: {
            number,
            accessToken: randomBytes(24).toString("base64url"),
            idempotencyKey: input.idempotencyKey,
            status: "NEW",
            paymentStatus: "NOT_PAID",
            paymentMethod: payment.code,
            deliveryMethod: quote.delivery.code,
            locale: input.locale,
            userId: input.userId ?? null,
            customerName: input.customerName,
            customerPhone: input.customerPhone,
            customerEmail: input.customerEmail || null,
            city: input.city,
            address: quote.delivery.type === "PICKUP" ? null : input.address,
            storeId,
            comment: input.comment || null,
            subtotal: quote.subtotal,
            itemsDiscount: quote.itemsDiscount,
            promoDiscount: quote.promo && !quote.promo.error ? quote.promo.discount : 0,
            deliveryCost: quote.delivery.cost,
            total: quote.total,
            promoCode: quote.promo && !quote.promo.error ? quote.promo.code : null,
            promoCodeId: quote.promoCodeId,
            isDemo: quote.hasDemo,
            ip: input.ip ?? null,
            history: { create: { status: "NEW", note: "Заказ создан на сайте" } },
          },
        });

        // Списание остатков по складам
        for (const line of quote.lines) {
          const stocks = await tx.stock.findMany({
            where: { variantId: line.variantId, quantity: { gt: 0 }, warehouse: { isActive: true } },
            include: { warehouse: { select: { id: true, code: true, priority: true } } },
          });
          stocks.sort((a, b) => {
            if (pickupWarehouseId) {
              if (a.warehouseId === pickupWarehouseId) return -1;
              if (b.warehouseId === pickupWarehouseId) return 1;
            }
            return a.warehouse.priority - b.warehouse.priority || b.quantity - a.quantity;
          });
          let remaining = line.quantity;
          const allocations: { warehouseCode: string; quantity: number }[] = [];
          for (const st of stocks) {
            if (remaining <= 0) break;
            const take = Math.min(remaining, st.quantity);
            const res = await tx.stock.updateMany({
              where: { id: st.id, quantity: { gte: take } },
              data: { quantity: { decrement: take } },
            });
            if (res.count !== 1) throw new OrderError("stock", [{ variantId: line.variantId, issue: "race" }]);
            await tx.stockMovement.create({
              data: { variantId: line.variantId, warehouseId: st.warehouseId, delta: -take, reason: "ORDER", orderId: order.id },
            });
            allocations.push({ warehouseCode: st.warehouse.code, quantity: take });
            remaining -= take;
          }
          if (remaining > 0) throw new OrderError("stock", [{ variantId: line.variantId, issue: "insufficient" }]);

          await tx.orderItem.create({
            data: {
              orderId: order.id,
              productId: line.productId,
              variantId: line.variantId,
              sku: line.sku,
              article: line.article,
              nameRu: line.nameRu,
              nameKz: line.nameKz,
              colorRu: line.colorRu,
              colorKz: line.colorKz,
              size: line.size,
              height: line.height,
              imageUrl: line.imageUrl,
              price: line.price,
              oldPrice: line.oldPrice,
              quantity: line.quantity,
              total: line.lineTotal,
              allocations,
            },
          });
          await tx.product.update({ where: { id: line.productId }, data: { salesCount: { increment: line.quantity } } });
        }

        if (quote.promoCodeId) {
          const promo = await tx.promoCode.findUniqueOrThrow({ where: { id: quote.promoCodeId } });
          const res = await tx.promoCode.updateMany({
            where: { id: promo.id, ...(promo.maxUses !== null ? { usedCount: { lt: promo.maxUses } } : {}) },
            data: { usedCount: { increment: 1 } },
          });
          if (res.count !== 1) throw new OrderError("promo", "exhausted");
        }

        return { order, productIds: quote.lines.map((l) => l.productId) };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 20_000, maxWait: 10_000 },
    );

    await recomputeProductAggregates(result.productIds);
    return { order: result.order, duplicate: false as const };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const dup = await prisma.order.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (dup) return { order: dup, duplicate: true as const };
      throw new OrderError("conflict");
    }
    throw e;
  }
}

/** Возврат остатков на склады (отмена / возврат). Защищено флагом stockReleased от повторного выполнения. */
async function releaseStock(tx: Prisma.TransactionClient, orderId: string, reason: "ORDER_CANCEL" | "RETURN", userId?: string) {
  const lock = await tx.order.updateMany({ where: { id: orderId, stockReleased: false }, data: { stockReleased: true } });
  if (lock.count !== 1) return [];
  const movements = await tx.stockMovement.findMany({ where: { orderId, reason: "ORDER" } });
  for (const m of movements) {
    const qty = -m.delta;
    await tx.stock.upsert({
      where: { variantId_warehouseId: { variantId: m.variantId, warehouseId: m.warehouseId } },
      update: { quantity: { increment: qty } },
      create: { variantId: m.variantId, warehouseId: m.warehouseId, quantity: qty },
    });
    await tx.stockMovement.create({
      data: { variantId: m.variantId, warehouseId: m.warehouseId, delta: qty, reason, orderId, userId },
    });
  }
  const items = await tx.orderItem.findMany({ where: { orderId }, select: { productId: true, quantity: true } });
  for (const it of items) {
    if (it.productId) await tx.product.update({ where: { id: it.productId }, data: { salesCount: { decrement: it.quantity } } });
  }
  return items.map((i) => i.productId).filter((x): x is string => !!x);
}

export async function changeOrderStatus(
  orderId: string,
  status: OrderStatus,
  actor: { id: string; name: string },
  note?: string,
) {
  const productIds = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (order.status === status) return [];
    if (!ORDER_TRANSITIONS[order.status].includes(status)) {
      throw new Error(`Недопустимый переход статуса: ${order.status} → ${status}`);
    }
    // оптимистичная блокировка по текущему статусу
    const upd = await tx.order.updateMany({ where: { id: orderId, status: order.status }, data: { status } });
    if (upd.count !== 1) throw new Error("Заказ был изменён другим пользователем. Обновите страницу.");
    await tx.orderStatusHistory.create({ data: { orderId, status, note: note || null, userId: actor.id, userName: actor.name } });
    if (status === "CANCELLED") return releaseStock(tx, orderId, "ORDER_CANCEL", actor.id);
    if (status === "RETURNED") return releaseStock(tx, orderId, "RETURN", actor.id);
    return [];
  });
  if (productIds.length) await recomputeProductAggregates(productIds);
}

export async function changePaymentStatus(orderId: string, paymentStatus: PaymentStatus, actor: { id: string; name: string }, ref?: string) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.update({
      where: { id: orderId },
      data: { paymentStatus, ...(ref !== undefined ? { paymentRef: ref || null } : {}) },
    });
    await tx.orderStatusHistory.create({
      data: { orderId, status: order.status, note: `Статус оплаты: ${paymentStatus}${ref ? ` (${ref})` : ""}`, userId: actor.id, userName: actor.name },
    });
  });
}
