import type { Locale } from "@/i18n/config";

export function formatPrice(value: number, locale: Locale = "ru"): string {
  const n = new Intl.NumberFormat(locale === "kz" ? "kk-KZ" : "ru-KZ", { maximumFractionDigits: 0 }).format(value);
  return `${n.replace(/ | /g, " ")} ₸`;
}

export function formatDate(value: Date | string, locale: Locale = "ru", withTime = false): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale === "kz" ? "kk-KZ" : "ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "Asia/Almaty",
  }).format(d);
}

export function discountPercent(price: number, oldPrice?: number | null): number {
  if (!oldPrice || oldPrice <= price) return 0;
  return Math.round(((oldPrice - price) / oldPrice) * 100);
}

/** Нормализация казахстанского номера в формат +7XXXXXXXXXX. Возвращает null, если номер некорректен. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  let d = digits;
  if (d.length === 11 && (d.startsWith("8") || d.startsWith("7"))) d = "7" + d.slice(1);
  else if (d.length === 10) d = "7" + d;
  else return null;
  if (!/^7[0-9]{10}$/.test(d)) return null;
  return "+" + d;
}

export function formatPhone(phone: string): string {
  const m = phone.match(/^\+7(\d{3})(\d{3})(\d{2})(\d{2})$/);
  return m ? `+7 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : phone;
}

const translitMap: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "",
  ы: "y", ь: "", э: "e", ю: "yu", я: "ya", ә: "a", ғ: "g", қ: "q", ң: "n", ө: "o", ұ: "u", ү: "u", һ: "h", і: "i",
};

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .split("")
    .map((ch) => translitMap[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const letterSizes = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "2XL", "3XL", "XXXL", "4XL", "5XL"];

export function compareSizes(a: string, b: string): number {
  const na = parseFloat(a.replace(",", "."));
  const nb = parseFloat(b.replace(",", "."));
  if (!isNaN(na) && !isNaN(nb)) return na - nb;
  const ia = letterSizes.indexOf(a.toUpperCase());
  const ib = letterSizes.indexOf(b.toUpperCase());
  if (ia !== -1 && ib !== -1) return ia - ib;
  return a.localeCompare(b);
}
