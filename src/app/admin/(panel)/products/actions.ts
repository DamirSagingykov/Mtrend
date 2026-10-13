"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, type FitType, type ProductStatus, type Season } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/admin-guard";
import { can } from "@/lib/permissions";
import { saveImage } from "@/lib/storage";
import { audit } from "@/lib/audit";
import { slugify } from "@/lib/format";
import { recomputeProductAggregates } from "@/lib/product-aggregates";
import type { ActionResult } from "@/components/admin/action-form";

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
};
const opt = (fd: FormData, k: string) => str(fd, k) || null;

const productSchema = z.object({
  nameRu: z.string().min(2, "Название (RU) обязательно").max(300),
  nameKz: z.string().max(300),
  article: z.string().min(1, "Артикул обязателен").max(50),
  brand: z.string().min(1).max(100),
  categoryId: z.string().min(1, "Выберите категорию"),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
});

export async function saveProductAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requirePermission("products.edit");
  const id = str(fd, "id") || null;
  const parsed = productSchema.safeParse({
    nameRu: str(fd, "nameRu"),
    nameKz: str(fd, "nameKz"),
    article: str(fd, "article"),
    brand: str(fd, "brand") || "M-TREND",
    categoryId: str(fd, "categoryId"),
    status: str(fd, "status") || "DRAFT",
  });
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join("\n") };
  const d = parsed.data;
  const slug = slugify(str(fd, "slug") || `${d.nameRu} ${d.article}`);
  const fit = (str(fd, "fit") || null) as FitType | null;
  const season = (str(fd, "season") || null) as Season | null;
  const status = d.status as ProductStatus;

  const data = {
    nameRu: d.nameRu,
    nameKz: d.nameKz || d.nameRu,
    article: d.article,
    brand: d.brand,
    slug,
    categoryId: d.categoryId,
    status,
    fit,
    season,
    isNew: fd.get("isNew") === "on",
    isBestseller: fd.get("isBestseller") === "on",
    isDemo: fd.get("isDemo") === "on",
    hasHeights: fd.get("hasHeights") === "on",
    materialRu: opt(fd, "materialRu"),
    materialKz: opt(fd, "materialKz"),
    compositionRu: opt(fd, "compositionRu"),
    compositionKz: opt(fd, "compositionKz"),
    descriptionRu: opt(fd, "descriptionRu"),
    descriptionKz: opt(fd, "descriptionKz"),
    careRu: opt(fd, "careRu"),
    careKz: opt(fd, "careKz"),
    fitAdviceRu: opt(fd, "fitAdviceRu"),
    fitAdviceKz: opt(fd, "fitAdviceKz"),
    videoUrl: opt(fd, "videoUrl"),
    sizeChartId: opt(fd, "sizeChartId"),
    seoTitleRu: opt(fd, "seoTitleRu"),
    seoTitleKz: opt(fd, "seoTitleKz"),
    seoDescRu: opt(fd, "seoDescRu"),
    seoDescKz: opt(fd, "seoDescKz"),
    externalId: opt(fd, "externalId"),
  };
  if (data.videoUrl && !/^https:\/\//.test(data.videoUrl)) return { error: "Ссылка на видео должна начинаться с https://" };

  try {
    let productId = id;
    if (id) {
      const prev = await prisma.product.findUniqueOrThrow({ where: { id } });
      await prisma.product.update({ where: { id }, data: { ...data, publishedAt: status === "ACTIVE" ? (prev.publishedAt ?? new Date()) : prev.publishedAt } });
    } else {
      const created = await prisma.product.create({ data: { ...data, publishedAt: status === "ACTIVE" ? new Date() : null } });
      productId = created.id;
    }
    await audit(user.id, id ? "update" : "create", "product", productId, { article: data.article, status });
    revalidatePath("/", "layout");
    if (!id) redirect(`/admin/products/${productId}?created=1`);
    return { ok: "Товар сохранён" };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: `Уже существует товар с таким значением: ${(e.meta?.target as string[])?.join(", ")}` };
    }
    throw e;
  }
}

export async function setProductStatusAction(fd: FormData) {
  const user = await requirePermission("products.edit");
  const id = str(fd, "id");
  const status = str(fd, "status") as ProductStatus;
  if (!["DRAFT", "ACTIVE", "ARCHIVED"].includes(status)) return;
  await prisma.product.update({ where: { id }, data: { status, ...(status === "ACTIVE" ? { publishedAt: new Date() } : {}) } });
  await audit(user.id, "status", "product", id, { status });
  revalidatePath("/", "layout");
}

export async function deleteProductAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requirePermission("products.edit");
  const id = str(fd, "id");
  const used = await prisma.orderItem.count({ where: { productId: id } });
  if (used) {
    await prisma.product.update({ where: { id }, data: { status: "ARCHIVED" } });
    await audit(user.id, "archive", "product", id);
    revalidatePath("/", "layout");
    return { ok: "Товар есть в заказах — он перемещён в архив вместо удаления" };
  }
  await prisma.product.delete({ where: { id } });
  await audit(user.id, "delete", "product", id);
  revalidatePath("/", "layout");
  redirect("/admin/products?deleted=1");
}

/* ───────────── Фотографии ───────────── */

export async function uploadImagesAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requirePermission("products.edit");
  const productId = str(fd, "productId");
  const colorId = opt(fd, "colorId");
  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { error: "Выберите файлы" };
  if (files.length > 20) return { error: "Не более 20 файлов за раз" };
  const max = await prisma.productImage.aggregate({ where: { productId }, _max: { sortOrder: true } });
  let sort = (max._max.sortOrder ?? -1) + 1;
  const errors: string[] = [];
  for (const file of files) {
    try {
      const url = await saveImage(file, "products");
      await prisma.productImage.create({ data: { productId, url, colorId, sortOrder: sort++ } });
    } catch (e) {
      errors.push(`${file.name}: ${e instanceof Error ? e.message : "ошибка"}`);
    }
  }
  await audit(user.id, "upload_images", "product", productId, { count: files.length - errors.length });
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/", "layout");
  return errors.length ? { error: errors.join("\n") } : { ok: `Загружено фото: ${files.length}` };
}

export async function updateImagesAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requirePermission("products.edit");
  const productId = str(fd, "productId");
  const images = await prisma.productImage.findMany({ where: { productId } });
  const del = new Set(fd.getAll("delete").map(String));
  for (const img of images) {
    if (del.has(img.id)) {
      await prisma.productImage.delete({ where: { id: img.id } });
      continue;
    }
    await prisma.productImage.update({
      where: { id: img.id },
      data: {
        sortOrder: parseInt(str(fd, `sort_${img.id}`), 10) || 0,
        colorId: opt(fd, `color_${img.id}`),
        altRu: opt(fd, `alt_${img.id}`),
      },
    });
  }
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/", "layout");
  return { ok: "Фото обновлены" };
}

/* ───────────── Варианты (SKU) и остатки ───────────── */

export async function generateVariantsAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requirePermission("products.edit");
  const productId = str(fd, "productId");
  const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
  const colorIds = fd.getAll("colors").map(String);
  const sizes = str(fd, "sizes").split(/[,;\s]+/).filter(Boolean);
  const heights = str(fd, "heights").split(/[,;\s]+/).filter(Boolean);
  const price = parseInt(str(fd, "price").replace(/\s/g, ""), 10);
  const oldPriceRaw = parseInt(str(fd, "oldPrice").replace(/\s/g, ""), 10);
  if (!colorIds.length || !sizes.length) return { error: "Выберите хотя бы один цвет и укажите размеры" };
  if (!Number.isFinite(price) || price <= 0) return { error: "Укажите цену" };
  const colors = await prisma.color.findMany({ where: { id: { in: colorIds } } });
  let created = 0;
  for (const c of colors) {
    for (const size of sizes) {
      for (const height of heights.length ? heights : [null]) {
        const exists = await prisma.productVariant.findFirst({ where: { productId, colorId: c.id, size, height } });
        if (exists) continue;
        let sku = [product.article, c.code.toUpperCase(), size, height].filter(Boolean).join("-");
        if (await prisma.productVariant.findUnique({ where: { sku } })) sku = `${sku}-${Date.now().toString(36)}`;
        await prisma.productVariant.create({
          data: { productId, colorId: c.id, size, height, sku, price, oldPrice: Number.isFinite(oldPriceRaw) && oldPriceRaw > price ? oldPriceRaw : null },
        });
        created++;
      }
    }
  }
  if (heights.length) await prisma.product.update({ where: { id: productId }, data: { hasHeights: true } });
  await recomputeProductAggregates([productId]);
  await audit(user.id, "generate_variants", "product", productId, { created });
  revalidatePath(`/admin/products/${productId}`);
  return { ok: `Создано вариантов: ${created}` };
}

/**
 * Сохранение таблицы вариантов: цены (только ADMIN), активность и остатки по складам (ADMIN и MANAGER).
 * Изменения остатков фиксируются в журнале движений (StockMovement, MANUAL).
 */
export async function saveVariantsAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requirePermission("stock.edit");
  const canPrice = can(user.role, "products.edit");
  const productId = str(fd, "productId");
  const variants = await prisma.productVariant.findMany({ where: { productId }, include: { stocks: true } });
  const warehouses = await prisma.warehouse.findMany();
  const bulkPrice = parseInt(str(fd, "bulkPrice").replace(/\s/g, ""), 10);
  const bulkOld = str(fd, "bulkOldPrice");
  const bulkDiscount = parseInt(str(fd, "bulkDiscount"), 10);
  const errors: string[] = [];
  let stockChanges = 0;

  await prisma.$transaction(async (tx) => {
    for (const v of variants) {
      if (canPrice) {
        let price = parseInt(str(fd, `price_${v.id}`).replace(/\s/g, ""), 10);
        let oldPriceStr = str(fd, `old_${v.id}`).replace(/\s/g, "");
        if (Number.isFinite(bulkPrice) && bulkPrice > 0) price = bulkPrice;
        if (bulkOld !== "") oldPriceStr = bulkOld === "0" ? "" : bulkOld.replace(/\s/g, "");
        let oldPrice = oldPriceStr ? parseInt(oldPriceStr, 10) : null;
        // массовая скидка в процентах: старая цена = текущая, новая = со скидкой
        if (Number.isFinite(bulkDiscount) && bulkDiscount > 0 && bulkDiscount < 90) {
          const base = oldPrice && oldPrice > price ? oldPrice : price;
          oldPrice = base;
          price = Math.round((base * (100 - bulkDiscount)) / 100 / 10) * 10;
        }
        if (!Number.isFinite(price) || price <= 0) {
          errors.push(`${v.sku}: некорректная цена`);
          continue;
        }
        const sku = str(fd, `sku_${v.id}`) || v.sku;
        await tx.productVariant.update({
          where: { id: v.id },
          data: {
            price,
            oldPrice: oldPrice && oldPrice > price ? oldPrice : null,
            isActive: fd.get(`active_${v.id}`) === "on",
            sku,
            barcode: opt(fd, `barcode_${v.id}`),
          },
        });
      }
      for (const w of warehouses) {
        const raw = fd.get(`stock_${v.id}_${w.id}`);
        if (raw === null) continue;
        const qty = parseInt(String(raw), 10);
        if (!Number.isFinite(qty) || qty < 0) {
          errors.push(`${v.sku} / ${w.code}: некорректный остаток`);
          continue;
        }
        const current = v.stocks.find((s) => s.warehouseId === w.id)?.quantity ?? 0;
        if (current === qty) continue;
        await tx.stock.upsert({
          where: { variantId_warehouseId: { variantId: v.id, warehouseId: w.id } },
          update: { quantity: qty },
          create: { variantId: v.id, warehouseId: w.id, quantity: qty },
        });
        await tx.stockMovement.create({ data: { variantId: v.id, warehouseId: w.id, delta: qty - current, reason: "MANUAL", userId: user.id } });
        stockChanges++;
      }
    }
  });
  await recomputeProductAggregates([productId]);
  await audit(user.id, "save_variants", "product", productId, { stockChanges, priceEdited: canPrice });
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/", "layout");
  if (errors.length) return { error: errors.join("\n") };
  return { ok: `Сохранено. Изменений остатков: ${stockChanges}` };
}

export async function deleteVariantAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requirePermission("products.edit");
  const id = str(fd, "variantId");
  const v = await prisma.productVariant.findUniqueOrThrow({ where: { id } });
  if (await prisma.orderItem.count({ where: { variantId: id } })) {
    await prisma.productVariant.update({ where: { id }, data: { isActive: false } });
  } else {
    await prisma.productVariant.delete({ where: { id } });
  }
  await recomputeProductAggregates([v.productId]);
  await audit(user.id, "delete_variant", "variant", id, { sku: v.sku });
  revalidatePath(`/admin/products/${v.productId}`);
  return { ok: "Вариант удалён (или деактивирован, если есть в заказах)" };
}
