import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { checkOrigin, jsonError } from "@/lib/http";

async function customer() {
  const u = await getCurrentUser();
  return u?.role === "CUSTOMER" ? u : null;
}

const idSchema = z.object({ productId: z.string().min(1).max(40) });

/** Слияние локального избранного с серверным; возвращает итоговый список */
export async function POST(req: Request) {
  if (!checkOrigin(req)) return jsonError("forbidden", 403);
  const user = await customer();
  if (!user) return jsonError("unauthorized", 401);
  const body = z.object({ merge: z.array(z.string().max(40)).max(200) }).safeParse(await req.json().catch(() => null));
  if (body.success && body.data.merge.length) {
    const existing = await prisma.product.findMany({ where: { id: { in: body.data.merge } }, select: { id: true } });
    await prisma.favorite.createMany({ data: existing.map((p) => ({ userId: user.id, productId: p.id })), skipDuplicates: true });
  }
  const favs = await prisma.favorite.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, select: { productId: true } });
  return NextResponse.json({ ids: favs.map((f) => f.productId) });
}

export async function PUT(req: Request) {
  if (!checkOrigin(req)) return jsonError("forbidden", 403);
  const user = await customer();
  if (!user) return jsonError("unauthorized", 401);
  const body = idSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return jsonError("invalid_request");
  const exists = await prisma.product.findUnique({ where: { id: body.data.productId }, select: { id: true } });
  if (!exists) return jsonError("not_found", 404);
  await prisma.favorite.upsert({
    where: { userId_productId: { userId: user.id, productId: body.data.productId } },
    update: {},
    create: { userId: user.id, productId: body.data.productId },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!checkOrigin(req)) return jsonError("forbidden", 403);
  const user = await customer();
  if (!user) return jsonError("unauthorized", 401);
  const body = idSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return jsonError("invalid_request");
  await prisma.favorite.deleteMany({ where: { userId: user.id, productId: body.data.productId } });
  return NextResponse.json({ ok: true });
}
