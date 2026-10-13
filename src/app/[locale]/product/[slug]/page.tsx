import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { getDictionary } from "@/i18n";
import { pick, type Locale } from "@/i18n/config";
import { prisma } from "@/lib/db";
import { absoluteUrl, buildMetadata, jsonLd } from "@/lib/seo";
import { getCategoryTree, getProductCards } from "@/lib/catalog";
import { compareSizes } from "@/lib/format";
import { normalizeChartRows } from "@/lib/size-recommender";
import { getSettings } from "@/lib/settings";
import { Breadcrumbs } from "@/components/store/breadcrumbs";
import { ProductDetail, type DetailVariant } from "@/components/store/product-detail";
import { ProductRail } from "@/components/store/product-card";
import { SectionHeader } from "@/components/store/section";

type Props = { params: Promise<{ locale: Locale; slug: string }> };

async function load(slug: string) {
  return prisma.product.findFirst({
    where: { slug, status: "ACTIVE" },
    include: {
      category: true,
      sizeChart: true,
      images: { orderBy: { sortOrder: "asc" }, include: { color: { select: { code: true } } } },
      variants: {
        where: { isActive: true },
        include: {
          color: true,
          stocks: { where: { warehouse: { isActive: true } }, include: { warehouse: { select: { name: true, city: true } } } },
        },
      },
    },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const p = await load(slug);
  if (!p) return {};
  const name = pick(locale, p.nameRu, p.nameKz);
  const desc = pick(locale, p.seoDescRu, p.seoDescKz) || pick(locale, p.descriptionRu, p.descriptionKz)?.slice(0, 160) || name;
  return buildMetadata({
    locale,
    path: `/product/${p.slug}`,
    title: pick(locale, p.seoTitleRu, p.seoTitleKz) || `${name}, арт. ${p.article}`,
    description: desc,
    image: p.images[0]?.url,
    // демо-товары не индексируются
    noindex: p.isDemo,
  });
}

export default async function ProductPage({ params }: Props) {
  const { locale, slug } = await params;
  const t = getDictionary(locale);
  const p = await load(slug);
  if (!p) notFound();
  const settings = await getSettings();

  after(async () => {
    await prisma.product.update({ where: { id: p.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});
  });

  const cats = await getCategoryTree();
  const chain = [];
  let c = cats.find((x) => x.id === p.categoryId);
  while (c) {
    chain.unshift(c);
    const pid = c.parentId;
    c = cats.find((x) => x.id === pid);
  }
  const crumbs = [
    { href: `/${locale}/catalog`, label: t.catalog.title },
    ...chain.map((x) => ({ href: `/${locale}/catalog/${x.slug}`, label: pick(locale, x.nameRu, x.nameKz) })),
  ];
  const name = pick(locale, p.nameRu, p.nameKz);

  const variants: DetailVariant[] = p.variants
    .map((v) => ({
      id: v.id,
      sku: v.sku,
      colorCode: v.color.code,
      size: v.size,
      height: v.height,
      price: v.price,
      oldPrice: v.oldPrice && v.oldPrice > v.price ? v.oldPrice : null,
      stock: v.stocks.reduce((s, x) => s + Math.max(0, x.quantity), 0),
      byWarehouse: v.stocks.filter((s) => s.quantity > 0).map((s) => ({ name: s.warehouse.name, city: s.warehouse.city, qty: s.quantity })),
    }))
    .sort((a, b) => compareSizes(a.size, b.size) || (a.height ?? "").localeCompare(b.height ?? ""));

  const colorsMap = new Map<string, { code: string; name: string; hex: string }>();
  for (const v of p.variants) colorsMap.set(v.color.code, { code: v.color.code, name: pick(locale, v.color.nameRu, v.color.nameKz), hex: v.color.hex });

  const similar = await getProductCards({ categoryId: p.categoryId, id: { not: p.id } }, [{ salesCount: "desc" }, { createdAt: "desc" }], 12);

  const inStock = variants.some((v) => v.stock > 0);
  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    sku: p.article,
    mpn: p.article,
    brand: { "@type": "Brand", name: p.brand },
    description: pick(locale, p.descriptionRu, p.descriptionKz) || undefined,
    image: p.images.map((i) => absoluteUrl(i.url)),
    category: chain.map((x) => pick(locale, x.nameRu, x.nameKz)).join(" > "),
    material: pick(locale, p.compositionRu, p.compositionKz) || undefined,
    color: Array.from(colorsMap.values()).map((x) => x.name).join(", "),
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "KZT",
      lowPrice: p.minPrice,
      highPrice: p.maxPrice,
      offerCount: variants.length,
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: absoluteUrl(`/${locale}/product/${p.slug}`),
      seller: { "@type": "Organization", name: "M-TREND" },
    },
  };

  const chartRows = p.sizeChart ? normalizeChartRows(p.sizeChart.rows) : [];

  return (
    <div className="container pt-4 md:pt-8">
      {!p.isDemo && <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(productLd)} />}
      <Breadcrumbs locale={locale} items={[...crumbs, { href: `/${locale}/product/${p.slug}`, label: name }]} />
      <ProductDetail
        product={{
          id: p.id,
          article: p.article,
          brand: p.brand,
          name,
          isDemo: p.isDemo,
          isNew: p.isNew,
          hasHeights: p.hasHeights || variants.some((v) => v.height),
          fit: p.fit,
          season: p.season,
          description: pick(locale, p.descriptionRu, p.descriptionKz) || null,
          composition: pick(locale, p.compositionRu, p.compositionKz) || null,
          material: pick(locale, p.materialRu, p.materialKz) || null,
          care: pick(locale, p.careRu, p.careKz) || null,
          fitAdvice: pick(locale, p.fitAdviceRu, p.fitAdviceKz) || null,
          videoUrl: p.videoUrl,
          category: pick(locale, p.category.nameRu, p.category.nameKz),
        }}
        images={p.images.map((i) => ({ url: i.url, alt: pick(locale, i.altRu, i.altKz) || name, colorCode: i.color?.code ?? null }))}
        colors={Array.from(colorsMap.values())}
        variants={variants}
        sizeChart={
          p.sizeChart
            ? { rows: chartRows, notes: pick(locale, p.sizeChart.notesRu, p.sizeChart.notesKz) || null, isDemo: p.sizeChart.isDemo, kind: p.sizeChart.kind }
            : null
        }
        whatsapp={settings.whatsapp}
      />

      {similar.length > 0 && (
        <section className="mt-24">
          <SectionHeader title={t.product.similar} />
          <ProductRail items={similar} />
        </section>
      )}
    </div>
  );
}
