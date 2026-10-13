"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/admin-guard";
import { hashPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import type { ActionResult } from "@/components/admin/action-form";

export async function saveStaffAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const admin = await requirePermission("staff.manage");
  const id = String(fd.get("id") || "") || null;
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const name = String(fd.get("name") || "").trim();
  const role = String(fd.get("role")) === "ADMIN" ? "ADMIN" : "MANAGER";
  const position = String(fd.get("position") || "").trim() || null;
  const phone = String(fd.get("phone") || "").trim() || null;
  const password = String(fd.get("password") || "");
  const isActive = fd.get("isActive") === "on";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Некорректный email" };
  if (name.length < 2) return { error: "Укажите имя" };
  if (!id && password.length < 10) return { error: "Пароль сотрудника — не менее 10 символов" };
  if (password && password.length < 10) return { error: "Пароль — не менее 10 символов" };
  if (id === admin.id && (!isActive || role !== "ADMIN")) return { error: "Нельзя отключить или понизить собственную учётную запись" };
  const exists = await prisma.user.findFirst({ where: { email, ...(id ? { id: { not: id } } : {}) } });
  if (exists) return { error: "Email уже используется" };
  const data = { email, name, role: role as "ADMIN" | "MANAGER", position, phone, isActive, ...(password ? { passwordHash: await hashPassword(password) } : {}) };
  const saved = id ? await prisma.user.update({ where: { id }, data }) : await prisma.user.create({ data: { ...data, passwordHash: data.passwordHash! } });
  if (id && (password || !isActive)) await prisma.session.deleteMany({ where: { userId: id } });
  await audit(admin.id, id ? "update" : "create", "staff", saved.id, { role, isActive });
  revalidatePath("/admin/staff");
  return { ok: "Сохранено" };
}
