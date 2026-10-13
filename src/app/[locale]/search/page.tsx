import type { Metadata } from "next";
import { getDictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { buildMetadata } from "@/lib/seo";
import { CatalogView } from "@/components/store/catalog-view";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = getDictionary(locale);
  return buildMetadata({ locale, path: "/search", title: t.search.title, noindex: true });
}

export default async function SearchPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = getDictionary(locale);
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim() ?? "";
  return (
    <CatalogView
      locale={locale}
      searchParams={sp}
      title={q ? `${t.search.title}: «${q.slice(0, 60)}»` : t.search.title}
      basePath={`/${locale}/search`}
    />
  );
}
