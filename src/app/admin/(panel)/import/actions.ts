"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/admin-guard";
import { readTable } from "@/lib/admin/spreadsheet";
import { importCatalog, rowsToCatalogPayload } from "@/lib/import/catalog-import";
import { audit } from "@/lib/audit";
import type { ActionResult } from "@/components/admin/action-form";

export async function importFileAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requirePermission("import.run");
  const file = fd.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Выберите файл .xlsx или .csv" };
  if (file.size > 20 * 1024 * 1024) return { error: "Файл больше 20 МБ" };
  if (!/\.(xlsx|csv)$/i.test(file.name)) return { error: "Поддерживаются форматы .xlsx и .csv" };
  const started = Date.now();
  let rows: Record<string, unknown>[];
  try {
    rows = await readTable(file);
  } catch (e) {
    return { error: `Не удалось прочитать файл: ${e instanceof Error ? e.message : e}` };
  }
  const { payload, errors: parseErrors } = rowsToCatalogPayload(rows);
  payload.options = { dryRun: fd.get("dryRun") === "on", subtractPendingOrders: fd.get("subtractPending") === "on" };
  const report = await importCatalog(payload, /\.csv$/i.test(file.name) ? "csv" : "xlsx");
  const errors = [...parseErrors, ...report.errors];
  await prisma.integrationLog.create({
    data: {
      source: /\.csv$/i.test(file.name) ? "csv" : "xlsx",
      operation: "catalog",
      status: errors.length ? (report.productsCreated + report.productsUpdated ? "partial" : "error") : "success",
      message: `${file.name}: строк ${rows.length}${report.dryRun ? " (проверка без записи)" : ""}`,
      stats: { ...report, errors: undefined },
      errors: errors.slice(0, 500),
      durationMs: Date.now() - started,
    },
  });
  await audit(user.id, "import", "catalog", null, { file: file.name, rows: rows.length, dryRun: report.dryRun });
  revalidatePath("/", "layout");
  const summary = `${report.dryRun ? "ПРОВЕРКА (без записи). " : ""}Строк: ${rows.length}. Товары: +${report.productsCreated} / обновлено ${report.productsUpdated}. Варианты: +${report.variantsCreated} / обновлено ${report.variantsUpdated}. Остатков изменено: ${report.stocksUpdated}.`;
  if (errors.length) return { error: `${summary}\nОшибки (${errors.length}):\n${errors.slice(0, 30).map((e) => `• ${e.ref}: ${e.message}`).join("\n")}` };
  return { ok: summary };
}

export async function deleteDemoProductsAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requirePermission("import.run");
  if (fd.get("confirm") !== "УДАЛИТЬ") return { error: "Введите слово УДАЛИТЬ для подтверждения" };
  const demo = await prisma.product.findMany({ where: { isDemo: true }, select: { id: true } });
  const ids = demo.map((d) => d.id);
  const inOrders = await prisma.orderItem.findMany({ where: { productId: { in: ids } }, select: { productId: true }, distinct: ["productId"] });
  const keep = new Set(inOrders.map((i) => i.productId));
  await prisma.product.updateMany({ where: { id: { in: Array.from(keep).filter((x): x is string => !!x) } }, data: { status: "ARCHIVED" } });
  const del = await prisma.product.deleteMany({ where: { id: { in: ids.filter((id) => !keep.has(id)) } } });
  await prisma.promoCode.updateMany({ where: { code: "DEMO10" }, data: { isActive: false } });
  await prisma.sizeChart.deleteMany({ where: { isDemo: true, products: { none: {} } } });
  await audit(user.id, "delete_demo", "product", null, { deleted: del.count, archived: keep.size });
  revalidatePath("/", "layout");
  return { ok: `Удалено демо-товаров: ${del.count}, архивировано (есть в тестовых заказах): ${keep.size}. Промокод DEMO10 отключён.` };
}
