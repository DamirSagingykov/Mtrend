import type { Metadata } from "next";
import { getDictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { buildMetadata } from "@/lib/seo";
import { getCategoryTree } from "@/lib/catalog";
import { CatalogView } from "@/components/store/catalog-view";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const sp = await searchParams;
  const t = getDictionary(locale);
  const filtered = Object.keys(sp).some((k) => k !== "sort");
  return buildMetadata({ locale, path: "/catalog", title: t.catalog.title, description: t.meta.defaultDescription, noindex: filtered });
}

export default async function CatalogPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const t = getDictionary(locale);
  const cats = await getCategoryTree();
  return (
    <CatalogView
      locale={locale}
      searchParams={await searchParams}
      title={t.catalog.title}
      basePath={`/${locale}/catalog`}
      subcategories={cats.filter((c) => !c.parentId && c.slug !== "unsorted")}
    />
  );
}
