import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { absoluteUrl } from "@/lib/seo";
import { hreflang, locales } from "@/i18n/config";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

function entry(path: string, lastModified?: Date, priority = 0.5): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(locales.map((l) => [hreflang[l], absoluteUrl(`/${l}${path}`)]));
  return locales.map((l) => ({ url: absoluteUrl(`/${l}${path}`), lastModified, priority, alternates: { languages } }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products, pages] = await Promise.all([
    prisma.category.findMany({ where: { isActive: true, slug: { not: "unsorted" } }, select: { slug: true, updatedAt: true } }),
    // демо-товары в sitemap не попадают
    prisma.product.findMany({ where: { status: "ACTIVE", isDemo: false }, select: { slug: true, updatedAt: true } }),
    prisma.page.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } }),
  ]);
  return [
    ...entry("", undefined, 1),
    ...entry("/catalog", undefined, 0.9),
    ...entry("/new", undefined, 0.8),
    ...entry("/sale", undefined, 0.8),
    ...entry("/casual", undefined, 0.7),
    ...entry("/stores", undefined, 0.6),
    ...entry("/looks", undefined, 0.5),
    ...categories.flatMap((c) => entry(`/catalog/${c.slug}`, c.updatedAt, 0.8)),
    ...products.flatMap((p) => entry(`/product/${p.slug}`, p.updatedAt, 0.7)),
    ...pages.flatMap((p) => entry(`/info/${p.slug}`, p.updatedAt, 0.3)),
  ];
}
