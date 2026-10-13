import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { slugify } from "../format";
import { recomputeProductAggregates } from "../product-aggregates";

/**
 * Единый сервис импорта каталога. Используется:
 *  — API интеграции с 1С (POST /api/integrations/1c/catalog, /stock);
 *  — импортом Excel/CSV в админ-панели;
 *  — CLI-скриптом обмена файлами (scripts/onec-import-file.ts).
 * Формат данных описан в docs/1C_INTEGRATION.md.
 */

const intPrice = z.coerce.number().int().min(0).max(100_000_000);
const optStr = z.string().trim().max(5000).optional().nullable();

export const stockItemSchema = z.object({ warehouseCode: z.string().trim().min(1).max(50), quantity: z.coerce.number().int().min(0).max(1_000_000) });

export const variantSchema = z.object({
  externalId: z.string().trim().max(100).optional().nullable(),
  sku: z.string().trim().min(1).max(100),
  colorCode: z.string().trim().min(1).max(50),
  colorNameRu: optStr,
  colorNameKz: optStr,
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  size: z.string().trim().min(1).max(20),
  height: z.string().trim().max(20).optional().nullable(),
  price: intPrice,
  oldPrice: intPrice.optional().nullable(),
  barcode: z.string().trim().max(50).optional().nullable(),
  isActive: z.boolean().optional(),
  stocks: z.array(stockItemSchema).optional(),
});

export const productSchema = z.object({
  externalId: z.string().trim().max(100).optional().nullable(),
  article: z.string().trim().min(1).max(50),
  nameRu: z.string().trim().min(1).max(300),
  nameKz: optStr,
  brand: optStr,
  categoryExternalId: optStr,
  categorySlug: optStr,
  descriptionRu: optStr,
  descriptionKz: optStr,
  compositionRu: optStr,
  compositionKz: optStr,
  materialRu: optStr,
  materialKz: optStr,
  season: z.enum(["ALL_SEASON", "DEMI", "WINTER", "SUMMER"]).optional().nullable(),
  fit: z.enum(["SLIM", "REGULAR", "RELAXED"]).optional().nullable(),
  isNew: z.boolean().optional(),
  publish: z.boolean().optional(),
  variants: z.array(variantSchema).min(1).max(500),
});

export const categorySchema = z.object({
  externalId: z.string().trim().min(1).max(100),
  slug: optStr,
  nameRu: z.string().trim().min(1).max(200),
  nameKz: optStr,
  parentExternalId: optStr,
});

export const warehouseSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(100),
  address: optStr,
});

export const catalogPayloadSchema = z.object({
  categories: z.array(categorySchema).max(2000).optional(),
  warehouses: z.array(warehouseSchema).max(200).optional(),
  products: z.array(productSchema).max(5000),
  options: z
    .object({
      /** вычитать из присланных остатков товары в заказах сайта, ещё не переданных в 1С */
      subtractPendingOrders: z.boolean().default(true),
      dryRun: z.boolean().default(false),
    })
    .partial()
    .optional(),
});

export const stockPayloadSchema = z.object({
  items: z
    .array(z.object({ sku: z.string().trim().min(1).max(100), warehouseCode: z.string().trim().min(1).max(50), quantity: z.coerce.number().int().min(0).max(1_000_000) }))
    .max(200_000),
  prices: z
    .array(z.object({ sku: z.string().trim().min(1).max(100), price: intPrice, oldPrice: intPrice.optional().nullable() }))
    .max(200_000)
    .optional(),
  options: z.object({ subtractPendingOrders: z.boolean().default(true) }).partial().optional(),
});

export type CatalogPayload = z.infer<typeof catalogPayloadSchema>;
export type StockPayload = z.infer<typeof stockPayloadSchema>;

export type ImportReport = {
  categoriesCreated: number;
  categoriesUpdated: number;
  productsCreated: number;
  productsUpdated: number;
  variantsCreated: number;
  variantsUpdated: number;
  stocksUpdated: number;
  pricesUpdated: number;
  errors: { ref: string; message: string }[];
  dryRun: boolean;
};

function emptyReport(dryRun = false): ImportReport {
  return {
    categoriesCreated: 0,
    categoriesUpdated: 0,
    productsCreated: 0,
    productsUpdated: 0,
    variantsCreated: 0,
    variantsUpdated: 0,
    stocksUpdated: 0,
    pricesUpdated: 0,
    errors: [],
    dryRun,
  };
}

/** Остатки, списанные под заказы сайта, которые ещё не переданы в 1С (иначе 1С «вернёт» проданный товар) */
async function pendingOrderQuantities(): Promise<Map<string, number>> {
  const rows = await prisma.stockMovement.groupBy({
    by: ["variantId", "warehouseId"],
    where: {
      reason: "ORDER",
      order: { exportedTo1CAt: null, stockReleased: false, status: { notIn: ["CANCELLED", "RETURNED"] } },
    },
    _sum: { delta: true },
  });
  return new Map(rows.map((r) => [`${r.variantId}:${r.warehouseId}`, -(r._sum.delta ?? 0)]));
}

async function setStock(
  tx: Prisma.TransactionClient,
  variantId: string,
  warehouseId: string,
  quantity: number,
  reason: "IMPORT" | "SYNC_1C",
  pending: Map<string, number> | null,
) {
  const target = Math.max(0, quantity - (pending?.get(`${variantId}:${warehouseId}`) ?? 0));
  const current = await tx.stock.findUnique({ where: { variantId_warehouseId: { variantId, warehouseId } } });
  if (current && current.quantity === target) return false;
  await tx.stock.upsert({
    where: { variantId_warehouseId: { variantId, warehouseId } },
    update: { quantity: target },
    create: { variantId, warehouseId, quantity: target },
  });
  await tx.stockMovement.create({ data: { variantId, warehouseId, delta: target - (current?.quantity ?? 0), reason } });
  return true;
}

export async function importCatalog(payload: CatalogPayload, source: "1c" | "csv" | "xlsx"): Promise<ImportReport> {
  const dryRun = payload.options?.dryRun ?? false;
  const report = emptyReport(dryRun);
  const reason = source === "1c" ? "SYNC_1C" : "IMPORT";
  const pending = payload.options?.subtractPendingOrders === false ? null : await pendingOrderQuantities();

  // Склады
  for (const w of payload.warehouses ?? []) {
    if (dryRun) continue;
    await prisma.warehouse.upsert({ where: { code: w.code }, update: { name: w.name, city: w.city, address: w.address ?? undefined }, create: { ...w, address: w.address ?? null } });
  }
  const warehouses = new Map((await prisma.warehouse.findMany()).map((w) => [w.code, w]));

  // Категории (сначала создаём, затем связываем родителей)
  for (const c of payload.categories ?? []) {
    const existing = await prisma.category.findUnique({ where: { externalId: c.externalId } });
    if (dryRun) {
      if (existing) report.categoriesUpdated++;
      else report.categoriesCreated++;
      continue;
    }
    if (existing) {
      await prisma.category.update({ where: { id: existing.id }, data: { nameRu: c.nameRu, nameKz: c.nameKz || existing.nameKz } });
      report.categoriesUpdated++;
    } else {
      let slug = c.slug || slugify(c.nameRu) || `cat-${c.externalId}`;
      if (await prisma.category.findUnique({ where: { slug } })) slug = `${slug}-${c.externalId.slice(-6).toLowerCase()}`;
      await prisma.category.create({ data: { externalId: c.externalId, slug, nameRu: c.nameRu, nameKz: c.nameKz || c.nameRu } });
      report.categoriesCreated++;
    }
  }
  if (!dryRun) {
    for (const c of payload.categories ?? []) {
      if (!c.parentExternalId) continue;
      const parent = await prisma.category.findUnique({ where: { externalId: c.parentExternalId } });
      if (parent) await prisma.category.update({ where: { externalId: c.externalId }, data: { parentId: parent.id } });
    }
  }

  const fallbackCategory = await prisma.category.findFirst({ where: { slug: "unsorted" } });
  const touched: string[] = [];

  for (const p of payload.products) {
    const ref = `артикул ${p.article}`;
    try {
      const category = p.categoryExternalId
        ? await prisma.category.findUnique({ where: { externalId: p.categoryExternalId } })
        : p.categorySlug
          ? await prisma.category.findUnique({ where: { slug: p.categorySlug } })
          : null;
      const existing =
        (p.externalId ? await prisma.product.findUnique({ where: { externalId: p.externalId } }) : null) ??
        (await prisma.product.findUnique({ where: { article: p.article } }));
      const categoryId = category?.id ?? existing?.categoryId ?? fallbackCategory?.id;
      if (!categoryId) throw new Error(`Категория не найдена (${p.categoryExternalId || p.categorySlug || "не указана"}) и нет категории «unsorted»`);
      for (const v of p.variants) for (const s of v.stocks ?? []) if (!warehouses.has(s.warehouseCode)) throw new Error(`Неизвестный склад ${s.warehouseCode}`);

      if (dryRun) {
        if (existing) report.productsUpdated++;
        else report.productsCreated++;
        report.variantsCreated += p.variants.length;
        continue;
      }

      await prisma.$transaction(
        async (tx) => {
          const data = {
            article: p.article,
            nameRu: p.nameRu,
            ...(p.nameKz ? { nameKz: p.nameKz } : {}),
            ...(p.brand ? { brand: p.brand } : {}),
            ...(p.descriptionRu !== undefined && p.descriptionRu !== null ? { descriptionRu: p.descriptionRu } : {}),
            ...(p.descriptionKz ? { descriptionKz: p.descriptionKz } : {}),
            ...(p.compositionRu ? { compositionRu: p.compositionRu } : {}),
            ...(p.compositionKz ? { compositionKz: p.compositionKz } : {}),
            ...(p.materialRu ? { materialRu: p.materialRu } : {}),
            ...(p.materialKz ? { materialKz: p.materialKz } : {}),
            ...(p.season ? { season: p.season } : {}),
            ...(p.fit ? { fit: p.fit } : {}),
            ...(p.isNew !== undefined ? { isNew: p.isNew } : {}),
            ...(p.externalId ? { externalId: p.externalId } : {}),
            categoryId,
            hasHeights: p.variants.some((v) => !!v.height),
          };
          let productId: string;
          if (existing) {
            await tx.product.update({
              where: { id: existing.id },
              data: { ...data, ...(p.publish === true ? { status: "ACTIVE", publishedAt: existing.publishedAt ?? new Date() } : {}) },
            });
            productId = existing.id;
            report.productsUpdated++;
          } else {
            let slug = slugify(`${p.nameRu} ${p.article}`) || `product-${p.article}`;
            if (await tx.product.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
            const created = await tx.product.create({
              data: {
                ...data,
                slug,
                nameKz: p.nameKz || p.nameRu,
                // новые товары создаются черновиками, если явно не указано publish=true: администратор добавит фото
                status: p.publish ? "ACTIVE" : "DRAFT",
                publishedAt: p.publish ? new Date() : null,
              },
            });
            productId = created.id;
            report.productsCreated++;
          }
          touched.push(productId);

          for (const v of p.variants) {
            const color = await tx.color.upsert({
              where: { code: v.colorCode },
              update: {},
              create: { code: v.colorCode, nameRu: v.colorNameRu || v.colorCode, nameKz: v.colorNameKz || v.colorNameRu || v.colorCode, hex: v.colorHex || "#cccccc" },
            });
            const vData = {
              productId,
              colorId: color.id,
              size: v.size,
              height: v.height || null,
              price: v.price,
              oldPrice: v.oldPrice && v.oldPrice > v.price ? v.oldPrice : null,
              ...(v.barcode ? { barcode: v.barcode } : {}),
              ...(v.externalId ? { externalId: v.externalId } : {}),
              ...(v.isActive !== undefined ? { isActive: v.isActive } : {}),
            };
            const ex = await tx.productVariant.findUnique({ where: { sku: v.sku } });
            const variant = ex
              ? await tx.productVariant.update({ where: { id: ex.id }, data: vData })
              : await tx.productVariant.create({ data: { ...vData, sku: v.sku } });
            if (ex) report.variantsUpdated++;
            else report.variantsCreated++;
            for (const s of v.stocks ?? []) {
              if (await setStock(tx, variant.id, warehouses.get(s.warehouseCode)!.id, s.quantity, reason, pending)) report.stocksUpdated++;
            }
          }
        },
        { timeout: 60_000 },
      );
    } catch (e) {
      report.errors.push({ ref, message: e instanceof Error ? e.message : String(e) });
    }
  }

  if (!dryRun && touched.length) await recomputeProductAggregates(touched);
  return report;
}

/** Быстрая синхронизация остатков и цен (запускается 1С каждые ~10 минут) */
export async function importStock(payload: StockPayload): Promise<ImportReport> {
  const report = emptyReport();
  const pending = payload.options?.subtractPendingOrders === false ? null : await pendingOrderQuantities();
  const warehouses = new Map((await prisma.warehouse.findMany()).map((w) => [w.code, w.id]));
  const skus = Array.from(new Set([...payload.items.map((i) => i.sku), ...(payload.prices ?? []).map((p) => p.sku)]));
  const variants = new Map(
    (await prisma.productVariant.findMany({ where: { sku: { in: skus } }, select: { id: true, sku: true, productId: true } })).map((v) => [v.sku, v]),
  );
  const touched = new Set<string>();

  const chunk = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

  for (const part of chunk(payload.items, 500)) {
    await prisma.$transaction(
      async (tx) => {
        for (const item of part) {
          const v = variants.get(item.sku);
          const wId = warehouses.get(item.warehouseCode);
          if (!v) {
            report.errors.push({ ref: item.sku, message: "SKU не найден на сайте — сначала передайте номенклатуру" });
            continue;
          }
          if (!wId) {
            report.errors.push({ ref: item.sku, message: `Неизвестный склад ${item.warehouseCode}` });
            continue;
          }
          if (await setStock(tx, v.id, wId, item.quantity, "SYNC_1C", pending)) {
            report.stocksUpdated++;
            touched.add(v.productId);
          }
        }
      },
      { timeout: 60_000 },
    );
  }

  for (const p of payload.prices ?? []) {
    const v = variants.get(p.sku);
    if (!v) {
      report.errors.push({ ref: p.sku, message: "SKU не найден" });
      continue;
    }
    await prisma.productVariant.update({ where: { id: v.id }, data: { price: p.price, oldPrice: p.oldPrice && p.oldPrice > p.price ? p.oldPrice : null } });
    report.pricesUpdated++;
    touched.add(v.productId);
  }

  if (touched.size) await recomputeProductAggregates(Array.from(touched));
  return report;
}

/**
 * Преобразование плоской таблицы (CSV/Excel, одна строка = один SKU) в формат каталога.
 * Колонки остатков: stock_AST, stock_AKT … (код склада после stock_).
 */
export function rowsToCatalogPayload(rows: Record<string, unknown>[]): { payload: CatalogPayload; errors: { ref: string; message: string }[] } {
  const errors: { ref: string; message: string }[] = [];
  const products = new Map<string, z.input<typeof productSchema>>();
  const s = (v: unknown) => (v === undefined || v === null ? "" : String(v).trim());
  const bool = (v: unknown) => ["1", "true", "да", "yes", "иә"].includes(s(v).toLowerCase());

  rows.forEach((row, idx) => {
    const line = idx + 2;
    const article = s(row.article);
    if (!article) {
      if (Object.values(row).some((v) => s(v))) errors.push({ ref: `строка ${line}`, message: "Не заполнен article" });
      return;
    }
    const sku = s(row.sku) || [article, s(row.colorCode), s(row.size), s(row.height)].filter(Boolean).join("-");
    const stocks = Object.keys(row)
      .filter((k) => /^stock_/i.test(k) && s(row[k]) !== "")
      .map((k) => ({ warehouseCode: k.slice(6).toUpperCase(), quantity: Number(s(row[k]).replace(",", ".")) || 0 }));
    const variant = {
      sku,
      colorCode: s(row.colorCode) || "default",
      colorNameRu: s(row.colorRu) || null,
      colorNameKz: s(row.colorKz) || null,
      colorHex: /^#[0-9a-f]{6}$/i.test(s(row.colorHex)) ? s(row.colorHex) : null,
      size: s(row.size),
      height: s(row.height) || null,
      price: Number(s(row.price).replace(/\s/g, "").replace(",", ".")),
      oldPrice: s(row.oldPrice) ? Number(s(row.oldPrice).replace(/\s/g, "").replace(",", ".")) : null,
      barcode: s(row.barcode) || null,
      stocks,
    };
    const prev = products.get(article);
    if (prev) {
      prev.variants.push(variant);
      return;
    }
    products.set(article, {
      article,
      externalId: s(row.externalId) || null,
      nameRu: s(row.nameRu),
      nameKz: s(row.nameKz) || null,
      brand: s(row.brand) || null,
      categorySlug: s(row.category) || null,
      descriptionRu: s(row.descriptionRu) || null,
      descriptionKz: s(row.descriptionKz) || null,
      compositionRu: s(row.compositionRu) || null,
      compositionKz: s(row.compositionKz) || null,
      materialRu: s(row.materialRu) || null,
      materialKz: s(row.materialKz) || null,
      season: (s(row.season).toUpperCase() || null) as "DEMI" | null,
      fit: (s(row.fit).toUpperCase() || null) as "SLIM" | null,
      isNew: s(row.isNew) ? bool(row.isNew) : undefined,
      publish: s(row.publish) ? bool(row.publish) : undefined,
      variants: [variant],
    });
  });

  const valid: z.infer<typeof productSchema>[] = [];
  for (const [article, p] of products) {
    const parsed = productSchema.safeParse(p);
    if (parsed.success) valid.push(parsed.data);
    else errors.push({ ref: `артикул ${article}`, message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
  }
  return { payload: { products: valid }, errors };
}

export const IMPORT_TEMPLATE_COLUMNS = [
  "article",
  "nameRu",
  "nameKz",
  "category",
  "brand",
  "descriptionRu",
  "descriptionKz",
  "compositionRu",
  "compositionKz",
  "materialRu",
  "materialKz",
  "season",
  "fit",
  "isNew",
  "publish",
  "sku",
  "colorCode",
  "colorRu",
  "colorKz",
  "colorHex",
  "size",
  "height",
  "price",
  "oldPrice",
  "barcode",
  "stock_AST",
  "stock_AKT",
];
