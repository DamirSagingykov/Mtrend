import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/admin-guard";
import { can } from "@/lib/permissions";
import { compareSizes } from "@/lib/format";
import { PageHeader, Card, Badge, adminInput, adminLabel } from "@/components/admin/ui";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { ProductForm } from "../product-form";
import { loadProductFormOptions } from "../form-options";
import { deleteProductAction, deleteVariantAction, generateVariantsAction, saveVariantsAction, updateImagesAction, uploadImagesAction } from "../actions";

export default async function ProductEditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const user = await requireStaffPage("products.view");
  const { id } = await params;
  const sp = await searchParams;
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      variants: { include: { color: true, stocks: true, _count: { select: { orderItems: true } } } },
    },
  });
  if (!product) notFound();
  const [options, colors, warehouses] = await Promise.all([
    loadProductFormOptions(),
    prisma.color.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.warehouse.findMany({ orderBy: { priority: "asc" } }),
  ]);
  const canEdit = can(user.role, "products.edit");
  const canStock = can(user.role, "stock.edit");
  const variants = [...product.variants].sort(
    (a, b) => a.color.sortOrder - b.color.sortOrder || compareSizes(a.size, b.size) || (a.height ?? "").localeCompare(b.height ?? ""),
  );
  const usedColors = Array.from(new Map(variants.map((v) => [v.colorId, v.color])).values());

  return (
    <div>
      <PageHeader
        title={product.nameRu}
        description={
          <span className="flex gap-2 items-center flex-wrap">
            арт. {product.article} · <Badge tone={product.status === "ACTIVE" ? "green" : "amber"}>{product.status}</Badge>
            {product.isDemo && <Badge tone="red">демо</Badge>}
            {product.status === "ACTIVE" && (
              <Link href={`/ru/product/${product.slug}`} target="_blank" className="underline">Открыть на сайте ↗</Link>
            )}
          </span>
        }
        actions={<Link href="/admin/products" className="text-sm underline">← Все товары</Link>}
      />
      {sp.created && <p className="mb-4 text-sm text-success">Товар создан. Добавьте фото и варианты, затем опубликуйте.</p>}

      <div className="space-y-6">
        <Card title="Варианты (SKU), цены и остатки по складам">
          {variants.length ? (
            <ActionForm action={saveVariantsAction}>
              <input type="hidden" name="productId" value={product.id} />
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-ink-muted">
                      <th className="font-normal pb-2 pr-2">Цвет</th>
                      <th className="font-normal pb-2 pr-2">Размер</th>
                      <th className="font-normal pb-2 pr-2">Рост</th>
                      <th className="font-normal pb-2 pr-2">SKU</th>
                      <th className="font-normal pb-2 pr-2">Цена ₸</th>
                      <th className="font-normal pb-2 pr-2">Старая цена</th>
                      {warehouses.map((w) => (
                        <th key={w.id} className="font-normal pb-2 pr-2" title={w.name}>{w.code}{!w.isActive && " (выкл)"}</th>
                      ))}
                      <th className="font-normal pb-2 pr-2">Активен</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((v) => (
                      <tr key={v.id} className="border-t border-line">
                        <td className="py-1.5 pr-2 whitespace-nowrap">
                          <span className="inline-block w-3 h-3 rounded-full border border-black/10 align-middle mr-1.5" style={{ background: v.color.hex }} />
                          {v.color.nameRu}
                        </td>
                        <td className="pr-2 font-medium">{v.size}</td>
                        <td className="pr-2">{v.height ?? "—"}</td>
                        <td className="pr-2"><input name={`sku_${v.id}`} defaultValue={v.sku} disabled={!canEdit} className={`${adminInput} w-44 font-mono text-[12px]`} /></td>
                        <td className="pr-2"><input name={`price_${v.id}`} defaultValue={v.price} disabled={!canEdit} inputMode="numeric" className={`${adminInput} w-24`} /></td>
                        <td className="pr-2"><input name={`old_${v.id}`} defaultValue={v.oldPrice ?? ""} disabled={!canEdit} inputMode="numeric" className={`${adminInput} w-24`} /></td>
                        {warehouses.map((w) => (
                          <td key={w.id} className="pr-2">
                            <input
                              name={`stock_${v.id}_${w.id}`}
                              defaultValue={v.stocks.find((s) => s.warehouseId === w.id)?.quantity ?? 0}
                              disabled={!canStock}
                              inputMode="numeric"
                              className={`${adminInput} w-16`}
                            />
                          </td>
                        ))}
                        <td className="pr-2 text-center"><input type="checkbox" name={`active_${v.id}`} defaultChecked={v.isActive} disabled={!canEdit} className="accent-ink w-4 h-4" /></td>
                        <td className="text-[11px] text-ink-muted whitespace-nowrap">{v._count.orderItems ? `в заказах: ${v._count.orderItems}` : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {canEdit && (
                <div className="mt-4 p-3 bg-milk grid sm:grid-cols-3 gap-3">
                  <label><span className={adminLabel}>Цена для всех вариантов</span><input name="bulkPrice" inputMode="numeric" className={adminInput} placeholder="не менять" /></label>
                  <label><span className={adminLabel}>Старая цена для всех (0 — убрать)</span><input name="bulkOldPrice" inputMode="numeric" className={adminInput} placeholder="не менять" /></label>
                  <label><span className={adminLabel}>Скидка % на все варианты</span><input name="bulkDiscount" inputMode="numeric" className={adminInput} placeholder="не менять" /></label>
                </div>
              )}
              <SubmitButton className="mt-4">Сохранить варианты и остатки</SubmitButton>
              {!canEdit && <p className="text-[12px] text-ink-muted mt-2">Ваша роль позволяет менять только остатки.</p>}
            </ActionForm>
          ) : (
            <p className="text-ink-muted text-sm">Вариантов пока нет — создайте их ниже.</p>
          )}

          {canEdit && (
            <details className="mt-6 border border-line" open={!variants.length}>
              <summary className="px-4 py-2.5 cursor-pointer font-medium text-[13px]">+ Добавить варианты (цвет × размер × ростовка)</summary>
              <ActionForm action={generateVariantsAction} className="p-4 space-y-3">
                <input type="hidden" name="productId" value={product.id} />
                <div>
                  <span className={adminLabel}>Цвета</span>
                  <div className="flex flex-wrap gap-3">
                    {colors.map((c) => (
                      <label key={c.id} className="flex items-center gap-1.5 text-[13px]">
                        <input type="checkbox" name="colors" value={c.id} className="accent-ink" />
                        <span className="w-3 h-3 rounded-full border border-black/10" style={{ background: c.hex }} />
                        {c.nameRu}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid sm:grid-cols-4 gap-3">
                  <label><span className={adminLabel}>Размеры (через запятую)</span><input name="sizes" placeholder="48, 50, 52, 54" className={adminInput} /></label>
                  <label><span className={adminLabel}>Ростовки (если есть)</span><input name="heights" placeholder="176, 182, 188" className={adminInput} /></label>
                  <label><span className={adminLabel}>Цена ₸</span><input name="price" inputMode="numeric" className={adminInput} /></label>
                  <label><span className={adminLabel}>Старая цена ₸</span><input name="oldPrice" inputMode="numeric" className={adminInput} /></label>
                </div>
                <SubmitButton>Создать варианты</SubmitButton>
                <p className="text-[11px] text-ink-muted">Существующие комбинации пропускаются. SKU формируется как АРТИКУЛ-ЦВЕТ-РАЗМЕР-РОСТ, его можно изменить в таблице.</p>
              </ActionForm>
              {variants.length > 0 && (
                <ActionForm action={deleteVariantAction} confirm="Удалить вариант?" className="p-4 pt-0 flex gap-2 items-end">
                  <label className="flex-1 max-w-sm">
                    <span className={adminLabel}>Удалить вариант</span>
                    <select name="variantId" className={adminInput}>
                      {variants.map((v) => (
                        <option key={v.id} value={v.id}>{v.sku}</option>
                      ))}
                    </select>
                  </label>
                  <SubmitButton className="!bg-white !text-danger border border-line">Удалить</SubmitButton>
                </ActionForm>
              )}
            </details>
          )}
        </Card>

        <Card title={`Фотографии (${product.images.length})`}>
          {product.images.length > 0 && (
            <ActionForm action={updateImagesAction}>
              <input type="hidden" name="productId" value={product.id} />
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {product.images.map((img) => (
                  <div key={img.id} className="border border-line p-2 text-[12px] space-y-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt="" className="w-full aspect-[3/4] object-cover bg-milk" />
                    <input name={`sort_${img.id}`} defaultValue={img.sortOrder} disabled={!canEdit} className={adminInput} title="Порядок" />
                    <select name={`color_${img.id}`} defaultValue={img.colorId ?? ""} disabled={!canEdit} className={adminInput}>
                      <option value="">Все цвета</option>
                      {usedColors.map((c) => (
                        <option key={c.id} value={c.id}>{c.nameRu}</option>
                      ))}
                    </select>
                    <input name={`alt_${img.id}`} defaultValue={img.altRu ?? ""} placeholder="alt-текст" disabled={!canEdit} className={adminInput} />
                    {canEdit && (
                      <label className="flex items-center gap-1 text-danger"><input type="checkbox" name="delete" value={img.id} /> удалить</label>
                    )}
                  </div>
                ))}
              </div>
              {canEdit && <SubmitButton className="mt-3">Сохранить фото</SubmitButton>}
            </ActionForm>
          )}
          {canEdit && (
            <ActionForm action={uploadImagesAction} resetOnSuccess className="mt-5 flex flex-wrap gap-3 items-end">
              <input type="hidden" name="productId" value={product.id} />
              <label>
                <span className={adminLabel}>Загрузить фото (JPEG/PNG/WebP, до 15 МБ, можно несколько)</span>
                <input type="file" name="files" multiple accept="image/jpeg,image/png,image/webp,image/avif" className="text-[13px]" />
              </label>
              <label>
                <span className={adminLabel}>Цвет</span>
                <select name="colorId" className={`${adminInput} w-44`}>
                  <option value="">Все цвета</option>
                  {usedColors.map((c) => (
                    <option key={c.id} value={c.id}>{c.nameRu}</option>
                  ))}
                </select>
              </label>
              <SubmitButton>Загрузить</SubmitButton>
            </ActionForm>
          )}
        </Card>

        {canEdit ? (
          <ProductForm product={JSON.parse(JSON.stringify(product))} options={options} />
        ) : (
          <Card title="Информация"><p className="text-sm text-ink-muted">Редактирование карточки доступно администратору.</p></Card>
        )}

        {canEdit && (
          <ActionForm action={deleteProductAction} confirm="Удалить товар? Если товар есть в заказах, он будет перемещён в архив.">
            <input type="hidden" name="id" value={product.id} />
            <button className="text-sm text-danger underline">Удалить товар</button>
          </ActionForm>
        )}
      </div>
    </div>
  );
}
