import Link from "next/link";
import type { Prisma, ProductStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/admin-guard";
import { can } from "@/lib/permissions";
import { formatPrice } from "@/lib/format";
import { PageHeader, Badge, Table, Pager, adminInput, adminBtn } from "@/components/admin/ui";
import { setProductStatusAction } from "./actions";

const statusLabel: Record<ProductStatus, string> = { DRAFT: "Черновик", ACTIVE: "Опубликован", ARCHIVED: "Архив" };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; category?: string; demo?: string; page?: string; stock?: string }> }) {
  const user = await requireStaffPage("products.view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const take = 40;
  const where: Prisma.ProductWhereInput = {
    ...(sp.status && sp.status in statusLabel ? { status: sp.status as ProductStatus } : {}),
    ...(sp.category ? { categoryId: sp.category } : {}),
    ...(sp.demo === "1" ? { isDemo: true } : sp.demo === "0" ? { isDemo: false } : {}),
    ...(sp.stock === "0" ? { totalStock: 0 } : {}),
    ...(sp.q
      ? {
          OR: [
            { nameRu: { contains: sp.q, mode: "insensitive" } },
            { article: { contains: sp.q, mode: "insensitive" } },
            { variants: { some: { sku: { contains: sp.q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };
  const [total, products, categories] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * take,
      take,
      include: { category: true, images: { take: 1, orderBy: { sortOrder: "asc" } }, _count: { select: { variants: true } } },
    }),
    prisma.category.findMany({ orderBy: { nameRu: "asc" } }),
  ]);
  const editable = can(user.role, "products.edit");
  const qs = (p: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...p })) if (v) u.set(k, v);
    return `/admin/products?${u}`;
  };

  return (
    <div>
      <PageHeader title={`Товары (${total})`} actions={editable && <Link href="/admin/products/new" className={adminBtn}>+ Добавить товар</Link>} />
      <form className="flex flex-wrap gap-2 mb-4">
        <input name="q" defaultValue={sp.q} placeholder="Название, артикул, SKU" className={`${adminInput} max-w-xs`} />
        <select name="category" defaultValue={sp.category ?? ""} className={`${adminInput} w-52`}>
          <option value="">Все категории</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.nameRu}</option>
          ))}
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className={`${adminInput} w-40`}>
          <option value="">Любой статус</option>
          {Object.entries(statusLabel).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select name="demo" defaultValue={sp.demo ?? ""} className={`${adminInput} w-40`}>
          <option value="">Все</option>
          <option value="0">Реальные</option>
          <option value="1">Демо</option>
        </select>
        <select name="stock" defaultValue={sp.stock ?? ""} className={`${adminInput} w-40`}>
          <option value="">Любой остаток</option>
          <option value="0">Нет в наличии</option>
        </select>
        <button className={adminBtn}>Фильтр</button>
      </form>
      <Table>
        <thead>
          <tr>
            <th />
            <th>Товар</th>
            <th>Артикул</th>
            <th>Категория</th>
            <th>SKU</th>
            <th className="!text-right">Цена</th>
            <th className="!text-right">Остаток</th>
            <th>Статус</th>
            {editable && <th />}
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id}>
              <td className="w-12">
                {p.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.images[0].url} alt="" className="w-10 h-12 object-cover bg-milk" />
                ) : (
                  <div className="w-10 h-12 bg-milk" />
                )}
              </td>
              <td>
                <Link href={`/admin/products/${p.id}`} className="hover:underline font-medium">{p.nameRu}</Link>
                <div className="flex gap-1 mt-0.5">
                  {p.isDemo && <Badge tone="red">демо</Badge>}
                  {p.isNew && <Badge>новинка</Badge>}
                  {p.maxDiscountPercent > 0 && <Badge tone="amber">−{p.maxDiscountPercent}%</Badge>}
                </div>
              </td>
              <td>{p.article}</td>
              <td>{p.category.nameRu}</td>
              <td>{p._count.variants}</td>
              <td className="text-right whitespace-nowrap">{p.minPrice === p.maxPrice ? formatPrice(p.minPrice) : `${formatPrice(p.minPrice)} – ${formatPrice(p.maxPrice)}`}</td>
              <td className={`text-right ${p.totalStock === 0 ? "text-danger" : ""}`}>{p.totalStock}</td>
              <td><Badge tone={p.status === "ACTIVE" ? "green" : p.status === "ARCHIVED" ? "neutral" : "amber"}>{statusLabel[p.status]}</Badge></td>
              {editable && (
                <td>
                  <form action={setProductStatusAction} className="flex gap-1">
                    <input type="hidden" name="id" value={p.id} />
                    {p.status !== "ACTIVE" ? (
                      <button name="status" value="ACTIVE" className="text-[12px] underline">Опубликовать</button>
                    ) : (
                      <button name="status" value="DRAFT" className="text-[12px] underline text-ink-muted">Снять с продажи</button>
                    )}
                  </form>
                </td>
              )}
            </tr>
          ))}
          {!products.length && (
            <tr><td colSpan={9} className="text-center py-10 text-ink-muted">Товары не найдены</td></tr>
          )}
        </tbody>
      </Table>
      <Pager page={page} pages={Math.ceil(total / take)} href={(p) => qs({ page: String(p) })} />
    </div>
  );
}
