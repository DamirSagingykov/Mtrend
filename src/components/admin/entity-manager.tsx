import { prisma } from "@/lib/db";
import { entities, type EntityConfig } from "@/lib/admin/entities";
import { formatDate, formatPrice } from "@/lib/format";
import { EntityForm, type ClientField } from "./entity-form";
import { PageHeader, Badge } from "./ui";
import { deleteEntityAction, saveEntityAction } from "@/app/admin/(panel)/entity-actions";

async function clientFields(cfg: EntityConfig): Promise<ClientField[]> {
  return Promise.all(
    cfg.fields.map(async (f) => ({
      name: f.name,
      label: f.label,
      type: f.type,
      required: f.required,
      wide: f.wide,
      help: f.help,
      nullable: f.nullable,
      options: f.options ?? (f.optionsLoader ? await f.optionsLoader() : undefined),
    })),
  );
}

function plain(row: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(row)) as Record<string, unknown>;
}

export async function EntityManager({ entityKey }: { entityKey: string }) {
  const cfg = entities[entityKey];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: Record<string, unknown>[] = await (prisma as any)[cfg.model].findMany({
    orderBy: cfg.orderBy,
    ...(cfg.model === "look" ? { include: { items: { orderBy: { sortOrder: "asc" }, include: { product: { select: { article: true } } } } } } : {}),
  });
  const fields = await clientFields(cfg);
  const optionLabel = (name: string, value: unknown) => fields.find((f) => f.name === name)?.options?.find((o) => o.value === value)?.label ?? (value ? String(value) : "—");

  const cell = (col: EntityConfig["columns"][number], row: Record<string, unknown>) => {
    const v = row[col.name];
    switch (col.type) {
      case "checkbox":
        return v ? <Badge tone="green">да</Badge> : <Badge>нет</Badge>;
      case "money":
        return v === null || v === undefined ? "—" : formatPrice(Number(v));
      case "datetime":
        return v ? formatDate(v as Date, "ru", true) : "—";
      case "list":
        return Array.isArray(v) && v.length ? v.join(", ") : "все";
      case "image":
        // eslint-disable-next-line @next/next/no-img-element
        return v ? <img src={String(v)} alt="" className="h-10 w-16 object-cover bg-milk" /> : "—";
      case "color":
        return <span className="inline-block w-5 h-5 rounded-full border border-black/10" style={{ background: String(v) }} />;
      case "select":
        return optionLabel(col.name, v);
      default:
        return v === null || v === undefined || v === "" ? "—" : String(v);
    }
  };

  const lookExtra = (row?: Record<string, unknown>) =>
    cfg.model === "look" ? (
      <label className="block">
        <span className="block text-[11px] uppercase tracking-[0.1em] text-ink-muted mb-1">Артикулы товаров (через запятую)</span>
        <input
          name="__articles"
          defaultValue={row ? ((row.items as { product: { article: string } }[]) ?? []).map((i) => i.product.article).join(", ") : ""}
          className="w-full h-9 px-2.5 border border-line bg-white text-[13px]"
        />
      </label>
    ) : undefined;

  return (
    <div>
      <PageHeader title={cfg.title} description={cfg.description} />
      <details className="bg-white border border-line mb-6">
        <summary className="px-5 py-3 cursor-pointer font-medium">+ Добавить {cfg.singular}</summary>
        <div className="p-5 border-t border-line">
          <EntityForm entity={cfg.key} fields={fields} values={{}} save={saveEntityAction} extra={lookExtra()} />
        </div>
      </details>

      <div className="bg-white border border-line overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-[#fafaf9] border-b border-line">
              {cfg.columns.map((c) => (
                <th key={c.name} className="text-left font-medium text-ink-muted px-3 py-2.5 whitespace-nowrap">{c.label}</th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const row = plain(r);
              return (
                <tr key={String(row.id)} className="border-b border-line last:border-0 align-top">
                  {cfg.columns.map((c) => (
                    <td key={c.name} className="px-3 py-2.5">{cell(c, row)}</td>
                  ))}
                  <td className="px-3 py-2.5 text-right">
                    <details className="inline-block text-left [&[open]]:block">
                      <summary className="cursor-pointer text-ink-muted underline list-none">Изменить</summary>
                      <div className="mt-3 p-4 border border-line bg-[#fcfbfa] min-w-[min(720px,85vw)]">
                        <EntityForm entity={cfg.key} id={String(row.id)} fields={fields} values={row} save={saveEntityAction} remove={cfg.deletable ? deleteEntityAction : undefined} extra={lookExtra(row)} />
                      </div>
                    </details>
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={cfg.columns.length + 1} className="px-3 py-8 text-center text-ink-muted">Записей нет</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
