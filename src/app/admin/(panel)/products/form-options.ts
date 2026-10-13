import "server-only";
import { prisma } from "@/lib/db";

export async function loadProductFormOptions() {
  const [categories, charts] = await Promise.all([
    prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }] }),
    prisma.sizeChart.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const ordered: { value: string; label: string }[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const c of categories.filter((x) => x.parentId === parentId)) {
      ordered.push({ value: c.id, label: `${"— ".repeat(depth)}${c.nameRu}` });
      walk(c.id, depth + 1);
    }
  };
  walk(null, 0);
  return { categories: ordered, charts: charts.map((c) => ({ value: c.id, label: c.name })) };
}
