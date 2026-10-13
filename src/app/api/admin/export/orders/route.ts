import type { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { toCsv, toXlsx, type Sheet } from "@/lib/admin/spreadsheet";
import { orderStatusLabel, paymentStatusLabel } from "@/lib/admin/labels";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "orders.export")) return new Response("Forbidden", { status: 403 });
  const sp = new URL(req.url).searchParams;
  const status = sp.get("status") as OrderStatus | null;
  const where: Prisma.OrderWhereInput = {
    ...(status && status in orderStatusLabel ? { status } : {}),
    ...(sp.get("demo") === "0" ? { isDemo: false } : {}),
    ...(sp.get("from") || sp.get("to")
      ? { createdAt: { ...(sp.get("from") ? { gte: new Date(sp.get("from")!) } : {}), ...(sp.get("to") ? { lte: new Date(sp.get("to") + "T23:59:59") } : {}) } }
      : {}),
  };
  const orders = await prisma.order.findMany({ where, orderBy: { createdAt: "desc" }, include: { items: true, store: true }, take: 20_000 });
  const sheet: Sheet = {
    columns: [
      { key: "number", header: "Номер", width: 14 },
      { key: "date", header: "Дата", width: 18 },
      { key: "status", header: "Статус", width: 18 },
      { key: "payment", header: "Оплата", width: 14 },
      { key: "name", header: "Покупатель", width: 22 },
      { key: "phone", header: "Телефон", width: 15 },
      { key: "email", header: "Email", width: 22 },
      { key: "city", header: "Город", width: 14 },
      { key: "address", header: "Адрес / самовывоз", width: 30 },
      { key: "delivery", header: "Доставка", width: 14 },
      { key: "article", header: "Артикул", width: 12 },
      { key: "sku", header: "SKU", width: 22 },
      { key: "product", header: "Товар", width: 30 },
      { key: "color", header: "Цвет", width: 12 },
      { key: "size", header: "Размер", width: 8 },
      { key: "height", header: "Рост", width: 8 },
      { key: "qty", header: "Кол-во", width: 8 },
      { key: "price", header: "Цена", width: 10 },
      { key: "lineTotal", header: "Сумма строки", width: 12 },
      { key: "orderTotal", header: "Итого заказа", width: 12 },
      { key: "promo", header: "Промокод", width: 10 },
      { key: "demo", header: "Тестовый", width: 9 },
    ],
    rows: orders.flatMap((o) =>
      o.items.map((i) => ({
        number: o.number,
        date: o.createdAt.toISOString().replace("T", " ").slice(0, 16),
        status: orderStatusLabel[o.status],
        payment: paymentStatusLabel[o.paymentStatus],
        name: o.customerName,
        phone: o.customerPhone,
        email: o.customerEmail ?? "",
        city: o.city,
        address: o.store ? `Самовывоз: ${o.store.addressRu}` : o.address ?? "",
        delivery: o.deliveryMethod,
        article: i.article,
        sku: i.sku,
        product: i.nameRu,
        color: i.colorRu,
        size: i.size,
        height: i.height ?? "",
        qty: i.quantity,
        price: i.price,
        lineTotal: i.total,
        orderTotal: o.total,
        promo: o.promoCode ?? "",
        demo: o.isDemo ? "да" : "",
      })),
    ),
  };
  await audit(user.id, "export", "order", null, { count: orders.length });
  const stamp = new Date().toISOString().slice(0, 10);
  if (sp.get("format") === "csv") {
    return new Response(toCsv(sheet), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="mtrend-orders-${stamp}.csv"` },
    });
  }
  return new Response(new Uint8Array(await toXlsx(sheet, "Заказы")), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="mtrend-orders-${stamp}.xlsx"`,
    },
  });
}
