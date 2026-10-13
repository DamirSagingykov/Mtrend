import type { Metadata } from "next";
import { MapPin, Clock, Phone, Navigation } from "lucide-react";
import { getDictionary } from "@/i18n";
import { pick, type Locale } from "@/i18n/config";
import { prisma } from "@/lib/db";
import { buildMetadata, jsonLd, absoluteUrl } from "@/lib/seo";
import { Breadcrumbs } from "@/components/store/breadcrumbs";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = getDictionary(locale);
  return buildMetadata({ locale, path: "/stores", title: t.stores.title, description: t.stores.intro });
}

export default async function StoresPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = getDictionary(locale);
  const stores = await prisma.store.findMany({ where: { isActive: true }, orderBy: [{ city: "asc" }, { sortOrder: "asc" }] });
  const cities = Array.from(new Set(stores.map((s) => s.city)));
  const ld = stores.map((s) => ({
    "@context": "https://schema.org",
    "@type": "ClothingStore",
    name: `M-TREND — ${pick(locale, s.nameRu, s.nameKz)}`,
    url: absoluteUrl(`/${locale}/stores`),
    telephone: s.phone || undefined,
    address: { "@type": "PostalAddress", addressLocality: s.city, streetAddress: pick(locale, s.addressRu, s.addressKz), addressCountry: "KZ" },
    geo: s.latitude && s.longitude ? { "@type": "GeoCoordinates", latitude: s.latitude, longitude: s.longitude } : undefined,
    openingHours: pick(locale, s.hoursRu, s.hoursKz) || undefined,
  }));

  return (
    <div className="container pt-6 md:pt-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
      <Breadcrumbs locale={locale} items={[{ href: `/${locale}/stores`, label: t.stores.title }]} />
      <h1 className="font-display text-4xl md:text-6xl mt-4">{t.stores.title}</h1>
      <p className="text-ink-muted mt-3 max-w-xl">{t.stores.intro}</p>

      {cities.map((city) => (
        <section key={city} className="mt-14">
          <h2 className="h-section mb-6">{city}</h2>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
            {stores
              .filter((s) => s.city === city)
              .map((s) => (
                <article key={s.id} className="border border-line flex flex-col">
                  {s.mapEmbedUrl && /^https:\/\//.test(s.mapEmbedUrl) ? (
                    <iframe src={s.mapEmbedUrl} className="w-full aspect-[16/10] border-0 bg-milk" loading="lazy" title={pick(locale, s.nameRu, s.nameKz)} referrerPolicy="no-referrer-when-downgrade" />
                  ) : (
                    <div className="aspect-[16/10] bg-milk flex items-center justify-center">
                      <MapPin className="w-8 h-8 text-sand-dark" strokeWidth={1} />
                    </div>
                  )}
                  <div className="p-5 flex-1 flex flex-col text-sm">
                    <h3 className="font-display text-2xl">{pick(locale, s.nameRu, s.nameKz)}</h3>
                    <p className="mt-2 flex gap-2"><MapPin className="w-4 h-4 mt-0.5 text-wood shrink-0" strokeWidth={1.5} />{pick(locale, s.addressRu, s.addressKz)}</p>
                    {pick(locale, s.hoursRu, s.hoursKz) && (
                      <p className="mt-2 flex gap-2 text-ink-muted"><Clock className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={1.5} />{pick(locale, s.hoursRu, s.hoursKz)}</p>
                    )}
                    {s.phone && (
                      <p className="mt-2 flex gap-2"><Phone className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={1.5} /><a href={`tel:${s.phone.replace(/[^\d+]/g, "")}`} className="hover:text-wood">{s.phone}</a></p>
                    )}
                    {s.isPickup && <p className="mt-3 text-xs uppercase tracking-[0.14em] text-wood-dark">{t.stores.pickup}</p>}
                    {s.mapUrl && /^https:\/\//.test(s.mapUrl) && (
                      <a href={s.mapUrl} target="_blank" rel="noopener noreferrer" className="btn-outline h-11 mt-5 self-start">
                        <Navigation className="w-4 h-4" /> {t.stores.route}
                      </a>
                    )}
                  </div>
                </article>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
