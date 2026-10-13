import type { Metadata } from "next";
import { getDictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { buildMetadata } from "@/lib/seo";
import { CheckoutView } from "@/components/store/checkout-view";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({ locale, path: "/checkout", title: getDictionary(locale).checkout.title, noindex: true });
}

export default function CheckoutPage() {
  return <CheckoutView />;
}
