import "server-only";
import { cache } from "react";
import type { FitType, Prisma, Season } from "@prisma/client";
import { prisma } from "./db";
import { compareSizes } from "./format";

export const PAGE_SIZE = 24;

export const sortKeys = ["popular", "new", "price_asc", "price_desc", "discount"] as const;
export type SortKey = (typeof sortKeys)[number];

export type CatalogFilters = {
  q?: string;
  categoryIds?: string[];
  priceMin?: number;
  priceMax?: number;
  sizes: string[];
  colors: string[];
  fits: FitType[];
  seasons: Season[];
  materials: string[];
  inStock: boolean;
  sale: boolean;
  isNew: boolean;
  sort: SortKey;
  page: number;
};

type SP = Record<string, string | string[] | undefined>;

function list(sp: SP, key: string): string[] {
  const v = sp[key];
  const arr = Array.isArray(v) ? v : v ? [v] : [];
  return arr.flatMap((s) => s.split(",")).map((s) => s.trim()).filter(Boolean).slice(0, 50);
}
function int(sp: SP, key: string): number | undefined {
  const v = sp[key];
  const n = parseInt(Array.isArray(v) ? v[0] : (v ?? ""), 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}
function flag(sp: SP, key: string) {
  const v = sp[key];
  return v === "1" || v === "true";
}

const fitValues: FitType[] = ["SLIM", "REGULAR", "RELAXED"];
const seasonValues: Season[] = ["ALL_SEASON", "DEMI", "WINTER", "SUMMER"];

export function parseFilters(sp: SP, preset: Partial<CatalogFilters> = {}): CatalogFilters {
  const sortRaw = (Array.isArray(sp.sort) ? sp.sort[0] : sp.sort) as SortKey | undefined;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim().slice(0, 100);
  return {
    q: q || undefined,
    priceMin: int(sp, "price_min"),
    priceMax: int(sp, "price_max"),
    sizes: list(sp, "size"),
    colors: list(sp, "color"),
    fits: list(sp, "fit").filter((f): f is FitType => fitValues.includes(f as FitType)),
    seasons: list(sp, "season").filter((s): s is Season => seasonValues.includes(s as Season)),
    materials: list(sp, "material"),
    inStock: flag(sp, "in_stock"),
    sale: flag(sp, "sale"),
    isNew: flag(sp, "new"),
    sort: sortRaw && sortKeys.includes(sortRaw) ? sortRaw : "popular",
    page: Math.max(1, int(sp, "page") ?? 1),
    ...preset,
  };
}

export const getCategoryTree = cache(async () => {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { nameRu: "asc" }],
  });
  return categories;
});

export async function getDescendantIds(categoryId: string): Promise<string[]> {
  const all = await getCategoryTree();
  const result = [categoryId];
  const walk = (id: string) => {
    for (const c of all) if (c.parentId === id) {
      result.push(c.id);
      walk(c.id);
    }
  };
  walk(categoryId);
  return result;
}

function searchWhere(q: string): Prisma.ProductWhereInput {
  const terms = q.split(/\s+/).filter(Boolean).slice(0, 5);
  return {
    AND: terms.map((term) => ({
      OR: [
        { nameRu: { contains: term, mode: "insensitive" } },
        { nameKz: { contains: term, mode: "insensitive" } },
        { article: { contains: term, mode: "insensitive" } },
        { brand: { contains: term, mode: "insensitive" } },
        { category: { nameRu: { contains: term, mode: "insensitive" } } },
        { category: { nameKz: { contains: term, mode: "insensitive" } } },
        { variants: { some: { sku: { contains: term, mode: "insensitive" } } } },
      ],
    })),
  };
}

/** Базовая выборка (категория + поиск) — для фасетов */
export function baseWhere(f: Pick<CatalogFilters, "categoryIds" | "q">): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [{ status: "ACTIVE" }];
  if (f.categoryIds?.length) and.push({ categoryId: { in: f.categoryIds } });
  if (f.q) and.push(searchWhere(f.q));
  return { AND: and };
}

export function buildWhere(f: CatalogFilters): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [baseWhere(f)];
  if (f.priceMin !== undefined) and.push({ minPrice: { gte: f.priceMin } });
  if (f.priceMax !== undefined) and.push({ minPrice: { lte: f.priceMax } });
  if (f.fits.length) and.push({ fit: { in: f.fits } });
  if (f.seasons.length) and.push({ season: { in: f.seasons } });
  if (f.materials.length) and.push({ materialRu: { in: f.materials } });
  if (f.sale) and.push({ maxDiscountPercent: { gt: 0 } });
  if (f.isNew) and.push({ isNew: true });

  // Размер, цвет и наличие должны относиться к ОДНОМУ и тому же варианту (SKU)
  if (f.sizes.length || f.colors.length || f.inStock) {
    const variant: Prisma.ProductVariantWhereInput = { isActive: true };
    if (f.sizes.length) variant.size = { in: f.sizes };
    if (f.colors.length) variant.color = { code: { in: f.colors } };
    if (f.inStock) variant.stocks = { some: { quantity: { gt: 0 }, warehouse: { isActive: true } } };
    and.push({ variants: { some: variant } });
  }
  return { AND: and };
}

export function buildOrderBy(sort: SortKey): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "new":
      return [{ isNew: "desc" }, { createdAt: "desc" }];
    case "price_asc":
      return [{ minPrice: "asc" }, { createdAt: "desc" }];
    case "price_desc":
      return [{ minPrice: "desc" }, { createdAt: "desc" }];
    case "discount":
      return [{ maxDiscountPercent: "desc" }, { salesCount: "desc" }];
    default:
      return [{ salesCount: "desc" }, { isBestseller: "desc" }, { viewCount: "desc" }, { createdAt: "desc" }];
  }
}

export const productCardSelect = {
  id: true,
  slug: true,
  article: true,
  nameRu: true,
  nameKz: true,
  isNew: true,
  isBestseller: true,
  isDemo: true,
  minPrice: true,
  maxDiscountPercent: true,
  totalStock: true,
  images: { orderBy: { sortOrder: "asc" }, take: 2, select: { url: true, altRu: true, altKz: true } },
  variants: {
    where: { isActive: true },
    select: { price: true, oldPrice: true, size: true, color: { select: { code: true, hex: true, nameRu: true, nameKz: true } } },
  },
} satisfies Prisma.ProductSelect;

type CardRaw = Prisma.ProductGetPayload<{ select: typeof productCardSelect }>;

export type ProductCardData = {
  id: string;
  slug: string;
  article: string;
  nameRu: string;
  nameKz: string;
  isNew: boolean;
  isBestseller: boolean;
  isDemo: boolean;
  price: number;
  oldPrice: number | null;
  discount: number;
  inStock: boolean;
  images: { url: string; altRu: string | null; altKz: string | null }[];
  colors: { code: string; hex: string; nameRu: string; nameKz: string }[];
  sizes: string[];
};

export function toCard(p: CardRaw): ProductCardData {
  const cheapest = [...p.variants].sort((a, b) => a.price - b.price)[0];
  const colors = new Map<string, ProductCardData["colors"][number]>();
  for (const v of p.variants) colors.set(v.color.code, v.color);
  return {
    id: p.id,
    slug: p.slug,
    article: p.article,
    nameRu: p.nameRu,
    nameKz: p.nameKz,
    isNew: p.isNew,
    isBestseller: p.isBestseller,
    isDemo: p.isDemo,
    price: cheapest?.price ?? p.minPrice,
    oldPrice: cheapest?.oldPrice && cheapest.oldPrice > cheapest.price ? cheapest.oldPrice : null,
    discount: p.maxDiscountPercent,
    inStock: p.totalStock > 0,
    images: p.images,
    colors: Array.from(colors.values()),
    sizes: Array.from(new Set(p.variants.map((v) => v.size))).sort(compareSizes),
  };
}

export async function getCatalog(f: CatalogFilters, pageSize = PAGE_SIZE) {
  const where = buildWhere(f);
  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: buildOrderBy(f.sort),
      skip: (f.page - 1) * pageSize,
      take: pageSize,
      select: productCardSelect,
    }),
  ]);
  return { total, items: rows.map(toCard), pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export type Facets = {
  sizes: string[];
  colors: { code: string; hex: string; nameRu: string; nameKz: string }[];
  materials: { ru: string; kz: string }[];
  seasons: Season[];
  fits: FitType[];
  priceMin: number;
  priceMax: number;
};

export async function getFacets(f: Pick<CatalogFilters, "categoryIds" | "q">): Promise<Facets> {
  const where = baseWhere(f);
  const [variants, products, price] = await Promise.all([
    prisma.productVariant.findMany({
      where: { isActive: true, product: where },
      distinct: ["size", "colorId"],
      select: { size: true, color: { select: { code: true, hex: true, nameRu: true, nameKz: true, sortOrder: true } } },
    }),
    prisma.product.findMany({
      where,
      distinct: ["materialRu", "season", "fit"],
      select: { materialRu: true, materialKz: true, season: true, fit: true },
    }),
    prisma.product.aggregate({ where, _min: { minPrice: true }, _max: { minPrice: true } }),
  ]);
  const colors = new Map<string, Facets["colors"][number] & { sortOrder: number }>();
  for (const v of variants) colors.set(v.color.code, v.color);
  const materials = new Map<string, string>();
  for (const p of products) if (p.materialRu) materials.set(p.materialRu, p.materialKz || p.materialRu);
  const seasonOrder: Season[] = ["ALL_SEASON", "DEMI", "WINTER", "SUMMER"];
  const fitOrder: FitType[] = ["SLIM", "REGULAR", "RELAXED"];
  return {
    sizes: Array.from(new Set(variants.map((v) => v.size))).sort(compareSizes),
    colors: Array.from(colors.values())
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(({ sortOrder: _s, ...c }) => c),
    materials: Array.from(materials, ([ru, kz]) => ({ ru, kz })).sort((a, b) => a.ru.localeCompare(b.ru)),
    seasons: seasonOrder.filter((s) => products.some((p) => p.season === s)),
    fits: fitOrder.filter((s) => products.some((p) => p.fit === s)),
    priceMin: price._min.minPrice ?? 0,
    priceMax: price._max.minPrice ?? 0,
  };
}

export async function getProductCards(where: Prisma.ProductWhereInput, orderBy: Prisma.ProductOrderByWithRelationInput[], take = 8) {
  const rows = await prisma.product.findMany({
    where: { AND: [{ status: "ACTIVE" }, where] },
    orderBy,
    take,
    select: productCardSelect,
  });
  return rows.map(toCard);
}

export async function getCategoryBySlug(slug: string) {
  const all = await getCategoryTree();
  return all.find((c) => c.slug === slug) ?? null;
}
