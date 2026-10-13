import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyOnecRequest } from "@/lib/import/onec-auth";

/**
 * Выгрузка заказов для 1С.
 * GET ?since=ISO-дата — заказы, изменённые после даты; ?pending=1 — только не подтверждённые 1С (по умолчанию).
 * Тестовые заказы (с демо-товарами) не выгружаются, если не указан ?includeDemo=1.
 */
export async function GET(req: Request) {
  const auth = await verifyOnecRequest(req, "");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const sp = new URL(req.url).searchParams;
  const since = sp.get("since") ? new Date(sp.get("since")!) : null;
  const pendingOnly = sp.get("pending") !== "0";
  const orders = await prisma.order.findMany({
    where: {
      ...(since && !isNaN(since.getTime()) ? { updatedAt: { gte: since } } : {}),
      ...(pendingOnly ? { exportedTo1CAt: null } : {}),
      ...(sp.get("includeDemo") === "1" ? {} : { isDemo: false }),
    },
    orderBy: { createdAt: "asc" },
    take: Math.min(500, Number(sp.get("limit")) || 200),
    include: { items: true, store: { select: { id: true, nameRu: true, warehouse: { select: { code: true } } } } },
  });
  await prisma.integrationLog.create({ data: { source: "1c", operation: "orders-export", status: "success", message: `Выгружено заказов: ${orders.length}` } });
  return NextResponse.json({
    orders: orders.map((o) => ({
      id: o.id,
      number: o.number,
      externalId: o.externalId,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      status: o.status,
      paymentStatus: o.paymentStatus,
      paymentMethod: o.paymentMethod,
      paymentRef: o.paymentRef,
      deliveryMethod: o.deliveryMethod,
      customer: { name: o.customerName, phone: o.customerPhone, email: o.customerEmail },
      city: o.city,
      address: o.address,
      pickupStore: o.store ? { name: o.store.nameRu, warehouseCode: o.store.warehouse?.code ?? null } : null,
      comment: o.comment,
      currency: "KZT",
      subtotal: o.subtotal,
      promoCode: o.promoCode,
      promoDiscount: o.promoDiscount,
      deliveryCost: o.deliveryCost,
      total: o.total,
      items: o.items.map((i) => ({
        sku: i.sku,
        article: i.article,
        name: i.nameRu,
        color: i.colorRu,
        size: i.size,
        height: i.height,
        price: i.price,
        quantity: i.quantity,
        total: i.total,
        allocations: i.allocations,
      })),
    })),
  });
}
