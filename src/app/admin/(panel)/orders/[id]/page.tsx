import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/admin-guard";
import { ORDER_TRANSITIONS } from "@/lib/orders";
import { formatDate, formatPhone, formatPrice } from "@/lib/format";
import { env } from "@/lib/env";
import { PageHeader, Card, Badge, adminInput, adminLabel } from "@/components/admin/ui";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { orderStatusLabel, orderStatusTone, paymentStatusLabel } from "@/lib/admin/labels";
import { saveManagerNoteAction, setOrderStatusAction, setPaymentStatusAction } from "../actions";

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireStaffPage("orders.view");
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, store: true, history: { orderBy: { createdAt: "desc" } }, user: { select: { id: true, email: true } } },
  });
  if (!order) notFound();
  const [delivery, payment, notifications] = await Promise.all([
    prisma.deliveryMethod.findUnique({ where: { code: order.deliveryMethod } }),
    prisma.paymentMethod.findUnique({ where: { code: order.paymentMethod } }),
    prisma.notificationLog.findMany({ where: { orderId: order.id }, orderBy: { createdAt: "desc" } }),
  ]);
  const next = ORDER_TRANSITIONS[order.status];
  const wa = `https://wa.me/${order.customerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(`Здравствуйте, ${order.customerName}! Это M-TREND, по вашему заказу ${order.number}.`)}`;

  return (
    <div>
      <PageHeader
        title={`Заказ ${order.number}`}
        description={
          <span className="flex flex-wrap gap-2 items-center">
            {formatDate(order.createdAt, "ru", true)} · <Badge tone={orderStatusTone[order.status]}>{orderStatusLabel[order.status]}</Badge>
            <Badge tone={order.paymentStatus === "PAID" ? "green" : "neutral"}>{paymentStatusLabel[order.paymentStatus]}</Badge>
            {order.isDemo && <Badge tone="red">ТЕСТОВЫЙ ЗАКАЗ (демо-товары)</Badge>}
            {order.exportedTo1CAt && <Badge tone="blue">Передан в 1С {formatDate(order.exportedTo1CAt, "ru", true)}</Badge>}
          </span>
        }
        actions={<Link href="/admin/orders" className="text-sm underline">← Все заказы</Link>}
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card title="Состав заказа">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-ink-muted">
                  <th className="font-normal pb-2">Товар</th>
                  <th className="font-normal pb-2">SKU</th>
                  <th className="font-normal pb-2">Цвет / размер</th>
                  <th className="font-normal pb-2">Склад</th>
                  <th className="font-normal pb-2 text-right">Цена × кол-во</th>
                  <th className="font-normal pb-2 text-right">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((i) => (
                  <tr key={i.id} className="border-t border-line align-top">
                    <td className="py-2.5">
                      {i.productId ? <Link href={`/admin/products/${i.productId}`} className="underline-offset-2 hover:underline">{i.nameRu}</Link> : i.nameRu}
                      <div className="text-ink-muted text-[12px]">арт. {i.article}</div>
                    </td>
                    <td className="py-2.5 font-mono text-[12px]">{i.sku}</td>
                    <td className="py-2.5">
                      {i.colorRu} · <b>{i.size}</b>
                      {i.height && <> · рост {i.height}</>}
                    </td>
                    <td className="py-2.5 text-[12px]">
                      {Array.isArray(i.allocations) && (i.allocations as { warehouseCode: string; quantity: number }[]).map((a) => `${a.warehouseCode}: ${a.quantity}`).join(", ")}
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      {formatPrice(i.price)} × {i.quantity}
                      {i.oldPrice && <div className="text-ink-muted line-through text-[11px]">{formatPrice(i.oldPrice)}</div>}
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap">{formatPrice(i.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-line mt-2 pt-3 text-[13px] space-y-1 max-w-xs ml-auto">
              <Row l="Товары" v={formatPrice(order.subtotal)} />
              {order.promoDiscount > 0 && <Row l={`Промокод ${order.promoCode}`} v={`−${formatPrice(order.promoDiscount)}`} />}
              <Row l="Доставка" v={delivery?.calcByManager ? "по тарифу (сообщить клиенту)" : formatPrice(order.deliveryCost)} />
              <Row l="Итого" v={formatPrice(order.total)} bold />
            </div>
          </Card>

          <Card title="История">
            <ul className="space-y-2 text-[13px]">
              {order.history.map((h) => (
                <li key={h.id} className="flex gap-3">
                  <span className="text-ink-muted whitespace-nowrap">{formatDate(h.createdAt, "ru", true)}</span>
                  <span>
                    <Badge tone={orderStatusTone[h.status]}>{orderStatusLabel[h.status]}</Badge> {h.note}
                    {h.userName && <span className="text-ink-muted"> — {h.userName}</span>}
                  </span>
                </li>
              ))}
            </ul>
            {notifications.length > 0 && (
              <>
                <div className="text-[11px] uppercase tracking-[0.1em] text-ink-muted mt-5 mb-2">Уведомления</div>
                <ul className="space-y-1 text-[12px]">
                  {notifications.map((n) => (
                    <li key={n.id}>
                      {formatDate(n.createdAt, "ru", true)} · {n.channel} → {n.recipient} · <Badge tone={n.status === "sent" ? "green" : n.status === "error" ? "red" : "neutral"}>{n.status}</Badge> {n.error && <span className="text-ink-muted">{n.error}</span>}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Покупатель">
            <div className="text-[13px] space-y-1">
              <div className="font-medium">{order.customerName}</div>
              <div><a href={`tel:${order.customerPhone}`} className="underline">{formatPhone(order.customerPhone)}</a></div>
              {order.customerEmail && <div>{order.customerEmail}</div>}
              <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-[#128C7E] underline">Написать в WhatsApp</a>
              {order.user && <div className="text-ink-muted text-[12px]">Зарегистрированный покупатель</div>}
            </div>
            <div className="mt-4 text-[13px] space-y-1">
              <div className="text-[11px] uppercase tracking-[0.1em] text-ink-muted">Доставка</div>
              <div>{delivery?.nameRu ?? order.deliveryMethod}</div>
              <div>{order.store ? `Самовывоз: ${order.store.city}, ${order.store.addressRu}` : `${order.city}, ${order.address ?? ""}`}</div>
              <div className="text-[11px] uppercase tracking-[0.1em] text-ink-muted pt-2">Оплата</div>
              <div>{payment?.nameRu ?? order.paymentMethod}</div>
              {order.comment && (
                <>
                  <div className="text-[11px] uppercase tracking-[0.1em] text-ink-muted pt-2">Комментарий покупателя</div>
                  <div className="whitespace-pre-line bg-milk p-2">{order.comment}</div>
                </>
              )}
              <div className="text-[11px] text-ink-muted pt-2">
                Ссылка для клиента: <span className="break-all">{env.appUrl}/{order.locale}/order/{order.number}?t={order.accessToken}</span>
              </div>
            </div>
          </Card>

          <Card title="Статус заказа">
            {next.length ? (
              <ActionForm action={setOrderStatusAction} className="space-y-3">
                <input type="hidden" name="id" value={order.id} />
                <select name="status" className={adminInput} defaultValue={next[0]}>
                  {next.map((s) => (
                    <option key={s} value={s}>{orderStatusLabel[s]}</option>
                  ))}
                </select>
                <input name="note" placeholder="Комментарий (необязательно)" className={adminInput} />
                <label className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" name="notify" defaultChecked={!!order.customerEmail} disabled={!order.customerEmail} className="accent-ink" /> Уведомить клиента по email
                </label>
                <SubmitButton>Изменить статус</SubmitButton>
                <p className="text-[11px] text-ink-muted">При отмене или возврате остатки автоматически возвращаются на склады (однократно).</p>
              </ActionForm>
            ) : (
              <p className="text-[13px] text-ink-muted">Финальный статус — изменение недоступно.</p>
            )}
          </Card>

          <Card title="Оплата">
            <ActionForm action={setPaymentStatusAction} className="space-y-3">
              <input type="hidden" name="id" value={order.id} />
              <select name="paymentStatus" defaultValue={order.paymentStatus} className={adminInput}>
                {Object.entries(paymentStatusLabel).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <label className="block">
                <span className={adminLabel}>Номер платежа / чека</span>
                <input name="paymentRef" defaultValue={order.paymentRef ?? ""} className={adminInput} />
              </label>
              <SubmitButton>Сохранить оплату</SubmitButton>
              <p className="text-[11px] text-ink-muted">Отмечайте «Оплачен» только после фактического поступления денег.</p>
            </ActionForm>
          </Card>

          <Card title="Заметка менеджера">
            <ActionForm action={saveManagerNoteAction} className="space-y-2">
              <input type="hidden" name="id" value={order.id} />
              <textarea name="managerNote" defaultValue={order.managerNote ?? ""} className={`${adminInput} h-24 py-2`} />
              <SubmitButton>Сохранить</SubmitButton>
            </ActionForm>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ l, v, bold }: { l: string; v: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${bold ? "font-semibold text-[15px] pt-1" : ""}`}>
      <span className={bold ? "" : "text-ink-muted"}>{l}</span>
      <span>{v}</span>
    </div>
  );
}
