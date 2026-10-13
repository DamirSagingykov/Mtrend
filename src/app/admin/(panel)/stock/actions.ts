"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/admin-guard";
import { audit } from "@/lib/audit";
import { recomputeProductAggregates } from "@/lib/product-aggregates";
import type { ActionResult } from "@/components/admin/action-form";

export async function saveStockRowsAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requirePermission("stock.edit");
  const rows = fd.getAll("rows").map(String).slice(0, 2000);
  const touched = new Set<string>();
  let changes = 0;
  const errors: string[] = [];
  await prisma.$transaction(async (tx) => {
    for (const r of rows) {
      const [variantId, warehouseId] = r.split(":");
      const qty = parseInt(String(fd.get(`q_${variantId}_${warehouseId}`)), 10);
      if (!Number.isFinite(qty) || qty < 0) {
        errors.push(`Некорректное значение для ${r}`);
        continue;
      }
      const current = await tx.stock.findUnique({ where: { variantId_warehouseId: { variantId, warehouseId } }, include: { variant: { select: { productId: true } } } });
      if ((current?.quantity ?? 0) === qty) continue;
      await tx.stock.upsert({
        where: { variantId_warehouseId: { variantId, warehouseId } },
        update: { quantity: qty },
        create: { variantId, warehouseId, quantity: qty },
      });
      await tx.stockMovement.create({ data: { variantId, warehouseId, delta: qty - (current?.quantity ?? 0), reason: "MANUAL", userId: user.id } });
      const v = current?.variant ?? (await tx.productVariant.findUnique({ where: { id: variantId }, select: { productId: true } }));
      if (v) touched.add(v.productId);
      changes++;
    }
  });
  if (touched.size) await recomputeProductAggregates(Array.from(touched));
  await audit(user.id, "stock_edit", "stock", null, { changes });
  revalidatePath("/admin/stock");
  revalidatePath("/", "layout");
  return errors.length ? { error: errors.join("\n") } : { ok: `Изменений: ${changes}` };
}
