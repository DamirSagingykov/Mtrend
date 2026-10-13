import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/admin-guard";
import { formatDate } from "@/lib/format";
import { PageHeader, Table, Pager, Badge, adminInput, adminBtn } from "@/components/admin/ui";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { saveStockRowsAction } from "./actions";

export default async function StockPage({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string; page?: string; wh?: string }> }) {
  await requireStaffPage("stock.edit");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const take = 50;
  const warehouses = await prisma.warehouse.findMany({ orderBy: { priority: "asc" } });
  const where: Prisma.ProductVariantWhereInput = {
    ...(sp.q
      ? { OR: [{ sku: { contains: sp.q, mode: "insensitive" } }, { product: { article: { contains: sp.q, mode: "insensitive" } } }, { product: { nameRu: { contains: sp.q, mode: "insensitive" } } }] }
      : {}),
    ...(sp.filter === "zero" ? { isActive: true, stocks: { every: { quantity: { lte: 0 } } } } : {}),
  };
  const [total, variants, movements] = await Promise.all([
    prisma.productVariant.count({ where }),
    prisma.productVariant.findMany({
      where,
      orderBy: [{ product: { article: "asc" } }, { sku: "asc" }],
      skip: (page - 1) * take,
      take,
      include: { product: { select: { id: true, nameRu: true, article: true, isDemo: true } }, color: true, stocks: true },
    }),
    prisma.stockMovement.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { variant: { select: { sku: true } }, warehouse: { select: { code: true } }, order: { select: { number: true, id: true } } } }),
  ]);
  const qs = (p: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...p })) if (v) u.set(k, v);
    return `/admin/stock?${u}`;
  };
  const reasonLabel: Record<string, string> = { ORDER: "Заказ", ORDER_CANCEL: "Отмена заказа", RETURN: "Возврат", MANUAL: "Вручную", IMPORT: "Импорт", SYNC_1C: "1С" };

  return (
    <div>
      <PageHeader title="Остатки по складам" description="Быстрое редактирование остатков по SKU. Все изменения фиксируются в журнале движений." />
      <form className="flex flex-wrap gap-2 mb-4">
        <input name="q" defaultValue={sp.q} placeholder="SKU, артикул, название" className={`${adminInput} max-w-xs`} />
        <select name="filter" defaultValue={sp.filter ?? ""} className={`${adminInput} w-48`}>
          <option value="">Все варианты</option>
          <option value="zero">Нет в наличии</option>
        </select>
        <button className={adminBtn}>Найти</button>
      </form>
      <ActionForm action={saveStockRowsAction}>
        <Table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Товар</th>
              <th>Цвет / размер</th>
              {warehouses.map((w) => (
                <th key={w.id}>{w.code}</th>
              ))}
              <th>Итого</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => {
              const sum = v.stocks.reduce((s, x) => s + x.quantity, 0);
              return (
                <tr key={v.id}>
                  <td className="font-mono text-[12px]">{v.sku}{!v.isActive && <Badge>выкл</Badge>}</td>
                  <td>
                    <Link href={`/admin/products/${v.product.id}`} className="hover:underline">{v.product.nameRu}</Link>
                    {v.product.isDemo && <span className="text-danger text-[10px] ml-1">демо</span>}
                  </td>
                  <td>{v.color.nameRu} · {v.size}{v.height && ` / ${v.height}`}</td>
                  {warehouses.map((w) => (
                    <td key={w.id}>
                      <input type="hidden" name="rows" value={`${v.id}:${w.id}`} />
                      <input name={`q_${v.id}_${w.id}`} defaultValue={v.stocks.find((s) => s.warehouseId === w.id)?.quantity ?? 0} inputMode="numeric" className={`${adminInput} w-16`} />
                    </td>
                  ))}
                  <td className={sum === 0 ? "text-danger" : ""}>{sum}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        <SubmitButton className="mt-3">Сохранить остатки</SubmitButton>
      </ActionForm>
      <Pager page={page} pages={Math.ceil(total / take)} href={(p) => qs({ page: String(p) })} />

      <h2 className="font-medium mt-10 mb-3">Последние движения</h2>
      <Table>
        <thead>
          <tr><th>Дата</th><th>SKU</th><th>Склад</th><th>Изменение</th><th>Причина</th><th>Заказ</th></tr>
        </thead>
        <tbody>
          {movements.map((m) => (
            <tr key={m.id}>
              <td>{formatDate(m.createdAt, "ru", true)}</td>
              <td className="font-mono text-[12px]">{m.variant.sku}</td>
              <td>{m.warehouse.code}</td>
              <td className={m.delta < 0 ? "text-danger" : "text-success"}>{m.delta > 0 ? "+" : ""}{m.delta}</td>
              <td>{reasonLabel[m.reason]}</td>
              <td>{m.order && <Link href={`/admin/orders/${m.order.id}`} className="underline">{m.order.number}</Link>}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
