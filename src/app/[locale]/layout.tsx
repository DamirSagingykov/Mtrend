import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale, locales, pick, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { getSettings } from "@/lib/settings";
import { getCategoryTree } from "@/lib/catalog";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";
import { StoreProviders } from "@/components/store/providers";
import { Header, type MenuCategory } from "@/components/store/header";
import { Footer } from "@/components/store/footer";
import { WhatsAppFloating } from "@/components/store/whatsapp-button";
import { AnalyticsScripts } from "@/components/store/analytics-scripts";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  const settings = await getSettings();
  return {
    ...buildMetadata({ locale, path: "", title: t.meta.defaultTitle, description: t.meta.defaultDescription }),
    title: { default: t.meta.defaultTitle, template: "%s — M-TREND" },
    verification: {
      google: settings.googleVerification || undefined,
      yandex: settings.yandexVerification || undefined,
    },
  };
}

export default async function StoreLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const t = getDictionary(locale);
  const [settings, categories, user, pages, demoCount] = await Promise.all([
    getSettings(),
    getCategoryTree(),
    getCurrentUser(),
    prisma.page.findMany({ where: { isActive: true, showInFooter: true }, orderBy: { sortOrder: "asc" }, select: { slug: true, titleRu: true, titleKz: true } }),
    prisma.product.count({ where: { isDemo: true, status: "ACTIVE" } }),
  ]);

  const top = categories.filter((c) => !c.parentId && c.slug !== "unsorted");
  const menu: MenuCategory[] = top.map((c) => ({
    slug: c.slug,
    name: pick(locale, c.nameRu, c.nameKz),
    children: categories.filter((s) => s.parentId === c.id).map((s) => ({ slug: s.slug, name: pick(locale, s.nameRu, s.nameKz) })),
  }));
  const topBarCustom = locale === "kz" ? settings.topBarKz : settings.topBarRu;
  const topBar = demoCount > 0 && settings.showDemoNotice !== "false" ? t.common.demoSite : topBarCustom;

  return (
    <StoreProviders locale={locale} t={t} settings={{ whatsapp: settings.whatsapp, phone: settings.phone }} isLoggedIn={!!user && user.role === "CUSTOMER"}>
      <Header categories={menu} topBar={topBar || undefined} />
      <main className="min-h-[60vh]">{children}</main>
      <Footer
        locale={locale}
        t={t}
        settings={settings}
        pages={pages.map((p) => ({ slug: p.slug, title: pick(locale, p.titleRu, p.titleKz) }))}
        categories={menu.map((m) => ({ slug: m.slug, name: m.name }))}
      />
      <WhatsAppFloating />
      <AnalyticsScripts ga4Id={settings.ga4Id} metaPixelId={settings.metaPixelId} yandexId={settings.yandexMetrikaId} />
    </StoreProviders>
  );
}
