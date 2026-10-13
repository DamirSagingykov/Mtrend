import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyOnecRequest } from "@/lib/import/onec-auth";

const schema = z.object({
  orders: z.array(z.object({ number: z.string().max(40), externalId: z.string().max(100).optional() })).max(1000),
});

/** Подтверждение приёма заказов в 1С: отмечаем заказ переданным и сохраняем номер документа 1С */
export async function POST(req: Request) {
  const raw = await req.text();
  const auth = await verifyOnecRequest(req, raw);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "validation" }, { status: 422 });
  let updated = 0;
  for (const o of parsed.data.orders) {
    const r = await prisma.order.updateMany({
      where: { number: o.number },
      data: { exportedTo1CAt: new Date(), ...(o.externalId ? { externalId: o.externalId } : {}) },
    });
    updated += r.count;
  }
  await prisma.integrationLog.create({ data: { source: "1c", operation: "orders-ack", status: "success", message: `Подтверждено заказов: ${updated}` } });
  return NextResponse.json({ updated });
}
