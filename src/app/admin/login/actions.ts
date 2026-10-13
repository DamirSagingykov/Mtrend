"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSession, destroySession, dummyVerify, getClientIp, verifyPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

export async function staffLoginAction(_: { error?: string } | null, fd: FormData) {
  const ip = await getClientIp();
  if (!rateLimit(`admin-login:${ip}`, 8, 15 * 60_000).ok) return { error: "Слишком много попыток. Повторите через 15 минут." };
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const password = String(fd.get("password") || "");
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = user ? await verifyPassword(password, user.passwordHash) : await dummyVerify(password);
  if (!user || !ok || !user.isActive || user.role === "CUSTOMER") {
    await audit(user?.id, "login_failed", "auth", null, { email });
    return { error: "Неверный email или пароль" };
  }
  await createSession(user);
  await audit(user.id, "login", "auth");
  redirect("/admin");
}

export async function staffLogoutAction() {
  await destroySession();
  redirect("/admin/login");
}
