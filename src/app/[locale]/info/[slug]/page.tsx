import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pick, type Locale } from "@/i18n/config";
import { prisma } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";
import { renderMarkdown } from "@/lib/markdown";
import { Breadcrumbs } from "@/components/store/breadcrumbs";

type Props = { params: Promise<{ locale: Locale; slug: string }> };

async function load(slug: string) {
  return prisma.page.findFirst({ where: { slug, isActive: true } });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const p = await load(slug);
  if (!p) return {};
  const content = pick(locale, p.contentRu, p.contentKz).replace(/[#*\-\[\]()]/g, "").slice(0, 160);
  return buildMetadata({ locale, path: `/info/${p.slug}`, title: pick(locale, p.titleRu, p.titleKz), description: content });
}

export default async function InfoPage({ params }: Props) {
  const { locale, slug } = await params;
  const p = await load(slug);
  if (!p) notFound();
  const title = pick(locale, p.titleRu, p.titleKz);
  return (
    <div className="container max-w-3xl pt-6 md:pt-10">
      <Breadcrumbs locale={locale} items={[{ href: `/${locale}/info/${p.slug}`, label: title }]} />
      <h1 className="font-display text-4xl md:text-5xl mt-4 mb-8">{title}</h1>
      <div className="prose-mt" dangerouslySetInnerHTML={{ __html: renderMarkdown(pick(locale, p.contentRu, p.contentKz)) }} />
    </div>
  );
}
