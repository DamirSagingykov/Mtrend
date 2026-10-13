import "server-only";
import { cache } from "react";
import { prisma } from "./db";

/** Настройки, редактируемые в админ-панели. Значения по умолчанию — пустые (заполняет администратор). */
export const settingKeys = {
  phone: { label: "Основной телефон", default: "" },
  whatsapp: { label: "WhatsApp (номер в формате 77XXXXXXXXX)", default: "" },
  email: { label: "Email для покупателей", default: "" },
  orderNotifyEmails: { label: "Email для уведомлений о заказах (через запятую)", default: "" },
  instagram: { label: "Instagram (ссылка)", default: "" },
  tiktok: { label: "TikTok (ссылка)", default: "" },
  facebook: { label: "Facebook (ссылка)", default: "" },
  telegram: { label: "Telegram (ссылка)", default: "" },
  workingHours: { label: "Часы работы колл-центра", default: "" },
  ga4Id: { label: "Google Analytics 4 Measurement ID (G-XXXX)", default: "" },
  metaPixelId: { label: "Meta Pixel ID", default: "" },
  yandexMetrikaId: { label: "Яндекс Метрика ID", default: "" },
  googleVerification: { label: "Google Search Console verification", default: "" },
  yandexVerification: { label: "Яндекс Вебмастер verification", default: "" },
  legalName: { label: "Юридическое наименование / ИП", default: "" },
  bin: { label: "БИН / ИИН", default: "" },
  deliveryCities: {
    label: "Города в форме оформления (через запятую)",
    default:
      "Астана,Алматы,Актобе,Шымкент,Караганда,Атырау,Актау,Павлодар,Усть-Каменогорск,Семей,Костанай,Кызылорда,Уральск,Петропавловск,Тараз,Туркестан,Кокшетау,Талдыкорган,Экибастуз,Жезказган",
  },
  casualCategories: {
    label: "Категории раздела «Повседневная одежда» (slug через запятую)",
    default: "trikotazh,futbolki,dzhinsy,rubashki-povsednevnye,verhnyaya-odezhda,sportivnaya-odezhda",
  },
  topBarRu: { label: "Текст верхней строки (RU)", default: "" },
  topBarKz: { label: "Текст верхней строки (KZ)", default: "" },
  showDemoNotice: { label: "Показывать плашку «тестовый режим» (true/false)", default: "true" },
} as const;

export type SettingKey = keyof typeof settingKeys;
export type Settings = Record<SettingKey, string>;

export const getSettings = cache(async (): Promise<Settings> => {
  const rows = await prisma.setting.findMany();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const result = {} as Settings;
  for (const key of Object.keys(settingKeys) as SettingKey[]) {
    result[key] = map[key] ?? settingKeys[key].default;
  }
  return result;
});

export function whatsappLink(number: string, text?: string): string | null {
  const digits = number.replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
