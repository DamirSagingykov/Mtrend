import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { computeQuote } from "@/lib/quote";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp, jsonError } from "@/lib/http";

const schema = z.object({
  items: z.array(z.object({ variantId: z.string().min(1).max(40), quantity: z.number().int().min(1).max(100) })).max(50),
  promoCode: z.string().trim().max(40).nullish(),
  deliveryCode: z.string().max(40).nullish(),
  city: z.string().max(100).nullish(),
});

/** Актуальный расчёт корзины: цены, остатки, промокод, доставка — только из БД */
export async function POST(req: Request) {
  if (!rateLimit(`quote:${clientIp(req)}`, 120, 60_000).ok) return jsonError("rate_limited", 429);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_request");
  const quote = await computeQuote(prisma, parsed.data);
  return NextResponse.json(quote, { headers: { "Cache-Control": "no-store" } });
}
