"use server";

import { revalidatePath } from "next/cache";
import type { FitType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/admin-guard";
import { parseChartCsv } from "@/lib/size-recommender";
import { audit } from "@/lib/audit";
import type { ActionResult } from "@/components/admin/action-form";

export async function saveChartAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requirePermission("catalog.edit");
  const id = String(fd.get("id") || "") || null;
  const { rows, errors } = parseChartCsv(String(fd.get("csv") || ""));
  if (errors.length) return { error: errors.join("\n") };
  if (!rows.length) return { error: "Таблица пустая" };
  const data = {
    name: String(fd.get("name") || "").trim().slice(0, 200) || "Таблица",
    kind: String(fd.get("kind") || "GENERIC"),
    fit: (String(fd.get("fit") || "") || null) as FitType | null,
    rows,
    notesRu: String(fd.get("notesRu") || "").trim() || null,
    notesKz: String(fd.get("notesKz") || "").trim() || null,
    isDemo: fd.get("isDemo") === "on",
  };
  const saved = id ? await prisma.sizeChart.update({ where: { id }, data }) : await prisma.sizeChart.create({ data });
  await audit(user.id, id ? "update" : "create", "sizeChart", saved.id);
  revalidatePath("/", "layout");
  return { ok: `Сохранено строк: ${rows.length}` };
}

export async function deleteChartAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requirePermission("catalog.edit");
  const id = String(fd.get("id"));
  await prisma.sizeChart.delete({ where: { id } });
  await audit(user.id, "delete", "sizeChart", id);
  revalidatePath("/", "layout");
  return { ok: "Удалено" };
}
