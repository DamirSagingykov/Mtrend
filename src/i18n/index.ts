import ru, { type Dictionary } from "./ru";
import kz from "./kz";
import type { Locale } from "./config";

const dictionaries: Record<Locale, Dictionary> = { ru, kz };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? ru;
}

export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export type { Dictionary };
