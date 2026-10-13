import Link from "next/link";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import type { Settings } from "@/lib/settings";
import { whatsappLink } from "@/lib/settings";
import { NewsletterForm } from "./newsletter-form";

export function Footer({
  locale,
  t,
  settings,
  pages,
  categories,
}: {
  locale: Locale;
  t: Dictionary;
  settings: Settings;
  pages: { slug: string; title: string }[];
  categories: { slug: string; name: string }[];
}) {
  const L = (p: string) => `/${locale}${p}`;
  const socials = [
    { label: "Instagram", href: settings.instagram },
    { label: "TikTok", href: settings.tiktok },
    { label: "Facebook", href: settings.facebook },
    { label: "Telegram", href: settings.telegram },
  ].filter((s) => s.href);
  const wa = whatsappLink(settings.whatsapp);
  return (
    <footer className="bg-milk mt-24 pb-16 md:pb-0">
      <div className="border-b border-line">
        <div className="container py-14 md:py-16 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="font-display text-3xl md:text-4xl">{t.newsletter.title}</h2>
            <p className="text-ink-muted mt-2">{t.newsletter.text}</p>
          </div>
          <NewsletterForm />
        </div>
      </div>
      <div className="container py-14 grid grid-cols-2 md:grid-cols-4 gap-10 text-sm">
        <div className="col-span-2 md:col-span-1">
          <div className="font-semibold tracking-[0.32em] text-xl">M‑TREND</div>
          <p className="text-ink-muted mt-4 leading-relaxed max-w-xs">{t.footer.about}</p>
        </div>
        <div>
          <div className="eyebrow mb-4">{t.nav.catalog}</div>
          <ul className="space-y-2.5">
            {categories.slice(0, 8).map((c) => (
              <li key={c.slug}>
                <Link href={L(`/catalog/${c.slug}`)} className="hover:text-wood">{c.name}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="eyebrow mb-4">{t.footer.customers}</div>
          <ul className="space-y-2.5">
            <li><Link href={L("/stores")} className="hover:text-wood">{t.nav.stores}</Link></li>
            {pages.map((p) => (
              <li key={p.slug}>
                <Link href={L(`/info/${p.slug}`)} className="hover:text-wood">{p.title}</Link>
              </li>
            ))}
            <li><Link href={L("/account")} className="hover:text-wood">{t.nav.account}</Link></li>
          </ul>
        </div>
        <div>
          <div className="eyebrow mb-4">{t.footer.contacts}</div>
          <ul className="space-y-2.5">
            {settings.phone && (
              <li><a href={`tel:${settings.phone.replace(/[^\d+]/g, "")}`} className="hover:text-wood">{settings.phone}</a></li>
            )}
            {settings.email && (
              <li><a href={`mailto:${settings.email}`} className="hover:text-wood">{settings.email}</a></li>
            )}
            {wa && (
              <li><a href={wa} target="_blank" rel="noopener noreferrer" className="hover:text-wood">{t.footer.whatsapp}</a></li>
            )}
            {settings.workingHours && <li className="text-ink-muted">{settings.workingHours}</li>}
          </ul>
          {socials.length > 0 && (
            <>
              <div className="eyebrow mt-6 mb-3">{t.footer.social}</div>
              <ul className="flex flex-wrap gap-x-4 gap-y-2">
                {socials.map((s) => (
                  <li key={s.label}>
                    <a href={s.href} target="_blank" rel="noopener noreferrer" className="hover:text-wood">{s.label}</a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
      <div className="border-t border-line">
        <div className="container py-6 text-xs text-ink-muted flex flex-col md:flex-row gap-2 justify-between">
          <span>© {new Date().getFullYear()} M‑TREND. {t.footer.rights}</span>
          {(settings.legalName || settings.bin) && (
            <span>
              {settings.legalName}
              {settings.bin && ` · БИН/ИИН ${settings.bin}`}
            </span>
          )}
        </div>
      </div>
    </footer>
  );
}
