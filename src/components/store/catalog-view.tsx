import Link from "next/link";
import clsx from "clsx";
import { getDictionary } from "@/i18n";
import { pick, type Locale } from "@/i18n/config";
import { getCatalog, getFacets, parseFilters, type CatalogFilters } from "@/lib/catalog";
import { ProductGrid } from "./product-card";
import { CatalogToolbar, FiltersSidebar } from "./catalog-filters";
import { Breadcrumbs } from "./breadcrumbs";

type SP = Record<string, string | string[] | undefined>;

export async function CatalogView({
  locale,
  searchParams,
  preset = {},
  title,
  description,
  crumbs = [],
  subcategories = [],
  basePath,
}: {
  locale: Locale;
  searchParams: SP;
  preset?: Partial<CatalogFilters>;
  title: string;
  description?: string | null;
  crumbs?: { href: string; label: string }[];
  subcategories?: { slug: string; nameRu: string; nameKz: string }[];
  basePath: string;
}) {
  const t = getDictionary(locale);
  const filters = parseFilters(searchParams, preset);
  const [{ items, total, pages }, facets] = await Promise.all([getCatalog(filters), getFacets(filters)]);

  const pageHref = (page: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (k === "page" || v === undefined) continue;
      qs.set(k, Array.isArray(v) ? v.join(",") : v);
    }
    if (page > 1) qs.set("page", String(page));
    const s = qs.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  return (
    <div className="container pt-6 md:pt-10">
      <Breadcrumbs locale={locale} items={[...crumbs, { href: basePath, label: title }]} />
      <header className="mt-4 mb-6 md:mb-8">
        <h1 className="font-display text-4xl md:text-6xl font-medium">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-ink-muted">{description}</p>}
        <p className="mt-2 text-sm text-ink-muted lg:hidden">
          {total} {t.catalog.products}
        </p>
      </header>

      {subcategories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0 mb-6">
          {subcategories.map((s) => (
            <Link key={s.slug} href={`/${locale}/catalog/${s.slug}`} className="chip whitespace-nowrap shrink-0">
              {pick(locale, s.nameRu, s.nameKz)}
            </Link>
          ))}
        </div>
      )}

      <CatalogToolbar facets={facets} total={total} lockNew={!!preset.isNew} lockSale={!!preset.sale} />

      <div className="flex gap-10">
        <FiltersSidebar facets={facets} total={total} lockNew={!!preset.isNew} lockSale={!!preset.sale} />
        <div className="flex-1 min-w-0">
          {items.length ? (
            <ProductGrid items={items} priorityCount={4} />
          ) : (
            <div className="py-24 text-center text-ink-muted">{t.catalog.empty}</div>
          )}

          {pages > 1 && (
            <nav className="flex justify-center items-center gap-1 mt-14" aria-label={t.catalog.page}>
              {Array.from({ length: pages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === pages || Math.abs(p - filters.page) <= 2)
                .map((p, i, arr) => (
                  <span key={p} className="flex items-center">
                    {i > 0 && arr[i - 1] !== p - 1 && <span className="px-2 text-ink-muted">…</span>}
                    <Link
                      href={pageHref(p)}
                      className={clsx("w-10 h-10 flex items-center justify-center text-sm", p === filters.page ? "bg-ink text-white" : "hover:bg-milk")}
                      aria-current={p === filters.page ? "page" : undefined}
                    >
                      {p}
                    </Link>
                  </span>
                ))}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
