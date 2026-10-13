import type { Metadata } from "next";
import { getDictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { buildMetadata } from "@/lib/seo";
import { getSettings } from "@/lib/settings";
import { getCategoryBySlug, getDescendantIds } from "@/lib/catalog";
import { CatalogView } from "@/components/store/catalog-view";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = getDictionary(locale);
  const sp = await searchParams;
  return buildMetadata({ locale, path: "/casual", title: t.nav.casual, description: t.meta.defaultDescription, noindex: Object.keys(sp).some((k) => k !== "sort") });
}

export default async function CasualPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const t = getDictionary(locale);
  const settings = await getSettings();
  const ids: string[] = [];
  const subs = [];
  for (const slug of settings.casualCategories.split(",").map((s) => s.trim()).filter(Boolean)) {
    const c = await getCategoryBySlug(slug);
    if (c) {
      subs.push(c);
      ids.push(...(await getDescendantIds(c.id)));
    }
  }
  return (
    <CatalogView
      locale={locale}
      searchParams={await searchParams}
      preset={{ categoryIds: ids.length ? ids : ["__none__"] }}
      title={t.nav.casual}
      subcategories={subs}
      basePath={`/${locale}/casual`}
    />
  );
}
