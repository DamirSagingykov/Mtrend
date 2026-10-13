import type { Metadata } from "next";
import { getDictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { buildMetadata } from "@/lib/seo";
import { FavoritesView } from "@/components/store/favorites-view";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({ locale, path: "/favorites", title: getDictionary(locale).favorites.title, noindex: true });
}

export default function FavoritesPage() {
  return <FavoritesView />;
}
