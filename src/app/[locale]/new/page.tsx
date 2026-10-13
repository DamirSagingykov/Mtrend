import type { Metadata } from "next";
import { getDictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { buildMetadata } from "@/lib/seo";
import { CatalogView } from "@/components/store/catalog-view";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = getDictionary(locale);
  const sp = await searchParams;
  return buildMetadata({ locale, path: "/new", title: t.nav.new, description: t.meta.defaultDescription, noindex: Object.keys(sp).some((k) => k !== "sort") });
}

export default async function Page({ params, searchParams }: Props) {
  const { locale } = await params;
  const t = getDictionary(locale);
  return <CatalogView locale={locale} searchParams={await searchParams} preset={{ isNew: true }} title={t.nav.new} basePath={`/${locale}/new`} />;
}
