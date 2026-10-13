import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { checkOrigin, clientIp, jsonError } from "@/lib/http";

export async function POST(req: Request) {
  if (!checkOrigin(req)) return jsonError("forbidden", 403);
  if (!rateLimit(`sub:${clientIp(req)}`, 5, 60_000).ok) return jsonError("rate_limited", 429);
  const parsed = z.object({ email: z.string().trim().toLowerCase().email().max(200), locale: z.enum(["ru", "kz"]).default("ru") }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_email");
  await prisma.subscriber.upsert({ where: { email: parsed.data.email }, update: { locale: parsed.data.locale, consent: true }, create: parsed.data });
  return NextResponse.json({ ok: true });
}
