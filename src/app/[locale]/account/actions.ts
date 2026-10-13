"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, destroySession, dummyVerify, getClientIp, getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";
import { normalizePhone } from "@/lib/format";
import { rateLimit } from "@/lib/rate-limit";
import { getDictionary } from "@/i18n";
import { isLocale, type Locale } from "@/i18n/config";

export type FormState = { error?: string; ok?: string } | null;

function loc(fd: FormData): Locale {
  const l = String(fd.get("locale") || "ru");
  return isLocale(l) ? l : "ru";
}

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  const locale = loc(fd);
  const t = getDictionary(locale);
  const ip = await getClientIp();
  if (!rateLimit(`login:${ip}`, 10, 15 * 60_000).ok) return { error: t.account.tooMany };
  const login = String(fd.get("login") || "").trim().toLowerCase();
  const password = String(fd.get("password") || "");
  const phone = normalizePhone(login);
  const user = await prisma.user.findFirst({ where: phone ? { phone } : { email: login } });
  // одинаковое время ответа при отсутствии пользователя
  const ok = user ? await verifyPassword(password, user.passwordHash) : await dummyVerify(password);
  if (!user || !ok || !user.isActive || user.role !== "CUSTOMER") return { error: t.account.invalidCredentials };
  await createSession(user);
  redirect(`/${locale}/account`);
}

const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(10).max(20),
  email: z.string().trim().toLowerCase().email().max(200).optional().or(z.literal("")),
  password: z.string().min(8).max(200),
});

export async function registerAction(_: FormState, fd: FormData): Promise<FormState> {
  const locale = loc(fd);
  const t = getDictionary(locale);
  const ip = await getClientIp();
  if (!rateLimit(`register:${ip}`, 5, 60 * 60_000).ok) return { error: t.account.tooMany };
  const parsed = registerSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues.some((i) => i.path[0] === "password") ? t.account.passwordHint : t.checkout.required };
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return { error: t.checkout.invalidPhone };
  const email = parsed.data.email || null;
  const exists = await prisma.user.findFirst({ where: { OR: [{ phone }, ...(email ? [{ email }] : [])] } });
  if (exists) return { error: t.account.exists };
  const user = await prisma.user.create({
    data: { name: parsed.data.name, phone, email, passwordHash: await hashPassword(parsed.data.password), role: "CUSTOMER" },
  });
  // привязываем прошлые гостевые заказы по номеру телефона
  await prisma.order.updateMany({ where: { customerPhone: phone, userId: null }, data: { userId: user.id } });
  await createSession(user);
  redirect(`/${locale}/account`);
}

export async function logoutAction(fd: FormData) {
  await destroySession();
  redirect(`/${loc(fd)}/account`);
}

export async function updateProfileAction(_: FormState, fd: FormData): Promise<FormState> {
  const t = getDictionary(loc(fd));
  const user = await getCurrentUser();
  if (!user || user.role !== "CUSTOMER") return { error: t.common.error };
  const name = String(fd.get("name") || "").trim();
  const email = String(fd.get("email") || "").trim().toLowerCase() || null;
  if (name.length < 2) return { error: t.checkout.required };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: t.checkout.invalidEmail };
  if (email && (await prisma.user.findFirst({ where: { email, id: { not: user.id } } }))) return { error: t.account.exists };
  await prisma.user.update({ where: { id: user.id }, data: { name, email } });
  revalidatePath(`/${loc(fd)}/account`);
  return { ok: t.account.saved };
}

export async function addAddressAction(_: FormState, fd: FormData): Promise<FormState> {
  const t = getDictionary(loc(fd));
  const user = await getCurrentUser();
  if (!user || user.role !== "CUSTOMER") return { error: t.common.error };
  const city = String(fd.get("city") || "").trim().slice(0, 100);
  const address = String(fd.get("address") || "").trim().slice(0, 300);
  const label = String(fd.get("label") || "").trim().slice(0, 50) || null;
  const isDefault = fd.get("isDefault") === "on";
  if (!city || address.length < 5) return { error: t.checkout.required };
  if ((await prisma.address.count({ where: { userId: user.id } })) >= 10) return { error: t.common.error };
  await prisma.$transaction(async (tx) => {
    if (isDefault) await tx.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
    await tx.address.create({ data: { userId: user.id, city, address, label, isDefault } });
  });
  revalidatePath(`/${loc(fd)}/account`);
  return { ok: t.account.saved };
}

export async function deleteAddressAction(fd: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  await prisma.address.deleteMany({ where: { id: String(fd.get("id")), userId: user.id } });
  revalidatePath(`/${loc(fd)}/account`);
}
