import type { Metadata } from "next";
import { env } from "./env";
import { hreflang, locales, ogLocale, type Locale } from "@/i18n/config";

type SeoInput = {
  locale: Locale;
  /** путь без префикса языка, начиная с / ("" для главной) */
  path: string;
  title: string;
  description?: string;
  image?: string | null;
  noindex?: boolean;
  type?: "website" | "article";
};

export function absoluteUrl(path: string) {
  if (/^https?:\/\//.test(path)) return path;
  return `${env.appUrl}${path.startsWith("/") ? "" : "/"}${path}`;
}

export function buildMetadata({ locale, path, title, description, image, noindex, type = "website" }: SeoInput): Metadata {
  const languages: Record<string, string> = {};
  for (const l of locales) languages[hreflang[l]] = absoluteUrl(`/${l}${path}`);
  languages["x-default"] = absoluteUrl(`/ru${path}`);
  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(`/${locale}${path}`), languages },
    openGraph: {
      type,
      siteName: "M-TREND",
      title,
      description,
      url: absoluteUrl(`/${locale}${path}`),
      locale: ogLocale[locale],
      alternateLocale: locales.filter((l) => l !== locale).map((l) => ogLocale[l]),
      images: image ? [{ url: absoluteUrl(image) }] : undefined,
    },
    twitter: { card: image ? "summary_large_image" : "summary", title, description },
    robots: noindex ? { index: false, follow: true } : undefined,
  };
}

/** Безопасная сериализация JSON-LD */
export function jsonLd(data: unknown) {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}
