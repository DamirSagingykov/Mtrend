import type { Role } from "@prisma/client";

/**
 * Разграничение прав. ADMIN — полный доступ. MANAGER — работа с заказами, просмотр товаров и правка остатков.
 */
export const permissions = {
  "dashboard.view": ["ADMIN", "MANAGER"],
  "orders.view": ["ADMIN", "MANAGER"],
  "orders.edit": ["ADMIN", "MANAGER"],
  "orders.export": ["ADMIN", "MANAGER"],
  "products.view": ["ADMIN", "MANAGER"],
  "products.edit": ["ADMIN"],
  "stock.edit": ["ADMIN", "MANAGER"],
  "catalog.edit": ["ADMIN"], // категории, цвета, таблицы размеров
  "content.edit": ["ADMIN"], // баннеры, страницы, образы, магазины
  "marketing.edit": ["ADMIN"], // промокоды, подписчики
  "settings.edit": ["ADMIN"], // доставка, оплата, настройки, склады
  "staff.manage": ["ADMIN"],
  "import.run": ["ADMIN"],
  "logs.view": ["ADMIN"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof permissions;

export function can(role: Role | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return (permissions[permission] as readonly Role[]).includes(role);
}
