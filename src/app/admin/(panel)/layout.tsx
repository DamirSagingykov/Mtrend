import { requireStaffPage } from "@/lib/admin-guard";
import { can, type Permission } from "@/lib/permissions";
import { AdminSidebar, type NavItem } from "@/components/admin/sidebar";
import { staffLogoutAction } from "../login/actions";

export const dynamic = "force-dynamic";

const NAV: (NavItem & { perm: Permission })[] = [
  { href: "/admin", label: "Dashboard", group: "Обзор", perm: "dashboard.view" },
  { href: "/admin/orders", label: "Заказы", group: "Продажи", perm: "orders.view" },
  { href: "/admin/promo", label: "Промокоды", group: "Продажи", perm: "marketing.edit" },
  { href: "/admin/subscribers", label: "Подписчики", group: "Продажи", perm: "marketing.edit" },
  { href: "/admin/products", label: "Товары", group: "Каталог", perm: "products.view" },
  { href: "/admin/stock", label: "Остатки", group: "Каталог", perm: "stock.edit" },
  { href: "/admin/categories", label: "Категории", group: "Каталог", perm: "catalog.edit" },
  { href: "/admin/colors", label: "Цвета", group: "Каталог", perm: "catalog.edit" },
  { href: "/admin/size-charts", label: "Таблицы размеров", group: "Каталог", perm: "catalog.edit" },
  { href: "/admin/import", label: "Импорт / экспорт", group: "Каталог", perm: "import.run" },
  { href: "/admin/banners", label: "Баннеры", group: "Контент", perm: "content.edit" },
  { href: "/admin/looks", label: "Готовые образы", group: "Контент", perm: "content.edit" },
  { href: "/admin/pages", label: "Страницы", group: "Контент", perm: "content.edit" },
  { href: "/admin/stores", label: "Магазины", group: "Контент", perm: "content.edit" },
  { href: "/admin/warehouses", label: "Склады", group: "Настройки", perm: "settings.edit" },
  { href: "/admin/delivery", label: "Доставка", group: "Настройки", perm: "settings.edit" },
  { href: "/admin/payments", label: "Оплата", group: "Настройки", perm: "settings.edit" },
  { href: "/admin/settings", label: "Настройки сайта", group: "Настройки", perm: "settings.edit" },
  { href: "/admin/staff", label: "Сотрудники", group: "Настройки", perm: "staff.manage" },
  { href: "/admin/integrations", label: "Интеграция 1С", group: "Настройки", perm: "logs.view" },
  { href: "/admin/logs", label: "Журналы", group: "Настройки", perm: "logs.view" },
];

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaffPage();
  const items = NAV.filter((n) => can(user.role, n.perm)).map(({ perm: _p, ...n }) => n);
  return (
    <div className="lg:pl-60">
      <AdminSidebar items={items} user={{ name: user.name, role: user.role }} />
      <div className="max-w-[1400px] mx-auto p-4 md:p-8">
        <div className="flex justify-end -mt-2 mb-2">
          <form action={staffLogoutAction}>
            <button className="text-xs text-ink-muted underline">Выйти</button>
          </form>
        </div>
        {children}
      </div>
    </div>
  );
}
