import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n";
import { pick, type Locale } from "@/i18n/config";
import { buildMetadata } from "@/lib/seo";
import { getCategoryBySlug, getCategoryTree, getDescendantIds } from "@/lib/catalog";
import { CatalogView } from "@/components/store/catalog-view";

type Props = { params: Promise<{ locale: Locale; slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const sp = await searchParams;
  const c = await getCategoryBySlug(slug);
  if (!c) return {};
  const name = pick(locale, c.nameRu, c.nameKz);
  const t = getDictionary(locale);
  return buildMetadata({
    locale,
    path: `/catalog/${c.slug}`,
    title: pick(locale, c.seoTitleRu, c.seoTitleKz) || `${name} — ${locale === "kz" ? "сатып алу" : "купить в Казахстане"}`,
    description: pick(locale, c.seoDescRu, c.seoDescKz) || pick(locale, c.descriptionRu, c.descriptionKz) || t.meta.defaultDescription,
    image: c.imageUrl,
    noindex: Object.keys(sp).some((k) => k !== "sort"),
  });
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  const t = getDictionary(locale);
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();
  const all = await getCategoryTree();
  const crumbs: { href: string; label: string }[] = [{ href: `/${locale}/catalog`, label: t.catalog.title }];
  const chain = [];
  let parent = all.find((c) => c.id === category.parentId);
  while (parent) {
    chain.unshift(parent);
    const pid = parent.parentId;
    parent = all.find((c) => c.id === pid);
  }
  for (const p of chain) crumbs.push({ href: `/${locale}/catalog/${p.slug}`, label: pick(locale, p.nameRu, p.nameKz) });
  const children = all.filter((c) => c.parentId === category.id);
  const siblings = category.parentId ? all.filter((c) => c.parentId === category.parentId) : [];

  return (
    <CatalogView
      locale={locale}
      searchParams={await searchParams}
      preset={{ categoryIds: await getDescendantIds(category.id) }}
      title={pick(locale, category.nameRu, category.nameKz)}
      description={pick(locale, category.descriptionRu, category.descriptionKz)}
      crumbs={crumbs}
      subcategories={children.length ? children : siblings.filter((s) => s.id !== category.id)}
      basePath={`/${locale}/catalog/${category.slug}`}
    />
  );
}
