import Link from "next/link";
import type { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/admin-guard";
import { formatDate, formatPhone, formatPrice } from "@/lib/format";
import { PageHeader, Badge, Table, Pager, adminInput, adminBtn, adminBtnOutline } from "@/components/admin/ui";
import { orderStatusLabel, orderStatusTone, paymentStatusLabel } from "@/lib/admin/labels";

type SP = Promise<{ status?: string; q?: string; page?: string; from?: string; to?: string; demo?: string }>;

export default async function OrdersPage({ searchParams }: { searchParams: SP }) {
  await requireStaffPage("orders.view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const status = sp.status && sp.status in orderStatusLabel ? (sp.status as OrderStatus) : undefined;
  const where: Prisma.OrderWhereInput = {
    ...(status ? { status } : {}),
    ...(sp.demo === "0" ? { isDemo: false } : {}),
    ...(sp.from || sp.to ? { createdAt: { ...(sp.from ? { gte: new Date(sp.from) } : {}), ...(sp.to ? { lte: new Date(sp.to + "T23:59:59") } : {}) } } : {}),
    ...(sp.q
      ? {
          OR: [
            { number: { contains: sp.q, mode: "insensitive" } },
            { customerName: { contains: sp.q, mode: "insensitive" } },
            { customerPhone: { contains: sp.q.replace(/[^\d+]/g, "") || sp.q } },
            { items: { some: { OR: [{ sku: { contains: sp.q, mode: "insensitive" } }, { article: { contains: sp.q, mode: "insensitive" } }] } } },
          ],
        }
      : {}),
  };
  const take = 30;
  const [total, orders, counts] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take, include: { _count: { select: { items: true } } } }),
    prisma.order.groupBy({ by: ["status"], _count: true }),
  ]);
  const qs = (p: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...p })) if (v) u.set(k, v);
    return `/admin/orders?${u}`;
  };
  const exportQs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page") as [string, string][]).toString();

  return (
    <div>
      <PageHeader
        title="Заказы"
        actions={
          <>
            <a href={`/api/admin/export/orders?format=xlsx&${exportQs}`} className={adminBtnOutline}>Экспорт Excel</a>
            <a href={`/api/admin/export/orders?format=csv&${exportQs}`} className={adminBtnOutline}>CSV</a>
          </>
        }
      />
      <div className="flex flex-wrap gap-1.5 mb-4 text-[13px]">
        <Link href={qs({ status: undefined, page: undefined })} className={`px-3 h-8 flex items-center border ${!status ? "bg-ink text-white border-ink" : "bg-white border-line"}`}>Все</Link>
        {(Object.keys(orderStatusLabel) as OrderStatus[]).map((s) => (
          <Link key={s} href={qs({ status: s, page: undefined })} className={`px-3 h-8 flex items-center border ${status === s ? "bg-ink text-white border-ink" : "bg-white border-line"}`}>
            {orderStatusLabel[s]} <span className="ml-1.5 text-[11px] opacity-60">{counts.find((c) => c.status === s)?._count ?? 0}</span>
          </Link>
        ))}
      </div>
      <form className="flex flex-wrap gap-2 mb-4">
        {status && <input type="hidden" name="status" value={status} />}
        <input name="q" defaultValue={sp.q} placeholder="Номер, имя, телефон, артикул, SKU" className={`${adminInput} max-w-xs`} />
        <input type="date" name="from" defaultValue={sp.from} className={`${adminInput} w-40`} />
        <input type="date" name="to" defaultValue={sp.to} className={`${adminInput} w-40`} />
        <select name="demo" defaultValue={sp.demo ?? ""} className={`${adminInput} w-44`}>
          <option value="">Все заказы</option>
          <option value="0">Без тестовых</option>
        </select>
        <button className={adminBtn}>Найти</button>
      </form>
      <Table>
        <thead>
          <tr>
            <th>Номер</th>
            <th>Дата</th>
            <th>Покупатель</th>
            <th>Город</th>
            <th>Позиций</th>
            <th className="!text-right">Сумма</th>
            <th>Статус</th>
            <th>Оплата</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>
                <Link href={`/admin/orders/${o.id}`} className="font-medium underline-offset-2 hover:underline">{o.number}</Link>
                {o.isDemo && <span className="ml-1.5 text-[10px] text-danger">ТЕСТ</span>}
              </td>
              <td className="whitespace-nowrap">{formatDate(o.createdAt, "ru", true)}</td>
              <td>
                {o.customerName}
                <div className="text-ink-muted text-[12px]">{formatPhone(o.customerPhone)}</div>
              </td>
              <td>{o.city}</td>
              <td>{o._count.items}</td>
              <td className="text-right whitespace-nowrap">{formatPrice(o.total)}</td>
              <td><Badge tone={orderStatusTone[o.status]}>{orderStatusLabel[o.status]}</Badge></td>
              <td><Badge tone={o.paymentStatus === "PAID" ? "green" : "neutral"}>{paymentStatusLabel[o.paymentStatus]}</Badge></td>
            </tr>
          ))}
          {!orders.length && (
            <tr><td colSpan={8} className="text-center text-ink-muted py-10">Заказов не найдено</td></tr>
          )}
        </tbody>
      </Table>
      <Pager page={page} pages={Math.ceil(total / take)} href={(p) => qs({ page: String(p) })} />
    </div>
  );
}
