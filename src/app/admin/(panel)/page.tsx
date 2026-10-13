import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/admin-guard";
import { formatDate, formatPrice } from "@/lib/format";
import { PageHeader, Card, Badge } from "@/components/admin/ui";
import { orderStatusLabel, orderStatusTone } from "@/lib/admin/labels";

export const dynamic = "force-dynamic";

const COUNTED = { notIn: ["CANCELLED", "RETURNED"] as ("CANCELLED" | "RETURNED")[] };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ days?: string; forbidden?: string; demo?: string }> }) {
  await requireStaffPage("dashboard.view");
  const sp = await searchParams;
  const days = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const includeDemo = sp.demo === "1";
  const since = new Date(Date.now() - days * 86400_000);
  const base = { createdAt: { gte: since }, status: COUNTED, ...(includeDemo ? {} : { isDemo: false }) };

  const [agg, newCount, pendingCount, byCity, topItems, recent, daily, lowStock] = await Promise.all([
    prisma.order.aggregate({ where: base, _sum: { total: true }, _count: true, _avg: { total: true } }),
    prisma.order.count({ where: { status: "NEW", ...(includeDemo ? {} : { isDemo: false }) } }),
    prisma.order.count({ where: { status: { in: ["PENDING_CONFIRMATION", "CONFIRMED", "ASSEMBLING"] }, ...(includeDemo ? {} : { isDemo: false }) } }),
    prisma.order.groupBy({ by: ["city"], where: base, _count: true, _sum: { total: true }, orderBy: { _sum: { total: "desc" } }, take: 8 }),
    prisma.orderItem.groupBy({
      by: ["article", "nameRu"],
      where: { order: base },
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 8,
    }),
    prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.$queryRaw<{ day: Date; total: bigint; cnt: bigint }[]>`
      SELECT date_trunc('day', "createdAt" AT TIME ZONE 'Asia/Almaty') AS day, SUM(total)::bigint AS total, COUNT(*)::bigint AS cnt
      FROM "Order"
      WHERE "createdAt" >= ${since} AND status NOT IN ('CANCELLED','RETURNED') AND (${includeDemo} OR "isDemo" = false)
      GROUP BY 1 ORDER BY 1`,
    prisma.productVariant.count({ where: { isActive: true, product: { status: "ACTIVE" }, stocks: { every: { quantity: { lte: 0 } } } } }),
  ]);

  // Заполняем пропущенные дни нулями
  const series: { day: string; total: number; cnt: number }[] = [];
  const map = new Map(daily.map((d) => [new Date(d.day).toISOString().slice(0, 10), d]));
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() + 5 * 3600_000 - i * 86400_000).toISOString().slice(0, 10);
    const row = map.get(d);
    series.push({ day: d, total: Number(row?.total ?? 0), cnt: Number(row?.cnt ?? 0) });
  }
  const max = Math.max(1, ...series.map((s) => s.total));
  const cityMax = Math.max(1, ...byCity.map((c) => c._sum.total ?? 0));

  return (
    <div>
      <PageHeader
        title="Dashboard"
        actions={
          <div className="flex gap-1 text-[13px]">
            {[7, 30, 90].map((d) => (
              <Link key={d} href={`/admin?days=${d}${includeDemo ? "&demo=1" : ""}`} className={`px-3 h-9 flex items-center border ${d === days ? "bg-ink text-white border-ink" : "bg-white border-line"}`}>
                {d} дн.
              </Link>
            ))}
            <Link href={`/admin?days=${days}${includeDemo ? "" : "&demo=1"}`} className="px-3 h-9 flex items-center border bg-white border-line">
              {includeDemo ? "Без тестовых" : "С тестовыми"}
            </Link>
          </div>
        }
      />
      {sp.forbidden && <p className="mb-4 text-sm text-danger">Недостаточно прав для этого раздела.</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Kpi label={`Заказов за ${days} дн.`} value={String(agg._count)} />
        <Kpi label="Сумма заказов" value={formatPrice(agg._sum.total ?? 0)} hint="без отменённых и возвратов" />
        <Kpi label="Средний чек" value={formatPrice(Math.round(agg._avg.total ?? 0))} />
        <Kpi label="Новые / в работе" value={`${newCount} / ${pendingCount}`} href="/admin/orders?status=NEW" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Динамика заказов, ₸ в день" className="lg:col-span-2">
          <svg viewBox={`0 0 ${series.length * 10} 120`} className="w-full h-48" preserveAspectRatio="none" role="img" aria-label="Сумма заказов по дням">
            <line x1="0" y1="110" x2={series.length * 10} y2="110" stroke="#e6e0d8" strokeWidth="0.5" />
            {series.map((s, i) => {
              const h = (s.total / max) * 100;
              return (
                <g key={s.day}>
                  <rect x={i * 10} y="0" width="10" height="110" fill="transparent">
                    <title>{`${s.day}: ${formatPrice(s.total)}, заказов: ${s.cnt}`}</title>
                  </rect>
                  {s.total > 0 && (
                    <rect x={i * 10 + 1} y={110 - h} width="8" height={h} rx="1" fill="#2b2b2b" pointerEvents="none" />
                  )}
                </g>
              );
            })}
          </svg>
          <div className="flex justify-between text-[11px] text-ink-muted mt-1">
            <span>{series[0]?.day}</span>
            <span>макс. {formatPrice(max)}</span>
            <span>{series.at(-1)?.day}</span>
          </div>
        </Card>

        <Card title="Заказы по городам">
          {byCity.length ? (
            <ul className="space-y-3">
              {byCity.map((c) => (
                <li key={c.city} className="text-[13px]">
                  <div className="flex justify-between">
                    <span>{c.city}</span>
                    <span className="text-ink-muted">{c._count} · {formatPrice(c._sum.total ?? 0)}</span>
                  </div>
                  <div className="h-1.5 bg-milk mt-1">
                    <div className="h-full bg-ink-soft" style={{ width: `${((c._sum.total ?? 0) / cityMax) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-muted text-sm">Нет данных за период</p>
          )}
        </Card>

        <Card title="Популярные товары" className="lg:col-span-2">
          {topItems.length ? (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-ink-muted text-left">
                  <th className="font-normal pb-2">Артикул</th>
                  <th className="font-normal pb-2">Товар</th>
                  <th className="font-normal pb-2 text-right">Шт.</th>
                  <th className="font-normal pb-2 text-right">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {topItems.map((t) => (
                  <tr key={t.article + t.nameRu} className="border-t border-line">
                    <td className="py-2">{t.article}</td>
                    <td className="py-2">{t.nameRu}</td>
                    <td className="py-2 text-right">{t._sum.quantity}</td>
                    <td className="py-2 text-right">{formatPrice(t._sum.total ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-ink-muted text-sm">Нет продаж за период</p>
          )}
        </Card>

        <Card title="Последние заказы">
          <ul className="space-y-2.5 text-[13px]">
            {recent.map((o) => (
              <li key={o.id} className="flex justify-between gap-2">
                <Link href={`/admin/orders/${o.id}`} className="underline-offset-2 hover:underline">
                  {o.number}
                  {o.isDemo && <span className="text-danger text-[10px] ml-1">ТЕСТ</span>}
                  <div className="text-[11px] text-ink-muted">{formatDate(o.createdAt, "ru", true)} · {o.city}</div>
                </Link>
                <div className="text-right">
                  <div>{formatPrice(o.total)}</div>
                  <Badge tone={orderStatusTone[o.status]}>{orderStatusLabel[o.status]}</Badge>
                </div>
              </li>
            ))}
            {!recent.length && <li className="text-ink-muted">Заказов пока нет</li>}
          </ul>
        </Card>
      </div>
      {lowStock > 0 && (
        <p className="mt-4 text-sm">
          <Link href="/admin/stock?filter=zero" className="underline">Вариантов без остатка: {lowStock}</Link>
        </p>
      )}
    </div>
  );
}

function Kpi({ label, value, hint, href }: { label: string; value: string; hint?: string; href?: string }) {
  const body = (
    <div className="bg-white border border-line p-4 h-full">
      <div className="text-[11px] uppercase tracking-[0.1em] text-ink-muted">{label}</div>
      <div className="text-2xl mt-1.5">{value}</div>
      {hint && <div className="text-[11px] text-ink-muted mt-1">{hint}</div>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
