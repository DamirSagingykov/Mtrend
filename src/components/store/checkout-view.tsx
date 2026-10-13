"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Check, Store as StoreIcon, Truck, Package } from "lucide-react";
import { useCart, useI18n } from "./providers";
import { useQuote, promoErrors } from "./use-quote";
import { ProductImage } from "./product-image";
import { formatPrice, normalizePhone } from "@/lib/format";
import { fmt } from "@/i18n";
import { pick } from "@/i18n/config";
import { analytics } from "@/lib/analytics";

type Options = {
  cities: string[];
  delivery: {
    code: string;
    type: "COURIER" | "PICKUP" | "POST";
    nameRu: string;
    nameKz: string;
    descRu: string | null;
    descKz: string | null;
    price: number;
    freeFrom: number | null;
    calcByManager: boolean;
    cities: string[];
    etaRu: string | null;
    etaKz: string | null;
  }[];
  payment: { code: string; nameRu: string; nameKz: string; descRu: string | null; descKz: string | null }[];
  stores: { id: string; city: string; nameRu: string; nameKz: string; addressRu: string; addressKz: string; hoursRu: string | null; hoursKz: string | null }[];
};

type Me = { name: string; phone: string | null; email: string | null; addresses: { city: string; address: string; isDefault: boolean }[] } | null;

const KEY = "mt_checkout_key";

function newKey() {
  const a = new Uint8Array(18);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function CheckoutView() {
  const { t, locale, isLoggedIn } = useI18n();
  const cart = useCart();
  const router = useRouter();
  const [options, setOptions] = useState<Options | null>(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: "", phone: "", email: "", city: "", otherCity: "", address: "", delivery: "", storeId: "", payment: "", comment: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [agree, setAgree] = useState(true);

  const city = form.city === "__other" ? form.otherCity.trim() : form.city;
  const { quote, loading } = useQuote(cart.items, { promoCode: cart.promoCode, deliveryCode: form.delivery || null, city, enabled: cart.ready });

  useEffect(() => {
    fetch("/api/checkout/options")
      .then((r) => r.json())
      .then((o: Options) => {
        setOptions(o);
        if (o.payment.length === 1) setForm((f) => ({ ...f, payment: o.payment[0].code }));
      })
      .catch(() => setSubmitError(t.common.error));
    if (isLoggedIn) {
      fetch("/api/account/me")
        .then((r) => (r.ok ? r.json() : null))
        .then((me: Me) => {
          if (!me) return;
          const addr = me.addresses.find((a) => a.isDefault) ?? me.addresses[0];
          setForm((f) => ({
            ...f,
            name: f.name || me.name,
            phone: f.phone || me.phone || "",
            email: f.email || me.email || "",
            city: f.city || addr?.city || "",
            address: f.address || addr?.address || "",
          }));
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (quote && quote.lines.length) {
      analytics.beginCheckout(
        quote.total,
        quote.lines.map((l) => ({ item_id: l.article, item_name: l.nameRu, price: l.price, quantity: l.quantity, item_variant: l.sku })),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!quote]);

  const deliveryOptions = useMemo(
    () => (options?.delivery ?? []).filter((d) => !d.cities.length || (city && d.cities.some((c) => c.toLowerCase() === city.toLowerCase()))),
    [options, city],
  );
  const selectedDelivery = deliveryOptions.find((d) => d.code === form.delivery) ?? null;
  const pickupStores = (options?.stores ?? []).filter((s) => !city || s.city.toLowerCase() === city.toLowerCase());
  const storesForPickup = pickupStores.length ? pickupStores : options?.stores ?? [];

  useEffect(() => {
    if (form.delivery && !deliveryOptions.some((d) => d.code === form.delivery)) setForm((f) => ({ ...f, delivery: "", storeId: "" }));
  }, [deliveryOptions, form.delivery]);

  const set = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  const validate1 = () => {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 2) e.name = t.checkout.required;
    if (!normalizePhone(form.phone)) e.phone = t.checkout.invalidPhone;
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = t.checkout.invalidEmail;
    setErrors(e);
    return !Object.keys(e).length;
  };
  const validate2 = () => {
    const e: Record<string, string> = {};
    if (!city) e.city = t.checkout.required;
    if (!form.delivery) e.delivery = t.checkout.required;
    if (selectedDelivery?.type === "PICKUP" && !form.storeId) e.storeId = t.checkout.required;
    if (selectedDelivery && selectedDelivery.type !== "PICKUP" && form.address.trim().length < 5) e.address = t.checkout.required;
    setErrors(e);
    return !Object.keys(e).length;
  };

  const submit = async () => {
    if (!validate1()) return setStep(1);
    if (!validate2()) return setStep(2);
    if (!form.payment) return setErrors({ payment: t.checkout.required });
    setSubmitting(true);
    setSubmitError(null);
    let key = sessionStorage.getItem(KEY);
    if (!key) {
      key = newKey();
      sessionStorage.setItem(KEY, key);
    }
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: key,
          items: cart.items,
          customerName: form.name.trim(),
          customerPhone: form.phone,
          customerEmail: form.email.trim(),
          city,
          address: selectedDelivery?.type === "PICKUP" ? undefined : form.address.trim(),
          deliveryCode: form.delivery,
          storeId: selectedDelivery?.type === "PICKUP" ? form.storeId : null,
          paymentCode: form.payment,
          promoCode: cart.promoCode,
          comment: form.comment.trim() || undefined,
          locale,
          consent: agree,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        analytics.orderCreated(
          data.number,
          data.total,
          (quote?.lines ?? []).map((l) => ({ item_id: l.article, item_name: l.nameRu, price: l.price, quantity: l.quantity, item_variant: l.sku })),
        );
        sessionStorage.removeItem(KEY);
        cart.clear();
        router.push(`/${locale}/order/${data.number}?t=${data.token}`);
        return;
      }
      if (data.error === "stock") {
        setSubmitError(t.checkout.stockError);
        if (data.quote?.lines) {
          cart.replace(data.quote.lines.filter((l: { available: number }) => l.available > 0).map((l: { variantId: string; quantity: number; available: number }) => ({ variantId: l.variantId, quantity: Math.min(l.quantity || l.available, l.available) })));
        }
      } else if (data.error === "promo") {
        setSubmitError(promoErrors[data.details]?.[locale] ?? promoErrors.not_found[locale]);
      } else {
        setSubmitError(t.checkout.errorGeneric);
      }
    } catch {
      setSubmitError(t.checkout.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  };

  if (cart.ready && !cart.items.length) {
    return (
      <div className="container py-24 text-center">
        <h1 className="font-display text-4xl">{t.cart.empty}</h1>
        <Link href={`/${locale}/catalog`} className="btn-primary mt-8">{t.cart.goCatalog}</Link>
      </div>
    );
  }

  const steps = [t.checkout.step1, t.checkout.step2, t.checkout.step3];

  return (
    <div className="container pt-8 md:pt-12">
      <h1 className="font-display text-4xl md:text-5xl">{t.checkout.title}</h1>
      <p className="text-sm text-ink-muted mt-2">{t.checkout.noRegistration}</p>

      <div className="mt-8 grid lg:grid-cols-[1fr_400px] gap-10 lg:gap-14 items-start">
        <div className="space-y-3">
          {steps.map((title, i) => {
            const n = i + 1;
            const open = step === n;
            const done = step > n;
            return (
              <section key={n} className={clsx("border", open ? "border-ink" : "border-line")}>
                <button
                  type="button"
                  className="w-full flex items-center gap-4 px-5 h-16 text-left"
                  onClick={() => {
                    if (n < step) setStep(n);
                    else if (n === 2 && validate1()) setStep(2);
                    else if (n === 3 && validate1() && validate2()) setStep(3);
                  }}
                >
                  <span className={clsx("w-7 h-7 rounded-full flex items-center justify-center text-xs border", done ? "bg-ink text-white border-ink" : open ? "border-ink" : "border-line text-ink-muted")}>
                    {done ? <Check className="w-3.5 h-3.5" /> : n}
                  </span>
                  <span className="uppercase text-[13px] tracking-[0.14em]">{title}</span>
                  {done && (
                    <span className="ml-auto text-xs text-ink-muted truncate max-w-[45%]">
                      {n === 1 ? `${form.name}, ${form.phone}` : `${city}${selectedDelivery ? " · " + pick(locale, selectedDelivery.nameRu, selectedDelivery.nameKz) : ""}`}
                    </span>
                  )}
                </button>

                {open && n === 1 && (
                  <div className="px-5 pb-6 grid sm:grid-cols-2 gap-4 animate-fade-in">
                    <Field label={t.checkout.name} error={errors.name} className="sm:col-span-2">
                      <input className="input" autoComplete="name" value={form.name} onChange={(e) => set("name", e.target.value)} />
                    </Field>
                    <Field label={t.checkout.phone} error={errors.phone}>
                      <input className="input" type="tel" inputMode="tel" autoComplete="tel" placeholder="+7 7__ ___ __ __" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                    </Field>
                    <Field label={t.checkout.email} error={errors.email}>
                      <input className="input" type="email" autoComplete="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
                    </Field>
                    <button type="button" className="btn-primary sm:col-span-2" onClick={() => validate1() && setStep(2)}>
                      {t.checkout.next}
                    </button>
                  </div>
                )}

                {open && n === 2 && (
                  <div className="px-5 pb-6 space-y-5 animate-fade-in">
                    <Field label={t.checkout.city} error={errors.city}>
                      <select className="input" value={form.city} onChange={(e) => set("city", e.target.value)}>
                        <option value="">{t.checkout.cityPlaceholder}</option>
                        {options?.cities.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                        <option value="__other">{t.checkout.otherCity}</option>
                      </select>
                    </Field>
                    {form.city === "__other" && (
                      <input className="input" placeholder={t.checkout.otherCity} value={form.otherCity} onChange={(e) => set("otherCity", e.target.value)} />
                    )}

                    {city && (
                      <fieldset>
                        <legend className="label">{t.checkout.method}</legend>
                        <div className="space-y-2">
                          {deliveryOptions.map((d) => {
                            const Icon = d.type === "PICKUP" ? StoreIcon : d.type === "POST" ? Package : Truck;
                            const cost = d.calcByManager ? -1 : d.freeFrom !== null && quote && quote.subtotal - (quote.promo && !quote.promo.error ? quote.promo.discount : 0) >= d.freeFrom ? 0 : d.price;
                            return (
                              <label key={d.code} className={clsx("flex gap-3 p-4 border cursor-pointer", form.delivery === d.code ? "border-ink" : "border-line")}>
                                <input type="radio" name="delivery" className="sr-only" checked={form.delivery === d.code} onChange={() => set("delivery", d.code)} />
                                <Icon className="w-5 h-5 mt-0.5 shrink-0 text-wood" strokeWidth={1.4} />
                                <span className="flex-1 text-sm">
                                  <span className="flex justify-between gap-3">
                                    <span className="font-medium">{pick(locale, d.nameRu, d.nameKz)}</span>
                                    <span>{cost < 0 ? t.checkout.byTariff : cost === 0 ? t.checkout.free : formatPrice(cost, locale)}</span>
                                  </span>
                                  {pick(locale, d.descRu, d.descKz) && <span className="block text-ink-muted text-xs mt-1">{pick(locale, d.descRu, d.descKz)}</span>}
                                  <span className="block text-ink-muted text-xs mt-1">
                                    {pick(locale, d.etaRu, d.etaKz)}
                                    {d.freeFrom !== null && !d.calcByManager && cost > 0 && ` · ${fmt(t.checkout.freeFrom, { sum: formatPrice(d.freeFrom, locale) })}`}
                                  </span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                        {errors.delivery && <p className="text-xs text-danger mt-1">{errors.delivery}</p>}
                      </fieldset>
                    )}

                    {selectedDelivery?.type === "PICKUP" && (
                      <fieldset>
                        <legend className="label">{t.checkout.pickupStore}</legend>
                        <div className="space-y-2">
                          {storesForPickup.map((s) => (
                            <label key={s.id} className={clsx("block p-4 border cursor-pointer text-sm", form.storeId === s.id ? "border-ink" : "border-line")}>
                              <input type="radio" name="store" className="sr-only" checked={form.storeId === s.id} onChange={() => set("storeId", s.id)} />
                              <span className="font-medium">{s.city}, {pick(locale, s.nameRu, s.nameKz)}</span>
                              <span className="block text-ink-muted text-xs mt-1">
                                {pick(locale, s.addressRu, s.addressKz)}
                                {pick(locale, s.hoursRu, s.hoursKz) && ` · ${pick(locale, s.hoursRu, s.hoursKz)}`}
                              </span>
                            </label>
                          ))}
                        </div>
                        {errors.storeId && <p className="text-xs text-danger mt-1">{errors.storeId}</p>}
                      </fieldset>
                    )}

                    {selectedDelivery && selectedDelivery.type !== "PICKUP" && (
                      <Field label={t.checkout.address} error={errors.address}>
                        <input className="input" autoComplete="street-address" placeholder={t.checkout.addressPlaceholder} value={form.address} onChange={(e) => set("address", e.target.value)} />
                      </Field>
                    )}
                    <Field label={t.checkout.comment}>
                      <textarea className="input h-24 py-3" maxLength={1000} value={form.comment} onChange={(e) => set("comment", e.target.value)} />
                    </Field>
                    <div className="flex gap-2">
                      <button type="button" className="btn-outline" onClick={() => setStep(1)}>{t.checkout.back}</button>
                      <button type="button" className="btn-primary flex-1" onClick={() => validate2() && setStep(3)}>{t.checkout.next}</button>
                    </div>
                  </div>
                )}

                {open && n === 3 && (
                  <div className="px-5 pb-6 space-y-4 animate-fade-in">
                    {options && !options.payment.length && <p className="text-sm text-danger">{t.checkout.noPaymentMethods}</p>}
                    <div className="space-y-2">
                      {options?.payment.map((p) => (
                        <label key={p.code} className={clsx("block p-4 border cursor-pointer text-sm", form.payment === p.code ? "border-ink" : "border-line")}>
                          <input type="radio" name="payment" className="sr-only" checked={form.payment === p.code} onChange={() => set("payment", p.code)} />
                          <span className="font-medium flex items-center gap-2">
                            <span className={clsx("w-4 h-4 rounded-full border flex items-center justify-center", form.payment === p.code ? "border-ink" : "border-line")}>
                              {form.payment === p.code && <span className="w-2 h-2 rounded-full bg-ink" />}
                            </span>
                            {pick(locale, p.nameRu, p.nameKz)}
                          </span>
                          {pick(locale, p.descRu, p.descKz) && <span className="block text-ink-muted text-xs mt-1.5 pl-6">{pick(locale, p.descRu, p.descKz)}</span>}
                        </label>
                      ))}
                    </div>
                    {errors.payment && <p className="text-xs text-danger">{errors.payment}</p>}
                    <label className="flex gap-3 text-xs text-ink-muted items-start">
                      <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 accent-ink" />
                      {t.checkout.agree}
                    </label>
                    <button type="button" className="btn-primary w-full" disabled={submitting || !agree || !quote || quote.hasIssues || !options?.payment.length} onClick={submit}>
                      {submitting ? t.checkout.placing : `${t.checkout.placeOrder}${quote ? " · " + formatPrice(quote.total, locale) : ""}`}
                    </button>
                    {submitError && <p className="text-sm text-danger" role="alert">{submitError}</p>}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <aside className="bg-milk p-6 md:p-8 lg:sticky lg:top-24">
          <div className="uppercase text-[12px] tracking-[0.14em] mb-4">{t.checkout.yourOrder}</div>
          {quote?.hasDemo && <p className="text-xs text-danger mb-4">{t.checkout.demoWarning}</p>}
          <ul className="space-y-4 max-h-[340px] overflow-y-auto pr-1">
            {quote?.lines.map((l) => (
              <li key={l.variantId} className="flex gap-3 text-sm">
                <div className="relative w-14 aspect-[3/4] bg-white shrink-0">
                  {l.imageUrl && <ProductImage src={l.imageUrl} alt={l.nameRu} fill sizes="56px" className="object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="line-clamp-2 leading-snug">{pick(locale, l.nameRu, l.nameKz)}</div>
                  <div className="text-xs text-ink-muted mt-1">
                    {pick(locale, l.colorRu, l.colorKz)} · {l.size}{l.height && `/${l.height}`} · × {l.quantity}
                  </div>
                  {l.issue && <div className="text-xs text-danger mt-1">{t.cart.unavailable}</div>}
                </div>
                <div className="text-right whitespace-nowrap">{formatPrice(l.lineTotal, locale)}</div>
              </li>
            ))}
          </ul>
          <div className="mt-6 pt-5 border-t border-line space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-ink-muted">{t.cart.subtotal}</span><span>{quote ? formatPrice(quote.subtotal, locale) : "…"}</span></div>
            {quote?.promo && !quote.promo.error && (
              <div className="flex justify-between text-wood-dark"><span>{t.cart.promo} {quote.promo.code}</span><span>−{formatPrice(quote.promo.discount, locale)}</span></div>
            )}
            <div className="flex justify-between">
              <span className="text-ink-muted">{t.cart.delivery}</span>
              <span>{quote?.delivery ? (quote.delivery.calcByManager ? t.checkout.byTariff : quote.delivery.cost ? formatPrice(quote.delivery.cost, locale) : t.checkout.free) : "—"}</span>
            </div>
          </div>
          <div className="flex justify-between items-baseline mt-5 pt-5 border-t border-line">
            <span className="uppercase text-[12px] tracking-[0.14em]">{t.cart.total}</span>
            <span className={clsx("text-2xl", loading && "opacity-50")}>{quote ? formatPrice(quote.total, locale) : "…"}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, error, children, className }: { label: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={clsx("block", className)}>
      <span className="label">{label}</span>
      {children}
      {error && <span className="block text-xs text-danger mt-1">{error}</span>}
    </label>
  );
}
