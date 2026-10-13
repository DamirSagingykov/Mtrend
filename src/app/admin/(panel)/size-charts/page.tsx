import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/admin-guard";
import { chartToCsv, normalizeChartRows } from "@/lib/size-recommender";
import { PageHeader, Card, Badge, adminInput, adminLabel } from "@/components/admin/ui";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { deleteChartAction, saveChartAction } from "./actions";

const HELP = `Формат: первая строка — заголовки, разделитель «;». Все размеры в сантиметрах.
Колонки: size (обязательно), height (ростовка), chestMin, chestMax, waistMin, waistMax, heightMin, heightMax, weightMin, weightMax, hipsMin, hipsMax.
Пример:
size;height;chestMin;chestMax;waistMin;waistMax;heightMin;heightMax
50;176;98;101;84;87;170;178
50;182;98;101;84;87;179;185`;

export default async function SizeChartsPage() {
  await requireStaffPage("catalog.edit");
  const charts = await prisma.sizeChart.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { products: true } } } });
  const Form = ({ c }: { c?: (typeof charts)[number] }) => (
    <ActionForm action={saveChartAction} className="grid md:grid-cols-2 gap-3">
      {c && <input type="hidden" name="id" value={c.id} />}
      <label><span className={adminLabel}>Название (видно только в админке)</span><input name="name" defaultValue={c?.name} required className={adminInput} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className={adminLabel}>Тип изделия</span>
          <select name="kind" defaultValue={c?.kind ?? "GENERIC"} className={adminInput}>
            {["SUIT", "JACKET", "TROUSERS", "SHIRT", "KNIT", "OUTERWEAR", "SHOES", "GENERIC"].map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <label>
          <span className={adminLabel}>Посадка</span>
          <select name="fit" defaultValue={c?.fit ?? ""} className={adminInput}>
            <option value="">—</option>
            <option value="SLIM">Slim</option>
            <option value="REGULAR">Regular</option>
            <option value="RELAXED">Relaxed</option>
          </select>
        </label>
      </div>
      <label className="md:col-span-2">
        <span className={adminLabel}>Замеры модели (CSV)</span>
        <textarea name="csv" defaultValue={c ? chartToCsv(normalizeChartRows(c.rows)) : ""} required className={`${adminInput} h-48 py-2 font-mono text-[12px]`} />
      </label>
      <label><span className={adminLabel}>Примечание для покупателя (RU)</span><textarea name="notesRu" defaultValue={c?.notesRu ?? ""} className={`${adminInput} h-16 py-2`} /></label>
      <label><span className={adminLabel}>Примечание (KZ)</span><textarea name="notesKz" defaultValue={c?.notesKz ?? ""} className={`${adminInput} h-16 py-2`} /></label>
      <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" name="isDemo" defaultChecked={c?.isDemo ?? false} className="accent-ink" /> Демонстрационная таблица (покупатель увидит предупреждение)</label>
      <div className="md:col-span-2"><SubmitButton>{c ? "Сохранить" : "Создать таблицу"}</SubmitButton></div>
    </ActionForm>
  );
  return (
    <div>
      <PageHeader
        title="Таблицы размеров"
        description="Реальные замеры каждой модели. Помощник подбора размера на сайте работает только по таблице, привязанной к товару — универсальные сетки не используются."
      />
      <Card title="Новая таблица" className="mb-6">
        <pre className="text-[11px] bg-milk p-3 mb-4 whitespace-pre-wrap">{HELP}</pre>
        <Form />
      </Card>
      <div className="space-y-3">
        {charts.map((c) => (
          <details key={c.id} className="bg-white border border-line">
            <summary className="px-5 py-3 cursor-pointer flex gap-3 items-center">
              <span className="font-medium">{c.name}</span>
              <Badge>{c.kind}</Badge>
              {c.fit && <Badge tone="blue">{c.fit}</Badge>}
              {c.isDemo && <Badge tone="red">демо</Badge>}
              <span className="text-ink-muted text-[12px]">строк: {normalizeChartRows(c.rows).length} · товаров: {c._count.products}</span>
            </summary>
            <div className="p-5 border-t border-line">
              <Form c={c} />
              <ActionForm action={deleteChartAction} confirm="Удалить таблицу? Товары останутся без таблицы замеров." className="mt-3">
                <input type="hidden" name="id" value={c.id} />
                <button className="text-sm text-danger underline">Удалить таблицу</button>
              </ActionForm>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
