import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { toXlsx } from "@/lib/admin/spreadsheet";
import { IMPORT_TEMPLATE_COLUMNS } from "@/lib/import/catalog-import";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "import.run")) return new Response("Forbidden", { status: 403 });
  const warehouses = await prisma.warehouse.findMany({ orderBy: { priority: "asc" } });
  const cols = [...IMPORT_TEMPLATE_COLUMNS.filter((c) => !c.startsWith("stock_")), ...warehouses.map((w) => `stock_${w.code}`)];
  const example: Record<string, unknown> = {
    article: "9293", nameRu: "Костюм классический", nameKz: "Классикалық костюм", category: "kostyumy-dvoyki", brand: "M-TREND",
    materialRu: "Шерсть", materialKz: "Жүн", compositionRu: "70% шерсть, 30% полиэстер", season: "DEMI", fit: "SLIM", isNew: 1, publish: 0,
    sku: "9293-NAVY-50-176", colorCode: "navy", colorRu: "Тёмно-синий", colorKz: "Қою көк", colorHex: "#1f2a44", size: "50", height: "176", price: 0, oldPrice: "",
  };
  for (const w of warehouses) example[`stock_${w.code}`] = 0;
  const buf = await toXlsx({ columns: cols.map((c) => ({ key: c, header: c, width: Math.max(10, c.length + 2) })), rows: [example] }, "Каталог");
  return new Response(new Uint8Array(buf), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="mtrend-import-template.xlsx"' },
  });
}
