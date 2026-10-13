import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary } from "@/i18n";
import { pick, type Locale } from "@/i18n/config";
import { prisma } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";
import { formatPrice } from "@/lib/format";
import { ProductImage } from "@/components/store/product-image";
import { Breadcrumbs } from "@/components/store/breadcrumbs";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({ locale, path: "/looks", title: getDictionary(locale).nav.looks });
}

export default async function LooksPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = getDictionary(locale);
  const looks = await prisma.look.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        include: { product: { select: { slug: true, nameRu: true, nameKz: true, minPrice: true, status: true, images: { take: 1, orderBy: { sortOrder: "asc" } } } } },
      },
    },
  });
  return (
    <div className="container pt-6 md:pt-10">
      <Breadcrumbs locale={locale} items={[{ href: `/${locale}/looks`, label: t.nav.looks }]} />
      <h1 className="font-display text-4xl md:text-6xl mt-4 mb-10">{t.nav.looks}</h1>
      <div className="space-y-20">
        {looks.map((look) => {
          const items = look.items.filter((i) => i.product.status === "ACTIVE");
          const total = items.reduce((s, i) => s + i.product.minPrice, 0);
          return (
            <section key={look.id} className="grid md:grid-cols-2 gap-8 md:gap-14 items-start">
              <div className="relative aspect-[4/5] bg-milk">
                <ProductImage src={look.imageUrl} alt={pick(locale, look.titleRu, look.titleKz)} fill sizes="(max-width:768px) 100vw, 50vw" className="object-cover" />
              </div>
              <div>
                <h2 className="h-section">{pick(locale, look.titleRu, look.titleKz)}</h2>
                <ul className="mt-6 divide-y divide-line border-y border-line">
                  {items.map((i) => (
                    <li key={i.productId}>
                      <Link href={`/${locale}/product/${i.product.slug}`} className="flex gap-4 py-4 group">
                        <div className="relative w-20 aspect-[3/4] bg-milk shrink-0">
                          {i.product.images[0] && <ProductImage src={i.product.images[0].url} alt="" fill sizes="80px" className="object-cover" />}
                        </div>
                        <div className="text-sm">
                          <div className="group-hover:text-wood">{pick(locale, i.product.nameRu, i.product.nameKz)}</div>
                          <div className="text-ink-muted mt-1">{formatPrice(i.product.minPrice, locale)}</div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
                {total > 0 && <p className="mt-4 text-sm text-ink-muted">≈ {formatPrice(total, locale)}</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
