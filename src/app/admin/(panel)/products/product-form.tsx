"use client";

import clsx from "clsx";
import { ActionForm } from "@/components/admin/action-form";
import { adminBtn, adminInput, adminLabel } from "@/components/admin/ui-classes";
import { saveProductAction } from "./actions";

type Opt = { value: string; label: string };
type ProductValues = Partial<Record<string, string | boolean | null>>;

export function ProductForm({ product = {}, options }: { product?: ProductValues; options: { categories: Opt[]; charts: Opt[] } }) {
  const v = (k: string) => (product[k] as string | null | undefined) ?? "";
  const T = ({ name, label, wide, area, required }: { name: string; label: string; wide?: boolean; area?: boolean; required?: boolean }) => (
    <label className={clsx("block", wide && "md:col-span-2")}>
      <span className={adminLabel}>{label}{required && " *"}</span>
      {area ? (
        <textarea name={name} defaultValue={v(name)} className={clsx(adminInput, "h-28 py-2")} />
      ) : (
        <input name={name} defaultValue={v(name)} required={required} className={adminInput} />
      )}
    </label>
  );
  const C = ({ name, label, def }: { name: string; label: string; def?: boolean }) => (
    <label className="flex items-center gap-2 text-[13px]">
      <input type="checkbox" name={name} defaultChecked={product[name] === undefined ? !!def : !!product[name]} className="accent-ink w-4 h-4" /> {label}
    </label>
  );
  return (
    <ActionForm action={saveProductAction} className="bg-white border border-line p-5">
      {product.id && <input type="hidden" name="id" value={String(product.id)} />}
      <div className="grid md:grid-cols-2 gap-x-5 gap-y-3">
        <T name="nameRu" label="Название (RU)" required />
        <T name="nameKz" label="Название (KZ)" />
        <T name="article" label="Артикул" required />
        <T name="brand" label="Бренд" />
        <label className="block">
          <span className={adminLabel}>Категория *</span>
          <select name="categoryId" defaultValue={v("categoryId")} required className={adminInput}>
            <option value="">—</option>
            {options.categories.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={adminLabel}>Статус</span>
          <select name="status" defaultValue={v("status") || "DRAFT"} className={adminInput}>
            <option value="DRAFT">Черновик (не виден покупателям)</option>
            <option value="ACTIVE">Опубликован</option>
            <option value="ARCHIVED">Архив</option>
          </select>
        </label>
        <label className="block">
          <span className={adminLabel}>Посадка</span>
          <select name="fit" defaultValue={v("fit")} className={adminInput}>
            <option value="">—</option>
            <option value="SLIM">Slim Fit</option>
            <option value="REGULAR">Regular Fit</option>
            <option value="RELAXED">Свободная</option>
          </select>
        </label>
        <label className="block">
          <span className={adminLabel}>Сезон</span>
          <select name="season" defaultValue={v("season")} className={adminInput}>
            <option value="">—</option>
            <option value="ALL_SEASON">Всесезонный</option>
            <option value="DEMI">Демисезон</option>
            <option value="WINTER">Зима</option>
            <option value="SUMMER">Лето</option>
          </select>
        </label>
        <T name="materialRu" label="Материал для фильтра (RU), напр. «Шерсть»" />
        <T name="materialKz" label="Материал (KZ)" />
        <T name="compositionRu" label="Состав (RU)" />
        <T name="compositionKz" label="Состав (KZ)" />
        <T name="descriptionRu" label="Описание (RU)" area />
        <T name="descriptionKz" label="Описание (KZ)" area />
        <T name="fitAdviceRu" label="Рекомендации по выбору размера (RU)" area />
        <T name="fitAdviceKz" label="Рекомендации по выбору размера (KZ)" area />
        <T name="careRu" label="Уход (RU)" />
        <T name="careKz" label="Уход (KZ)" />
        <label className="block">
          <span className={adminLabel}>Таблица замеров (для помощника подбора)</span>
          <select name="sizeChartId" defaultValue={v("sizeChartId")} className={adminInput}>
            <option value="">— нет —</option>
            {options.charts.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <T name="videoUrl" label="Видео (https://… .mp4)" />
        <T name="slug" label="Адрес страницы (slug) — пусто: автоматически" />
        <T name="externalId" label="ID в 1С" />
        <T name="seoTitleRu" label="SEO title (RU)" />
        <T name="seoTitleKz" label="SEO title (KZ)" />
        <T name="seoDescRu" label="SEO description (RU)" wide />
        <T name="seoDescKz" label="SEO description (KZ)" wide />
      </div>
      <div className="flex flex-wrap gap-5 mt-5">
        <C name="isNew" label="Новинка" />
        <C name="isBestseller" label="Хит продаж" />
        <C name="hasHeights" label="Есть ростовки (костюмы)" />
        <C name="isDemo" label="Демо-товар (тест)" />
      </div>
      <button className={clsx(adminBtn, "mt-6")}>{product.id ? "Сохранить" : "Создать товар"}</button>
    </ActionForm>
  );
}
