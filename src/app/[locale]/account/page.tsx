import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary } from "@/i18n";
import { pick, type Locale } from "@/i18n/config";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";
import { formatDate, formatPhone, formatPrice } from "@/lib/format";
import { AuthForms, ProfileForm, AddressForm } from "@/components/store/account-forms";
import { deleteAddressAction, logoutAction } from "./actions";
import { RepeatOrderButton } from "@/components/store/repeat-order";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({ locale, path: "/account", title: getDictionary(locale).account.title, noindex: true });
}

export default async function AccountPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = getDictionary(locale);
  const user = await getCurrentUser();

  if (!user || user.role !== "CUSTOMER") {
    return (
      <div className="container max-w-4xl pt-10 md:pt-16">
        <h1 className="font-display text-4xl md:text-5xl">{t.account.title}</h1>
        <p className="text-ink-muted mt-3">{t.account.benefits}</p>
        <AuthForms />
      </div>
    );
  }

  const [orders, addresses] = await Promise.all([
    prisma.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, include: { items: true }, take: 50 }),
    prisma.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] }),
  ]);

  return (
    <div className="container pt-10 md:pt-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl md:text-5xl">{t.account.title}</h1>
          <p className="text-ink-muted mt-2">{user.name} · {user.phone ? formatPhone(user.phone) : user.email}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/${locale}/favorites`} className="btn-ghost border border-line">{t.account.favorites}</Link>
          <form action={logoutAction}>
            <input type="hidden" name="locale" value={locale} />
            <button className="btn-ghost border border-line">{t.account.logout}</button>
          </form>
        </div>
      </div>

      <div className="mt-12 grid lg:grid-cols-[1fr_360px] gap-12">
        <section>
          <h2 className="eyebrow text-ink mb-4">{t.account.orders}</h2>
          {orders.length === 0 ? (
            <p className="text-ink-muted">{t.account.noOrders}</p>
          ) : (
            <ul className="space-y-3">
              {orders.map((o) => (
                <li key={o.id} className="border border-line p-5">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <Link href={`/${locale}/order/${o.number}`} className="font-medium hover:text-wood">{o.number}</Link>
                      <div className="text-xs text-ink-muted mt-1">{formatDate(o.createdAt, locale, true)}</div>
                    </div>
                    <div className="text-right">
                      <div>{formatPrice(o.total, locale)}</div>
                      <div className="text-xs mt-1">
                        <span className="bg-milk px-2 py-0.5">{t.orderStatus[o.status]}</span>{" "}
                        <span className="text-ink-muted">{t.paymentStatus[o.paymentStatus]}</span>
                      </div>
                    </div>
                  </div>
                  <ul className="mt-3 text-sm text-ink-muted space-y-0.5">
                    {o.items.map((i) => (
                      <li key={i.id}>
                        {pick(locale, i.nameRu, i.nameKz)} · {pick(locale, i.colorRu, i.colorKz)} · {i.size}{i.height && `/${i.height}`} × {i.quantity}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4">
                    <RepeatOrderButton items={o.items.filter((i) => i.variantId).map((i) => ({ variantId: i.variantId!, quantity: i.quantity }))} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="space-y-10">
          <section>
            <h2 className="eyebrow text-ink mb-4">{t.account.profile}</h2>
            <ProfileForm name={user.name} email={user.email ?? ""} phone={user.phone ? formatPhone(user.phone) : ""} />
          </section>
          <section>
            <h2 className="eyebrow text-ink mb-4">{t.account.addresses}</h2>
            <ul className="space-y-2 mb-4">
              {addresses.map((a) => (
                <li key={a.id} className="border border-line p-3 text-sm flex justify-between gap-3">
                  <div>
                    {a.label && <div className="font-medium">{a.label}</div>}
                    <div>{a.city}, {a.address}</div>
                    {a.isDefault && <div className="text-xs text-wood-dark mt-1">{t.account.default}</div>}
                  </div>
                  <form action={deleteAddressAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="locale" value={locale} />
                    <button className="text-xs underline text-ink-muted">{t.account.delete}</button>
                  </form>
                </li>
              ))}
            </ul>
            <AddressForm />
          </section>
        </aside>
      </div>
    </div>
  );
}
