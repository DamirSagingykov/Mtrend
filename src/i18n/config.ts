export const locales = ["ru", "kz"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ru";

/** BCP-47 коды для <html lang> и hreflang */
export const htmlLang: Record<Locale, string> = { ru: "ru", kz: "kk" };
export const hreflang: Record<Locale, string> = { ru: "ru-KZ", kz: "kk-KZ" };
export const ogLocale: Record<Locale, string> = { ru: "ru_KZ", kz: "kk_KZ" };

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

/** Выбор локализованного значения из полей БД (nameRu / nameKz) с откатом на русский */
export function pick(locale: Locale, ru: string | null | undefined, kz: string | null | undefined): string {
  if (locale === "kz" && kz && kz.trim()) return kz;
  return ru ?? kz ?? "";
}
