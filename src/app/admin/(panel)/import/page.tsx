import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/admin-guard";
import { formatDate } from "@/lib/format";
import { IMPORT_TEMPLATE_COLUMNS } from "@/lib/import/catalog-import";
import { PageHeader, Card, Badge, adminInput, adminBtnOutline } from "@/components/admin/ui";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { deleteDemoProductsAction, importFileAction } from "./actions";

export default async function ImportPage() {
  await requireStaffPage("import.run");
  const [logs, demoCount, warehouses] = await Promise.all([
    prisma.integrationLog.findMany({ where: { source: { in: ["csv", "xlsx"] } }, orderBy: { createdAt: "desc" }, take: 15 }),
    prisma.product.count({ where: { isDemo: true } }),
    prisma.warehouse.findMany({ orderBy: { priority: "asc" } }),
  ]);
  return (
    <div>
      <PageHeader title="Импорт и экспорт" description="Массовая загрузка каталога из Excel/CSV: одна строка — один SKU (цвет × размер × ростовка). Товары группируются по артикулу." />
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Импорт каталога (Excel / CSV)">
          <ActionForm action={importFileAction} className="space-y-3">
            <input type="file" name="file" accept=".xlsx,.csv" required className="text-[13px]" />
            <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" name="dryRun" defaultChecked className="accent-ink" /> Только проверить (без записи в базу)</label>
            <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" name="subtractPending" defaultChecked className="accent-ink" /> Вычитать товары в заказах сайта, ещё не переданных в 1С</label>
            <SubmitButton>Загрузить</SubmitButton>
          </ActionForm>
          <div className="mt-5 text-[12px] text-ink-muted space-y-2">
            <p>
              <a className={adminBtnOutline} href="/api/admin/export/template">Скачать шаблон .xlsx</a>{" "}
              <a className={adminBtnOutline} href="/api/admin/export/products">Экспорт каталога .xlsx</a>
            </p>
            <p>Колонки: {IMPORT_TEMPLATE_COLUMNS.join(", ")}.</p>
            <p>
              Остатки: колонки <code>stock_КОДСКЛАДА</code> (сейчас: {warehouses.map((w) => `stock_${w.code}`).join(", ")}). Значение — абсолютное количество. Цвет создаётся автоматически по <code>colorCode</code>.
              Категория — slug из раздела «Категории». <code>season</code>: ALL_SEASON / DEMI / WINTER / SUMMER, <code>fit</code>: SLIM / REGULAR / RELAXED, <code>publish</code>: 1 — сразу опубликовать.
            </p>
            <p>Новые товары без <code>publish=1</code> создаются черновиками — добавьте фото и опубликуйте.</p>
          </div>
        </Card>

        <Card title="Экспорт">
          <div className="flex flex-wrap gap-2">
            <a className={adminBtnOutline} href="/api/admin/export/orders?format=xlsx">Заказы .xlsx</a>
            <a className={adminBtnOutline} href="/api/admin/export/orders?format=csv">Заказы .csv</a>
            <a className={adminBtnOutline} href="/api/admin/export/products">Каталог и остатки .xlsx</a>
            <a className={adminBtnOutline} href="/api/admin/export/subscribers">Подписчики .csv</a>
          </div>
          {demoCount > 0 && (
            <div className="mt-8 border border-danger/30 p-4">
              <div className="font-medium text-danger">Демо-товары: {demoCount}</div>
              <p className="text-[12px] text-ink-muted mt-1">Перед запуском продаж удалите демонстрационные товары. Товары из тестовых заказов будут архивированы.</p>
              <ActionForm action={deleteDemoProductsAction} className="mt-3 flex gap-2">
                <input name="confirm" placeholder="Введите УДАЛИТЬ" className={`${adminInput} max-w-[180px]`} />
                <SubmitButton className="!bg-danger">Удалить демо-товары</SubmitButton>
              </ActionForm>
            </div>
          )}
        </Card>
      </div>

      <Card title="История импорта" className="mt-4">
        <ul className="space-y-2 text-[13px]">
          {logs.map((l) => (
            <li key={l.id} className="border-b border-line pb-2">
              <span className="text-ink-muted">{formatDate(l.createdAt, "ru", true)}</span> · <Badge tone={l.status === "success" ? "green" : l.status === "partial" ? "amber" : "red"}>{l.status}</Badge> {l.message}
              {Array.isArray(l.errors) && l.errors.length > 0 && (
                <details className="mt-1 text-[12px]">
                  <summary className="cursor-pointer text-ink-muted">Ошибки ({l.errors.length})</summary>
                  <ul className="mt-1 space-y-0.5">
                    {(l.errors as { ref: string; message: string }[]).slice(0, 100).map((e, i) => (
                      <li key={i}>• {e.ref}: {e.message}</li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          ))}
          {!logs.length && <li className="text-ink-muted">Импортов ещё не было</li>}
        </ul>
      </Card>
    </div>
  );
}
