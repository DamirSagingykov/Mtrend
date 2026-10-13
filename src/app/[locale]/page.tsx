import Link from "next/link";
import { Truck, Store as StoreIcon, Ruler, RotateCcw, MapPin, Clock } from "lucide-react";
import { getDictionary } from "@/i18n";
import { pick, type Locale } from "@/i18n/config";
import { prisma } from "@/lib/db";
import { getCategoryBySlug, getDescendantIds, getProductCards, getCategoryTree } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";
import { HeroSlider } from "@/components/store/hero-slider";
import { ProductRail } from "@/components/store/product-card";
import { SectionHeader } from "@/components/store/section";
import { ProductImage } from "@/components/store/product-image";
import { jsonLd, absoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

async function idsFor(slugs: string[]) {
  const ids: string[] = [];
  for (const slug of slugs) {
    const c = await getCategoryBySlug(slug);
    if (c) ids.push(...(await getDescendantIds(c.id)));
  }
  return ids;
}

export default async function HomePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = getDictionary(locale);
  const L = (p: string) => `/${locale}${p}`;
  const settings = await getSettings();

  const [banners, categories, suitIds, shoeIds, casualIds, looks, stores] = await Promise.all([
    prisma.banner.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    getCategoryTree(),
    idsFor(["kostyumy"]),
    idsFor(["obuv"]),
    idsFor(settings.casualCategories.split(",").map((s) => s.trim()).filter(Boolean)),
    prisma.look.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      take: 3,
      include: { items: { orderBy: { sortOrder: "asc" }, include: { product: { select: { slug: true, nameRu: true, nameKz: true, minPrice: true, status: true } } } } },
    }),
    prisma.store.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }] }),
  ]);

  const [newItems, hits, suits, casual, shoes, sale] = await Promise.all([
    getProductCards({ isNew: true }, [{ createdAt: "desc" }], 12),
    getProductCards({ OR: [{ isBestseller: true }, { salesCount: { gt: 0 } }] }, [{ salesCount: "desc" }, { isBestseller: "desc" }], 12),
    getProductCards({ categoryId: { in: suitIds } }, [{ salesCount: "desc" }, { createdAt: "desc" }], 12),
    getProductCards({ categoryId: { in: casualIds } }, [{ createdAt: "desc" }], 12),
    getProductCards({ categoryId: { in: shoeIds } }, [{ createdAt: "desc" }], 12),
    getProductCards({ maxDiscountPercent: { gt: 0 } }, [{ maxDiscountPercent: "desc" }], 12),
  ]);

  const homeCategories = categories.filter((c) => c.showOnHome).slice(0, 8);
  const slides = banners.length
    ? banners.map((b) => ({
        id: b.id,
        title: pick(locale, b.titleRu, b.titleKz),
        subtitle: pick(locale, b.subtitleRu, b.subtitleKz) || null,
        button: pick(locale, b.buttonRu, b.buttonKz) || null,
        link: b.link ? (b.link.startsWith("/") && !b.link.startsWith(`/${locale}`) ? L(b.link) : b.link) : null,
        image: b.imageUrl,
        mobileImage: b.mobileImageUrl,
        dark: b.textColor === "dark",
      }))
    : [{ id: "default", title: t.home.heroTitle, button: t.home.heroButton, link: L("/catalog"), image: "/demo/hero.svg", dark: false }];

  const advIcons = [Truck, StoreIcon, Ruler, RotateCcw];
  const storesByCity = stores.reduce<Record<string, typeof stores>>((acc, s) => {
    (acc[s.city] ||= []).push(s);
    return acc;
  }, {});

  const orgLd = {
    "@context": "https://schema.org",
    "@type": "ClothingStore",
    name: "M-TREND",
    url: absoluteUrl(`/${locale}`),
    telephone: settings.phone || undefined,
    address: stores.map((s) => ({ "@type": "PostalAddress", addressLocality: s.city, streetAddress: pick(locale, s.addressRu, s.addressKz), addressCountry: "KZ" })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(orgLd)} />
      <HeroSlider slides={slides} />

      {homeCategories.length > 0 && (
        <section className="container mt-16 md:mt-24">
          <SectionHeader title={t.home.popularCategories} href={L("/catalog")} linkLabel={t.home.viewAll} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
            {homeCategories.map((c, i) => (
              <Link
                key={c.id}
                href={L(`/catalog/${c.slug}`)}
                className={`group relative overflow-hidden bg-milk ${i === 0 ? "md:col-span-2 md:row-span-2 aspect-[3/4] md:aspect-auto" : "aspect-[3/4]"}`}
              >
                {c.imageUrl && (
                  <ProductImage src={c.imageUrl} alt={pick(locale, c.nameRu, c.nameKz)} fill sizes="(max-width:768px) 50vw, 25vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                <span className="absolute left-4 bottom-4 md:left-6 md:bottom-6 text-white font-display text-2xl md:text-3xl">{pick(locale, c.nameRu, c.nameKz)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {newItems.length > 0 && (
        <section className="container mt-20 md:mt-28">
          <SectionHeader title={t.home.newArrivals} href={L("/new")} linkLabel={t.home.viewAll} />
          <ProductRail items={newItems} />
        </section>
      )}

      {hits.length > 0 && (
        <section className="container mt-20 md:mt-28">
          <SectionHeader title={t.home.bestsellers} href={L("/catalog?sort=popular")} linkLabel={t.home.viewAll} />
          <ProductRail items={hits} />
        </section>
      )}

      {suits.length > 0 && (
        <section className="mt-20 md:mt-28 bg-milk py-16 md:py-24">
          <div className="container">
            <SectionHeader eyebrow="Business · Classic" title={t.home.suits} href={L("/catalog/kostyumy")} linkLabel={t.home.viewAll} />
            <ProductRail items={suits} />
          </div>
        </section>
      )}

      {casual.length > 0 && (
        <section className="container mt-20 md:mt-28">
          <SectionHeader eyebrow="Smart casual" title={t.home.casual} href={L("/casual")} linkLabel={t.home.viewAll} />
          <ProductRail items={casual} />
        </section>
      )}

      {shoes.length > 0 && (
        <section className="container mt-20 md:mt-28">
          <SectionHeader title={t.home.shoes} href={L("/catalog/obuv")} linkLabel={t.home.viewAll} />
          <ProductRail items={shoes} />
        </section>
      )}

      {sale.length > 0 && (
        <section className="container mt-20 md:mt-28">
          <SectionHeader eyebrow="Sale" title={t.home.sale} href={L("/sale")} linkLabel={t.home.viewAll} />
          <ProductRail items={sale} />
        </section>
      )}

      {looks.length > 0 && (
        <section className="container mt-20 md:mt-28">
          <SectionHeader title={t.home.looks} href={L("/looks")} linkLabel={t.home.viewAll} />
          <div className="grid md:grid-cols-3 gap-5">
            {looks.map((look) => (
              <div key={look.id} className="group">
                <div className="relative aspect-[4/5] bg-milk overflow-hidden">
                  <ProductImage src={look.imageUrl} alt={pick(locale, look.titleRu, look.titleKz)} fill sizes="(max-width:768px) 100vw, 33vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
                </div>
                <h3 className="font-display text-2xl mt-4">{pick(locale, look.titleRu, look.titleKz)}</h3>
                <ul className="mt-2 space-y-1 text-sm text-ink-muted">
                  {look.items
                    .filter((i) => i.product.status === "ACTIVE")
                    .map((i) => (
                      <li key={i.productId}>
                        <Link href={L(`/product/${i.product.slug}`)} className="hover:text-ink underline-offset-4 hover:underline">
                          {pick(locale, i.product.nameRu, i.product.nameKz)}
                        </Link>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="container mt-20 md:mt-28">
        <SectionHeader title={t.home.advantages} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line">
          {t.home.adv.map((a, i) => {
            const Icon = advIcons[i];
            return (
              <div key={a.title} className="bg-white p-6 md:p-8">
                <Icon className="w-7 h-7 text-wood" strokeWidth={1.2} />
                <h3 className="mt-5 text-sm md:text-base font-medium">{a.title}</h3>
                <p className="mt-2 text-xs md:text-sm text-ink-muted leading-relaxed">{a.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      {stores.length > 0 && (
        <section className="container mt-20 md:mt-28">
          <SectionHeader title={t.home.stores} href={L("/stores")} linkLabel={t.home.viewAll} />
          <div className="grid md:grid-cols-2 gap-10">
            {Object.entries(storesByCity).map(([city, list]) => (
              <div key={city}>
                <div className="font-display text-3xl mb-4">{city}</div>
                <ul className="divide-y divide-line border-y border-line">
                  {list.map((s) => (
                    <li key={s.id} className="py-4 flex gap-3">
                      <MapPin className="w-4 h-4 mt-1 text-wood shrink-0" strokeWidth={1.5} />
                      <div className="text-sm">
                        <div className="font-medium">{pick(locale, s.nameRu, s.nameKz)}</div>
                        <div className="text-ink-muted">{pick(locale, s.addressRu, s.addressKz)}</div>
                        {pick(locale, s.hoursRu, s.hoursKz) && (
                          <div className="text-ink-muted flex items-center gap-1.5 mt-1">
                            <Clock className="w-3.5 h-3.5" /> {pick(locale, s.hoursRu, s.hoursKz)}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
