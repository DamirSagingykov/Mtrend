import "server-only";
import type { Permission } from "../permissions";
import { prisma } from "../db";

/**
 * Декларативное описание простых справочников админ-панели.
 * Один универсальный CRUD (EntityManager + saveEntityAction) обслуживает все сущности ниже.
 */
export type FieldType =
  | "text"
  | "textarea"
  | "markdown"
  | "int"
  | "money"
  | "float"
  | "checkbox"
  | "select"
  | "image"
  | "datetime"
  | "list"
  | "color";

export type Field = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  help?: string;
  /** статичные варианты для select */
  options?: { value: string; label: string }[];
  /** динамические варианты для select */
  optionsLoader?: () => Promise<{ value: string; label: string }[]>;
  nullable?: boolean;
  /** ширина в сетке формы */
  wide?: boolean;
  uppercase?: boolean;
};

export type EntityConfig = {
  key: string;
  model: "warehouse" | "store" | "banner" | "promoCode" | "deliveryMethod" | "paymentMethod" | "page" | "color" | "category" | "look";
  title: string;
  singular: string;
  description?: string;
  permission: Permission;
  orderBy: Record<string, "asc" | "desc">[];
  columns: { name: string; label: string; type?: FieldType }[];
  fields: Field[];
  deletable?: boolean;
  /** проверка перед удалением — вернуть текст ошибки, если удалять нельзя */
  beforeDelete?: (id: string) => Promise<string | null>;
};

const warehouseOptions = async () =>
  (await prisma.warehouse.findMany({ orderBy: { priority: "asc" } })).map((w) => ({ value: w.id, label: `${w.code} — ${w.name}` }));

const categoryOptions = async () => {
  const all = await prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }] });
  const out: { value: string; label: string }[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const c of all.filter((x) => x.parentId === parentId)) {
      out.push({ value: c.id, label: `${"— ".repeat(depth)}${c.nameRu}` });
      walk(c.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
};

export const entities: Record<string, EntityConfig> = {
  warehouses: {
    key: "warehouses",
    model: "warehouse",
    title: "Склады",
    singular: "склад",
    description: "Остатки учитываются отдельно по каждому складу. Код склада используется при импорте и обмене с 1С (например AST, AKT). Приоритет определяет порядок списания при доставке.",
    permission: "settings.edit",
    orderBy: [{ priority: "asc" }],
    columns: [
      { name: "code", label: "Код" },
      { name: "name", label: "Название" },
      { name: "city", label: "Город" },
      { name: "priority", label: "Приоритет" },
      { name: "isActive", label: "Активен", type: "checkbox" },
    ],
    fields: [
      { name: "code", label: "Код склада (как в 1С)", type: "text", required: true, uppercase: true },
      { name: "name", label: "Название", type: "text", required: true },
      { name: "city", label: "Город", type: "text", required: true },
      { name: "address", label: "Адрес", type: "text", nullable: true, wide: true },
      { name: "priority", label: "Приоритет списания (0 — первый)", type: "int" },
      { name: "isActive", label: "Активен (остатки учитываются на сайте)", type: "checkbox" },
    ],
    deletable: true,
    beforeDelete: async (id) => {
      const n = await prisma.stock.count({ where: { warehouseId: id, quantity: { gt: 0 } } });
      return n ? `На складе есть остатки (${n} SKU). Деактивируйте склад вместо удаления.` : null;
    },
  },
  stores: {
    key: "stores",
    model: "store",
    title: "Магазины",
    singular: "магазин",
    description: "Физические магазины для раздела «Наши магазины» и пунктов самовывоза.",
    permission: "content.edit",
    orderBy: [{ city: "asc" }, { sortOrder: "asc" }],
    columns: [
      { name: "city", label: "Город" },
      { name: "nameRu", label: "Название" },
      { name: "addressRu", label: "Адрес" },
      { name: "hoursRu", label: "Часы" },
      { name: "isPickup", label: "Самовывоз", type: "checkbox" },
      { name: "isActive", label: "Активен", type: "checkbox" },
    ],
    fields: [
      { name: "city", label: "Город", type: "text", required: true },
      { name: "nameRu", label: "Название (RU)", type: "text", required: true },
      { name: "nameKz", label: "Название (KZ)", type: "text", required: true },
      { name: "addressRu", label: "Адрес (RU)", type: "text", required: true, wide: true },
      { name: "addressKz", label: "Адрес (KZ)", type: "text", required: true, wide: true },
      { name: "hoursRu", label: "Часы работы (RU)", type: "text", nullable: true },
      { name: "hoursKz", label: "Часы работы (KZ)", type: "text", nullable: true },
      { name: "phone", label: "Телефон", type: "text", nullable: true },
      { name: "mapUrl", label: "Ссылка на карту (2ГИС / Яндекс / Google)", type: "text", nullable: true, wide: true },
      { name: "mapEmbedUrl", label: "URL для встраивания карты (iframe, https://…)", type: "text", nullable: true, wide: true },
      { name: "latitude", label: "Широта", type: "float", nullable: true },
      { name: "longitude", label: "Долгота", type: "float", nullable: true },
      { name: "warehouseId", label: "Склад магазина (для самовывоза)", type: "select", optionsLoader: warehouseOptions, nullable: true },
      { name: "sortOrder", label: "Порядок", type: "int" },
      { name: "isPickup", label: "Пункт самовывоза", type: "checkbox" },
      { name: "isActive", label: "Показывать на сайте", type: "checkbox" },
    ],
    deletable: true,
  },
  banners: {
    key: "banners",
    model: "banner",
    title: "Баннеры главной страницы",
    singular: "баннер",
    description: "Слайдер на главной. Рекомендуемый размер: 2400×1350 (десктоп), 1080×1440 (мобильный).",
    permission: "content.edit",
    orderBy: [{ sortOrder: "asc" }],
    columns: [
      { name: "imageUrl", label: "Фото", type: "image" },
      { name: "titleRu", label: "Заголовок" },
      { name: "link", label: "Ссылка" },
      { name: "sortOrder", label: "Порядок" },
      { name: "isActive", label: "Активен", type: "checkbox" },
    ],
    fields: [
      { name: "titleRu", label: "Заголовок (RU)", type: "text", required: true, wide: true },
      { name: "titleKz", label: "Заголовок (KZ)", type: "text", required: true, wide: true },
      { name: "subtitleRu", label: "Подзаголовок (RU)", type: "text", nullable: true },
      { name: "subtitleKz", label: "Подзаголовок (KZ)", type: "text", nullable: true },
      { name: "buttonRu", label: "Текст кнопки (RU)", type: "text", nullable: true },
      { name: "buttonKz", label: "Текст кнопки (KZ)", type: "text", nullable: true },
      { name: "link", label: "Ссылка (например /catalog/kostyumy)", type: "text", nullable: true, wide: true },
      { name: "imageUrl", label: "Изображение (десктоп)", type: "image", required: true },
      { name: "mobileImageUrl", label: "Изображение (мобильное)", type: "image", nullable: true },
      {
        name: "textColor",
        label: "Цвет текста",
        type: "select",
        options: [
          { value: "light", label: "Светлый (для тёмного фото)" },
          { value: "dark", label: "Тёмный (для светлого фото)" },
        ],
      },
      { name: "sortOrder", label: "Порядок", type: "int" },
      { name: "isActive", label: "Показывать", type: "checkbox" },
    ],
    deletable: true,
  },
  promo: {
    key: "promo",
    model: "promoCode",
    title: "Промокоды",
    singular: "промокод",
    permission: "marketing.edit",
    orderBy: [{ createdAt: "desc" }],
    columns: [
      { name: "code", label: "Код" },
      { name: "type", label: "Тип" },
      { name: "value", label: "Значение" },
      { name: "minOrder", label: "Мин. сумма", type: "money" },
      { name: "usedCount", label: "Использован" },
      { name: "maxUses", label: "Лимит" },
      { name: "endsAt", label: "До", type: "datetime" },
      { name: "isActive", label: "Активен", type: "checkbox" },
    ],
    fields: [
      { name: "code", label: "Код", type: "text", required: true, uppercase: true },
      {
        name: "type",
        label: "Тип скидки",
        type: "select",
        options: [
          { value: "PERCENT", label: "Процент" },
          { value: "FIXED", label: "Фиксированная сумма, ₸" },
        ],
      },
      { name: "value", label: "Значение (% или ₸)", type: "int", required: true },
      { name: "minOrder", label: "Минимальная сумма заказа, ₸", type: "money" },
      { name: "maxUses", label: "Лимит использований (пусто — без лимита)", type: "int", nullable: true },
      { name: "startsAt", label: "Начало действия", type: "datetime", nullable: true },
      { name: "endsAt", label: "Окончание действия", type: "datetime", nullable: true },
      { name: "applyToSale", label: "Применять к товарам со скидкой", type: "checkbox" },
      { name: "isActive", label: "Активен", type: "checkbox" },
      { name: "description", label: "Комментарий", type: "text", nullable: true, wide: true },
    ],
    deletable: true,
  },
  delivery: {
    key: "delivery",
    model: "deliveryMethod",
    title: "Способы доставки",
    singular: "способ доставки",
    description: "Если «стоимость сообщает менеджер» включено, доставка не входит в сумму заказа и рассчитывается по тарифу перевозчика.",
    permission: "settings.edit",
    orderBy: [{ sortOrder: "asc" }],
    columns: [
      { name: "code", label: "Код" },
      { name: "nameRu", label: "Название" },
      { name: "type", label: "Тип" },
      { name: "price", label: "Цена", type: "money" },
      { name: "freeFrom", label: "Бесплатно от", type: "money" },
      { name: "calcByManager", label: "По тарифу", type: "checkbox" },
      { name: "cities", label: "Города", type: "list" },
      { name: "isActive", label: "Активен", type: "checkbox" },
    ],
    fields: [
      { name: "code", label: "Код", type: "text", required: true },
      {
        name: "type",
        label: "Тип",
        type: "select",
        options: [
          { value: "PICKUP", label: "Самовывоз" },
          { value: "COURIER", label: "Курьер" },
          { value: "POST", label: "Служба доставки / почта" },
        ],
      },
      { name: "nameRu", label: "Название (RU)", type: "text", required: true },
      { name: "nameKz", label: "Название (KZ)", type: "text", required: true },
      { name: "descRu", label: "Описание (RU)", type: "text", nullable: true, wide: true },
      { name: "descKz", label: "Описание (KZ)", type: "text", nullable: true, wide: true },
      { name: "price", label: "Стоимость, ₸", type: "money" },
      { name: "freeFrom", label: "Бесплатно от суммы, ₸ (пусто — нет)", type: "money", nullable: true },
      { name: "calcByManager", label: "Стоимость сообщает менеджер (по тарифу перевозчика)", type: "checkbox" },
      { name: "cities", label: "Города (через запятую; пусто — все)", type: "list", wide: true },
      { name: "etaRu", label: "Срок (RU)", type: "text", nullable: true },
      { name: "etaKz", label: "Срок (KZ)", type: "text", nullable: true },
      { name: "sortOrder", label: "Порядок", type: "int" },
      { name: "isActive", label: "Активен", type: "checkbox" },
    ],
    deletable: true,
  },
  payments: {
    key: "payments",
    model: "paymentMethod",
    title: "Способы оплаты",
    singular: "способ оплаты",
    description:
      "Онлайн-провайдеры (Kaspi Pay, эквайринг) отображаются покупателю только после реальной интеграции по договору с банком/платёжной системой. Сайт не имитирует оплату.",
    permission: "settings.edit",
    orderBy: [{ sortOrder: "asc" }],
    columns: [
      { name: "code", label: "Код" },
      { name: "nameRu", label: "Название" },
      { name: "provider", label: "Провайдер" },
      { name: "isActive", label: "Активен", type: "checkbox" },
    ],
    fields: [
      { name: "code", label: "Код", type: "text", required: true },
      {
        name: "provider",
        label: "Провайдер",
        type: "select",
        options: [
          { value: "manual", label: "Подтверждение менеджером" },
          { value: "cash", label: "Оплата при получении" },
          { value: "kaspi", label: "Kaspi Pay API (требует интеграции)" },
          { value: "card_gateway", label: "Эквайринг банка (требует интеграции)" },
        ],
      },
      { name: "nameRu", label: "Название (RU)", type: "text", required: true },
      { name: "nameKz", label: "Название (KZ)", type: "text", required: true },
      { name: "descRu", label: "Описание (RU)", type: "text", nullable: true, wide: true },
      { name: "descKz", label: "Описание (KZ)", type: "text", nullable: true, wide: true },
      { name: "sortOrder", label: "Порядок", type: "int" },
      { name: "isActive", label: "Активен", type: "checkbox" },
    ],
    deletable: true,
  },
  pages: {
    key: "pages",
    model: "page",
    title: "Страницы",
    singular: "страницу",
    description: "Информационные страницы (/info/slug). Поддерживается разметка: ## заголовок, - список, **жирный**, [ссылка](https://…).",
    permission: "content.edit",
    orderBy: [{ sortOrder: "asc" }],
    columns: [
      { name: "slug", label: "Адрес" },
      { name: "titleRu", label: "Заголовок" },
      { name: "showInFooter", label: "В подвале", type: "checkbox" },
      { name: "isActive", label: "Опубликована", type: "checkbox" },
    ],
    fields: [
      { name: "slug", label: "Адрес (латиница, например delivery)", type: "text", required: true },
      { name: "titleRu", label: "Заголовок (RU)", type: "text", required: true },
      { name: "titleKz", label: "Заголовок (KZ)", type: "text", required: true },
      { name: "contentRu", label: "Текст (RU)", type: "markdown", required: true, wide: true },
      { name: "contentKz", label: "Текст (KZ)", type: "markdown", required: true, wide: true },
      { name: "sortOrder", label: "Порядок", type: "int" },
      { name: "showInFooter", label: "Показывать в подвале", type: "checkbox" },
      { name: "isActive", label: "Опубликована", type: "checkbox" },
    ],
    deletable: true,
  },
  colors: {
    key: "colors",
    model: "color",
    title: "Цвета",
    singular: "цвет",
    description: "Справочник цветов для вариантов товаров и фильтра. Код используется при импорте и обмене с 1С.",
    permission: "catalog.edit",
    orderBy: [{ sortOrder: "asc" }],
    columns: [
      { name: "hex", label: "", type: "color" },
      { name: "code", label: "Код" },
      { name: "nameRu", label: "Название RU" },
      { name: "nameKz", label: "Название KZ" },
    ],
    fields: [
      { name: "code", label: "Код", type: "text", required: true },
      { name: "nameRu", label: "Название (RU)", type: "text", required: true },
      { name: "nameKz", label: "Название (KZ)", type: "text", required: true },
      { name: "hex", label: "Цвет", type: "color" },
      { name: "sortOrder", label: "Порядок", type: "int" },
    ],
    deletable: true,
    beforeDelete: async (id) => ((await prisma.productVariant.count({ where: { colorId: id } })) ? "Цвет используется в товарах" : null),
  },
  categories: {
    key: "categories",
    model: "category",
    title: "Категории",
    singular: "категорию",
    description: "Иерархия категорий каталога. Адрес (slug) используется в URL: /catalog/slug.",
    permission: "catalog.edit",
    orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }],
    columns: [
      { name: "nameRu", label: "Название" },
      { name: "slug", label: "Адрес" },
      { name: "parentId", label: "Родитель", type: "select" },
      { name: "sortOrder", label: "Порядок" },
      { name: "showOnHome", label: "На главной", type: "checkbox" },
      { name: "isActive", label: "Активна", type: "checkbox" },
    ],
    fields: [
      { name: "nameRu", label: "Название (RU)", type: "text", required: true },
      { name: "nameKz", label: "Название (KZ)", type: "text", required: true },
      { name: "slug", label: "Адрес (латиница)", type: "text", required: true },
      { name: "parentId", label: "Родительская категория", type: "select", optionsLoader: categoryOptions, nullable: true },
      { name: "descriptionRu", label: "Описание (RU)", type: "textarea", nullable: true, wide: true },
      { name: "descriptionKz", label: "Описание (KZ)", type: "textarea", nullable: true, wide: true },
      { name: "imageUrl", label: "Изображение", type: "image", nullable: true },
      { name: "seoTitleRu", label: "SEO title (RU)", type: "text", nullable: true },
      { name: "seoTitleKz", label: "SEO title (KZ)", type: "text", nullable: true },
      { name: "seoDescRu", label: "SEO description (RU)", type: "text", nullable: true, wide: true },
      { name: "seoDescKz", label: "SEO description (KZ)", type: "text", nullable: true, wide: true },
      { name: "sortOrder", label: "Порядок", type: "int" },
      { name: "showOnHome", label: "Показывать на главной", type: "checkbox" },
      { name: "isActive", label: "Активна", type: "checkbox" },
    ],
    deletable: true,
    beforeDelete: async (id) => {
      if (await prisma.product.count({ where: { categoryId: id } })) return "В категории есть товары — перенесите их или деактивируйте категорию";
      if (await prisma.category.count({ where: { parentId: id } })) return "У категории есть подкатегории";
      return null;
    },
  },
  looks: {
    key: "looks",
    model: "look",
    title: "Готовые образы",
    singular: "образ",
    description: "Состав образа задаётся артикулами товаров через запятую (поле «Артикулы»).",
    permission: "content.edit",
    orderBy: [{ sortOrder: "asc" }],
    columns: [
      { name: "imageUrl", label: "Фото", type: "image" },
      { name: "titleRu", label: "Название" },
      { name: "isActive", label: "Активен", type: "checkbox" },
    ],
    fields: [
      { name: "titleRu", label: "Название (RU)", type: "text", required: true },
      { name: "titleKz", label: "Название (KZ)", type: "text", required: true },
      { name: "imageUrl", label: "Фото образа", type: "image", required: true },
      { name: "sortOrder", label: "Порядок", type: "int" },
      { name: "isActive", label: "Показывать", type: "checkbox" },
    ],
    deletable: true,
  },
};
