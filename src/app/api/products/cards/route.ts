import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { productCardSelect, toCard } from "@/lib/catalog";

/** Карточки товаров по списку id (для страницы «Избранное» у гостей) */
export async function POST(req: Request) {
  const parsed = z.object({ ids: z.array(z.string().max(40)).max(200) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ items: [] });
  const rows = await prisma.product.findMany({ where: { id: { in: parsed.data.ids }, status: "ACTIVE" }, select: productCardSelect });
  const order = new Map(parsed.data.ids.map((id, i) => [id, i]));
  return NextResponse.json({ items: rows.map(toCard).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)) });
}
