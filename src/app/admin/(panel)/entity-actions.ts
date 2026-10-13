"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/admin-guard";
import { entities, type Field } from "@/lib/admin/entities";
import { saveImage } from "@/lib/storage";
import { audit } from "@/lib/audit";
import { slugify } from "@/lib/format";
import type { ActionResult } from "@/components/admin/action-form";

async function parseField(f: Field, fd: FormData, folder: "banners" | "categories" | "looks" | "misc"): Promise<unknown> {
  const raw = fd.get(f.name);
  const str = typeof raw === "string" ? raw.trim() : "";
  switch (f.type) {
    case "checkbox":
      return fd.get(f.name) === "on";
    case "int":
    case "money": {
      if (!str) {
        if (f.nullable) return null;
        if (f.required) throw new Error(`Поле «${f.label}» обязательно`);
        return 0;
      }
      const n = parseInt(str.replace(/\s/g, ""), 10);
      if (!Number.isFinite(n)) throw new Error(`Поле «${f.label}»: нужно целое число`);
      return n;
    }
    case "float": {
      if (!str) return null;
      const n = parseFloat(str.replace(",", "."));
      if (!Number.isFinite(n)) throw new Error(`Поле «${f.label}»: нужно число`);
      return n;
    }
    case "datetime":
      return str ? new Date(str) : null;
    case "list":
      return str ? str.split(",").map((s) => s.trim()).filter(Boolean) : [];
    case "image": {
      const file = fd.get(`${f.name}__file`);
      if (file instanceof File && file.size > 0) {
        return saveImage(file, folder);
      }
      if (!str) {
        if (f.required) throw new Error(`Загрузите изображение «${f.label}»`);
        return null;
      }
      if (!/^(https:\/\/|\/)/.test(str)) throw new Error(`«${f.label}»: укажите https:// ссылку или путь от корня`);
      return str;
    }
    case "select":
      if (!str) return f.nullable ? null : undefined;
      if (f.options && !f.options.some((o) => o.value === str)) throw new Error(`«${f.label}»: недопустимое значение`);
      return str;
    case "color":
      return /^#[0-9a-fA-F]{6}$/.test(str) ? str : "#cccccc";
    default: {
      if (!str) {
        if (f.required) throw new Error(`Поле «${f.label}» обязательно`);
        return f.nullable ? null : "";
      }
      return f.uppercase ? str.toUpperCase() : str.slice(0, f.type === "markdown" || f.type === "textarea" ? 50_000 : 1000);
    }
  }
}

export async function saveEntityAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const cfg = entities[String(fd.get("__entity"))];
  if (!cfg) return { error: "Неизвестная сущность" };
  const user = await requirePermission(cfg.permission);
  const id = String(fd.get("__id") || "") || null;
  try {
    const data: Record<string, unknown> = {};
    for (const f of cfg.fields) {
      const folder = cfg.key === "banners" || cfg.key === "categories" || cfg.key === "looks" ? cfg.key : "misc";
      const v = await parseField(f, fd, folder);
      if (v !== undefined) data[f.name] = v;
    }
    if ("slug" in data && typeof data.slug === "string") {
      data.slug = slugify(data.slug) || slugify(String(data.nameRu ?? data.titleRu ?? ""));
      if (!data.slug) return { error: "Укажите адрес (slug)" };
    }
    if (cfg.model === "category" && id && data.parentId === id) return { error: "Категория не может быть родителем самой себя" };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegate = (prisma as any)[cfg.model];
    const saved = id ? await delegate.update({ where: { id }, data }) : await delegate.create({ data });

    if (cfg.model === "look") {
      const articles = String(fd.get("__articles") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const products = await prisma.product.findMany({ where: { article: { in: articles } }, select: { id: true, article: true } });
      const missing = articles.filter((a) => !products.some((p) => p.article === a));
      await prisma.lookItem.deleteMany({ where: { lookId: saved.id } });
      await prisma.lookItem.createMany({
        data: articles
          .map((a, i) => ({ productId: products.find((p) => p.article === a)?.id, sortOrder: i }))
          .filter((x): x is { productId: string; sortOrder: number } => !!x.productId)
          .map((x) => ({ ...x, lookId: saved.id })),
      });
      if (missing.length) {
        await audit(user.id, id ? "update" : "create", cfg.model, saved.id);
        revalidatePath("/", "layout");
        return { ok: `Сохранено. Не найдены артикулы: ${missing.join(", ")}` };
      }
    }

    await audit(user.id, id ? "update" : "create", cfg.model, saved.id, JSON.parse(JSON.stringify(data)));
    revalidatePath("/", "layout");
    return { ok: "Сохранено" };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: `Значение уже используется: ${(e.meta?.target as string[] | undefined)?.join(", ") ?? "уникальное поле"}` };
    }
    if (e instanceof Prisma.PrismaClientValidationError) {
      console.error("[admin] validation", e.message);
      return { error: "Проверьте заполнение обязательных полей" };
    }
    return { error: e instanceof Error ? e.message : "Ошибка сохранения" };
  }
}

export async function deleteEntityAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const cfg = entities[String(fd.get("__entity"))];
  if (!cfg || !cfg.deletable) return { error: "Удаление запрещено" };
  const user = await requirePermission(cfg.permission);
  const id = String(fd.get("__id"));
  const reason = cfg.beforeDelete ? await cfg.beforeDelete(id) : null;
  if (reason) return { error: reason };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any)[cfg.model].delete({ where: { id } });
  } catch {
    return { error: "Не удалось удалить: запись используется. Деактивируйте её." };
  }
  await audit(user.id, "delete", cfg.model, id);
  revalidatePath("/", "layout");
  return { ok: "Удалено" };
}
