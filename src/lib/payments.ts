import { env } from "./env";

/**
 * Реестр платёжных провайдеров.
 *
 * ВАЖНО: сайт НЕ имитирует онлайн-оплату. Провайдер считается доступным только если:
 *  1) он реализован (implemented = true) и
 *  2) для него заданы реальные учётные данные (configured()).
 *
 * «manual» — оплата после подтверждения менеджером (наличными, картой в магазине, Kaspi-счётом и т.д.).
 * Статус «Оплачен» в этом случае ставит менеджер вручную после фактического поступления денег.
 *
 * «kaspi» — заготовка под официальный API Kaspi Pay (требуется договор с Kaspi.kz и документация партнёра).
 * Пока провайдер не реализован, способ оплаты нельзя показать покупателю.
 */
export type PaymentProvider = {
  code: string;
  title: string;
  implemented: boolean;
  online: boolean;
  configured: () => boolean;
  notes: string;
};

export const paymentProviders: Record<string, PaymentProvider> = {
  manual: {
    code: "manual",
    title: "Оплата после подтверждения менеджером",
    implemented: true,
    online: false,
    configured: () => true,
    notes: "Менеджер связывается с покупателем, подтверждает заказ и выставляет счёт / принимает оплату. Статус оплаты меняется вручную в админ-панели.",
  },
  cash: {
    code: "cash",
    title: "Наличными / картой при получении",
    implemented: true,
    online: false,
    configured: () => true,
    notes: "Оплата при самовывозе в магазине или курьеру (если курьерская служба принимает оплату).",
  },
  kaspi: {
    code: "kaspi",
    title: "Kaspi Pay (онлайн, API)",
    implemented: false,
    online: true,
    configured: () => !!(env.kaspi.merchantId && env.kaspi.apiKey),
    notes:
      "Требуется договор с Kaspi.kz и доступ к партнёрскому API. После получения документации реализуйте адаптер в src/lib/payments.ts (createPayment + webhook /api/payments/kaspi/callback).",
  },
  card_gateway: {
    code: "card_gateway",
    title: "Банковский эквайринг (Halyk ePay, Freedom Pay, CloudPayments и др.)",
    implemented: false,
    online: true,
    configured: () => false,
    notes: "Заготовка под интеграцию с официальным платёжным шлюзом банка. Требуются договор и ключи API.",
  },
};

export function isProviderUsable(provider: string): boolean {
  const p = paymentProviders[provider];
  return !!p && p.implemented && p.configured();
}
