import { NextResponse, after } from "next/server";
import { z } from "zod";
import { createOrder, OrderError } from "@/lib/orders";
import { notifyNewOrder } from "@/lib/notifications";
import { normalizePhone } from "@/lib/format";
import { rateLimit } from "@/lib/rate-limit";
import { checkOrigin, clientIp, jsonError } from "@/lib/http";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { computeQuote } from "@/lib/quote";

const schema = z.object({
  idempotencyKey: z.string().min(16).max(64).regex(/^[A-Za-z0-9_-]+$/),
  items: z.array(z.object({ variantId: z.string().min(1).max(40), quantity: z.number().int().min(1).max(20) })).min(1).max(50),
  customerName: z.string().trim().min(2).max(120),
  customerPhone: z.string().trim().min(10).max(20),
  customerEmail: z.string().trim().email().max(200).optional().or(z.literal("")),
  city: z.string().trim().min(2).max(100),
  address: z.string().trim().max(300).optional(),
  deliveryCode: z.string().min(1).max(40),
  storeId: z.string().max(40).optional().nullable(),
  paymentCode: z.string().min(1).max(40),
  promoCode: z.string().trim().max(40).optional().nullable(),
  comment: z.string().trim().max(1000).optional(),
  locale: z.enum(["ru", "kz"]),
  consent: z.literal(true),
});

export async function POST(req: Request) {
  if (!checkOrigin(req)) return jsonError("forbidden", 403);
  const ip = clientIp(req);
  if (!rateLimit(`order:${ip}`, 10, 10 * 60_000).ok) return jsonError("rate_limited", 429);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("validation", 400, { issues: parsed.error.issues.map((i) => i.path.join(".")) });
  const data = parsed.data;
  const phone = normalizePhone(data.customerPhone);
  if (!phone) return jsonError("validation", 400, { issues: ["customerPhone"] });

  const user = await getCurrentUser();
  try {
    const { order, duplicate } = await createOrder({
      ...data,
      customerPhone: phone,
      customerEmail: data.customerEmail || null,
      userId: user?.role === "CUSTOMER" ? user.id : null,
      ip,
    });
    if (!duplicate) {
      console.info(`[order] created ${order.number} total=${order.total} ip=${ip}`);
      after(() => notifyNewOrder(order.id).catch((e) => console.error("[notify] failed", e)));
    }
    return NextResponse.json({ number: order.number, token: order.accessToken, total: order.total, duplicate });
  } catch (e) {
    if (e instanceof OrderError) {
      // При проблеме с остатками возвращаем актуальный расчёт, чтобы клиент обновил корзину
      const quote = e.code === "stock" ? await computeQuote(prisma, { items: data.items }) : undefined;
      return jsonError(e.code, 409, { details: e.details ?? null, quote });
    }
    console.error("[order] failed", e);
    return jsonError("server_error", 500);
  }
}
