import Link from "next/link";
import { getDictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { absoluteUrl, jsonLd } from "@/lib/seo";

export function Breadcrumbs({ locale, items }: { locale: Locale; items: { href: string; label: string }[] }) {
  const t = getDictionary(locale);
  const all = [{ href: `/${locale}`, label: t.nav.home }, ...items];
  const ld = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: all.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.label, item: absoluteUrl(c.href) })),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
      <nav aria-label="breadcrumbs" className="text-[11px] uppercase tracking-[0.14em] text-ink-muted overflow-x-auto no-scrollbar whitespace-nowrap">
        {all.map((c, i) => (
          <span key={c.href + i}>
            {i > 0 && <span className="mx-2">/</span>}
            {i === all.length - 1 ? <span className="text-ink">{c.label}</span> : <Link href={c.href} className="hover:text-ink">{c.label}</Link>}
          </span>
        ))}
      </nav>
    </>
  );
}
