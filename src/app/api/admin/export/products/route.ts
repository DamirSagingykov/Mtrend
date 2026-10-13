import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { toXlsx } from "@/lib/admin/spreadsheet";

/** Экспорт каталога в формате, совместимом с импортом */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "products.view")) return new Response("Forbidden", { status: 403 });
  const [warehouses, variants] = await Promise.all([
    prisma.warehouse.findMany({ orderBy: { priority: "asc" } }),
    prisma.productVariant.findMany({ include: { color: true, stocks: true, product: { include: { category: true } } }, orderBy: [{ product: { article: "asc" } }, { sku: "asc" }] }),
  ]);
  const cols = ["article", "nameRu", "nameKz", "category", "brand", "materialRu", "materialKz", "compositionRu", "season", "fit", "status", "isDemo", "sku", "colorCode", "colorRu", "colorKz", "colorHex", "size", "height", "price", "oldPrice", "barcode", ...warehouses.map((w) => `stock_${w.code}`)];
  const rows = variants.map((v) => {
    const r: Record<string, unknown> = {
      article: v.product.article, nameRu: v.product.nameRu, nameKz: v.product.nameKz, category: v.product.category.slug, brand: v.product.brand,
      materialRu: v.product.materialRu, materialKz: v.product.materialKz, compositionRu: v.product.compositionRu, season: v.product.season, fit: v.product.fit,
      status: v.product.status, isDemo: v.product.isDemo ? 1 : 0, sku: v.sku, colorCode: v.color.code, colorRu: v.color.nameRu, colorKz: v.color.nameKz, colorHex: v.color.hex,
      size: v.size, height: v.height, price: v.price, oldPrice: v.oldPrice, barcode: v.barcode,
    };
    for (const w of warehouses) r[`stock_${w.code}`] = v.stocks.find((s) => s.warehouseId === w.id)?.quantity ?? 0;
    return r;
  });
  const buf = await toXlsx({ columns: cols.map((c) => ({ key: c, header: c, width: 14 })), rows }, "Каталог");
  return new Response(new Uint8Array(buf), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="mtrend-catalog-${new Date().toISOString().slice(0, 10)}.xlsx"` },
  });
}
