import type { Metadata } from "next";
import { getDictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { buildMetadata } from "@/lib/seo";
import { CartView } from "@/components/store/cart-view";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({ locale, path: "/cart", title: getDictionary(locale).cart.title, noindex: true });
}

export default function CartPage() {
  return <CartView />;
}
