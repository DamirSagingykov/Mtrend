import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { timingSafeEqual } from "node:crypto";
import { CheckCircle2 } from "lucide-react";
import { getDictionary } from "@/i18n";
import { pick, type Locale } from "@/i18n/config";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, formatPhone, formatPrice } from "@/lib/format";
import { ProductImage } from "@/components/store/product-image";
import { RepeatOrderButton } from "@/components/store/repeat-order";

export const metadata: Metadata = { robots: { index: false, follow: false } };

type Props = { params: Promise<{ locale: Locale; number: string }>; searchParams: Promise<{ t?: string }> };

function safeEq(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export default async function OrderPage({ params, searchParams }: Props) {
  const { locale, number } = await params;
  const { t: token } = await searchParams;
  const t = getDictionary(locale);
  const order = await prisma.order.findUnique({
    where: { number },
    include: { items: true, store: true, history: { orderBy: { createdAt: "asc" } } },
  });
  // доступ: по секретной ссылке или владельцу аккаунта
  const user = await getCurrentUser();
  const allowed = !!order && ((token && safeEq(token, order.accessToken)) || (user && order.userId === user.id));
  if (!order || !allowed) notFound();

  const [delivery, payment] = await Promise.all([
    prisma.deliveryMethod.findUnique({ where: { code: order.deliveryMethod } }),
    prisma.paymentMethod.findUnique({ where: { code: order.paymentMethod } }),
  ]);
  const justCreated = Date.now() - order.createdAt.getTime() < 10 * 60_000;

  return (
    <div className="container max-w-3xl pt-10 md:pt-16">
      {justCreated && (
        <div className="text-center mb-10">
          <CheckCircle2 className="w-12 h-12 mx-auto text-success" strokeWidth={1.2} />
          <h1 className="font-display text-4xl md:text-5xl mt-4">{t.order.thanks}</h1>
          <p className="text-ink-muted mt-3 max-w-xl mx-auto">{t.order.nextSteps}</p>
        </div>
      )}
      <div className="border border-line">
        <div className="p-5 md:p-8 grid sm:grid-cols-3 gap-5 border-b border-line bg-milk">
          <div>
            <div className="eyebrow">{t.order.number}</div>
            <div className="text-xl mt-1 font-medium">{order.number}</div>
          </div>
          <div>
            <div className="eyebrow">{t.order.status}</div>
            <div className="mt-1">{t.orderStatus[order.status]}</div>
          </div>
          <div>
            <div className="eyebrow">{t.order.paymentStatus}</div>
            <div className="mt-1">{t.paymentStatus[order.paymentStatus]}</div>
          </div>
        </div>

        <div className="p-5 md:p-8">
          <div className="eyebrow mb-4">{t.order.composition}</div>
          <ul className="divide-y divide-line">
            {order.items.map((i) => (
              <li key={i.id} className="py-4 flex gap-4 text-sm">
                <div className="relative w-16 aspect-[3/4] bg-milk shrink-0">
                  {i.imageUrl && <ProductImage src={i.imageUrl} alt={i.nameRu} fill sizes="64px" className="object-cover" />}
                </div>
                <div className="flex-1">
                  <div>{pick(locale, i.nameRu, i.nameKz)}</div>
                  <div className="text-xs text-ink-muted mt-1">
                    {t.product.article} {i.article} · {pick(locale, i.colorRu, i.colorKz)} · {t.product.size} {i.size}
                    {i.height && ` · ${t.product.height} ${i.height}`}
                  </div>
                  <div className="text-xs text-ink-muted mt-0.5">{formatPrice(i.price, locale)} × {i.quantity}</div>
                </div>
                <div className="whitespace-nowrap">{formatPrice(i.total, locale)}</div>
              </li>
            ))}
          </ul>
          <div className="border-t border-line pt-4 mt-2 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-ink-muted">{t.cart.subtotal}</span><span>{formatPrice(order.subtotal, locale)}</span></div>
            {order.promoDiscount > 0 && (
              <div className="flex justify-between text-wood-dark"><span>{t.cart.promo} {order.promoCode}</span><span>−{formatPrice(order.promoDiscount, locale)}</span></div>
            )}
            <div className="flex justify-between"><span className="text-ink-muted">{t.cart.delivery}</span><span>{delivery?.calcByManager ? t.checkout.byTariff : order.deliveryCost ? formatPrice(order.deliveryCost, locale) : t.checkout.free}</span></div>
            <div className="flex justify-between text-lg pt-2"><span>{t.order.total}</span><span>{formatPrice(order.total, locale)}</span></div>
            {delivery?.calcByManager && <p className="text-xs text-ink-muted">{t.checkout.byTariffNote}</p>}
          </div>
        </div>

        <div className="p-5 md:p-8 grid sm:grid-cols-2 gap-6 border-t border-line text-sm">
          <div>
            <div className="eyebrow mb-2">{t.order.contact}</div>
            <div>{order.customerName}</div>
            <div className="text-ink-muted">{formatPhone(order.customerPhone)}</div>
            {order.customerEmail && <div className="text-ink-muted">{order.customerEmail}</div>}
          </div>
          <div>
            <div className="eyebrow mb-2">{t.order.delivery}</div>
            <div>{delivery ? pick(locale, delivery.nameRu, delivery.nameKz) : order.deliveryMethod}</div>
            <div className="text-ink-muted">
              {order.store ? `${order.store.city}, ${pick(locale, order.store.addressRu, order.store.addressKz)}` : `${order.city}, ${order.address ?? ""}`}
            </div>
            <div className="eyebrow mt-4 mb-2">{t.checkout.payment}</div>
            <div>{payment ? pick(locale, payment.nameRu, payment.nameKz) : order.paymentMethod}</div>
          </div>
        </div>
        <div className="px-5 md:px-8 pb-6 text-xs text-ink-muted">
          {t.order.createdAt}: {formatDate(order.createdAt, locale, true)}
        </div>
      </div>
      <p className="text-xs text-ink-muted mt-4">{t.order.saveLink}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href={`/${locale}/catalog`} className="btn-outline">{t.cart.continue}</Link>
        <RepeatOrderButton items={order.items.filter((i) => i.variantId).map((i) => ({ variantId: i.variantId!, quantity: i.quantity }))} />
      </div>
    </div>
  );
}
