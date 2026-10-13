"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import type { OrderStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/admin-guard";
import { changeOrderStatus, changePaymentStatus } from "@/lib/orders";
import { notifyOrderStatus } from "@/lib/notifications";
import { audit } from "@/lib/audit";
import { orderStatusLabel, paymentStatusLabel } from "@/lib/admin/labels";
import type { ActionResult } from "@/components/admin/action-form";

export async function setOrderStatusAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requirePermission("orders.edit");
  const id = String(fd.get("id"));
  const status = String(fd.get("status")) as OrderStatus;
  if (!(status in orderStatusLabel)) return { error: "Неизвестный статус" };
  try {
    await changeOrderStatus(id, status, { id: user.id, name: user.name }, String(fd.get("note") || "").slice(0, 500) || undefined);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Ошибка" };
  }
  await audit(user.id, "status", "order", id, { status });
  if (fd.get("notify") === "on") after(() => notifyOrderStatus(id).catch(() => {}));
  revalidatePath(`/admin/orders/${id}`);
  return { ok: `Статус изменён: ${orderStatusLabel[status]}${status === "CANCELLED" || status === "RETURNED" ? " — остатки возвращены на склады" : ""}` };
}

export async function setPaymentStatusAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requirePermission("orders.edit");
  const id = String(fd.get("id"));
  const status = String(fd.get("paymentStatus")) as PaymentStatus;
  if (!(status in paymentStatusLabel)) return { error: "Неизвестный статус оплаты" };
  await changePaymentStatus(id, status, { id: user.id, name: user.name }, String(fd.get("paymentRef") || "").slice(0, 200));
  await audit(user.id, "payment_status", "order", id, { status });
  revalidatePath(`/admin/orders/${id}`);
  return { ok: "Статус оплаты сохранён" };
}

export async function saveManagerNoteAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requirePermission("orders.edit");
  const id = String(fd.get("id"));
  await prisma.order.update({ where: { id }, data: { managerNote: String(fd.get("managerNote") || "").slice(0, 5000) || null } });
  await audit(user.id, "note", "order", id);
  revalidatePath(`/admin/orders/${id}`);
  return { ok: "Сохранено" };
}
