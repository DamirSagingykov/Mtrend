"use client";

import clsx from "clsx";
import { ActionForm, type ActionResult } from "./action-form";
import { adminBtn, adminBtnOutline, adminInput, adminLabel } from "./ui-classes";

export type ClientField = {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  wide?: boolean;
  help?: string;
  options?: { value: string; label: string }[];
  nullable?: boolean;
};

function toInputDate(v: unknown) {
  if (!v) return "";
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EntityForm({
  entity,
  id,
  fields,
  values,
  save,
  remove,
  extra,
}: {
  entity: string;
  id?: string;
  fields: ClientField[];
  values: Record<string, unknown>;
  save: (p: ActionResult, fd: FormData) => Promise<ActionResult>;
  remove?: (p: ActionResult, fd: FormData) => Promise<ActionResult>;
  extra?: React.ReactNode;
}) {
  return (
    <div>
      <ActionForm action={save} resetOnSuccess={!id} className="grid sm:grid-cols-2 gap-x-4 gap-y-3">
        <input type="hidden" name="__entity" value={entity} />
        {id && <input type="hidden" name="__id" value={id} />}
        {fields.map((f) => {
          const v = values[f.name];
          const common = { name: f.name, required: f.required && f.type !== "image" };
          return (
            <label key={f.name} className={clsx("block", (f.wide || f.type === "markdown" || f.type === "textarea") && "sm:col-span-2", f.type === "checkbox" && "flex items-center gap-2 self-end h-9")}>
              {f.type === "checkbox" ? (
                <>
                  <input type="checkbox" name={f.name} defaultChecked={v === undefined ? true : !!v} className="accent-ink w-4 h-4" />
                  <span className="text-[13px]">{f.label}</span>
                </>
              ) : (
                <>
                  <span className={adminLabel}>
                    {f.label}
                    {f.required && " *"}
                  </span>
                  {f.type === "textarea" || f.type === "markdown" ? (
                    <textarea {...common} defaultValue={(v as string) ?? ""} className={clsx(adminInput, "h-auto py-2", f.type === "markdown" ? "min-h-[220px] font-mono text-[12px]" : "min-h-[80px]")} />
                  ) : f.type === "select" ? (
                    <select {...common} defaultValue={(v as string) ?? ""} className={adminInput}>
                      {(f.nullable || !v) && <option value="">—</option>}
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : f.type === "image" ? (
                    <div className="space-y-1.5">
                      {typeof v === "string" && v && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={v} alt="" className="h-20 w-auto border border-line object-cover bg-milk" />
                      )}
                      <input name={f.name} defaultValue={(v as string) ?? ""} placeholder="URL или загрузите файл" className={adminInput} />
                      <input type="file" name={`${f.name}__file`} accept="image/jpeg,image/png,image/webp,image/avif" className="text-xs" />
                    </div>
                  ) : f.type === "datetime" ? (
                    <input type="datetime-local" {...common} defaultValue={toInputDate(v)} className={adminInput} />
                  ) : f.type === "color" ? (
                    <input type="color" {...common} defaultValue={(v as string) || "#cccccc"} className="h-9 w-20 border border-line" />
                  ) : f.type === "list" ? (
                    <input {...common} defaultValue={Array.isArray(v) ? v.join(", ") : ""} className={adminInput} />
                  ) : (
                    <input
                      {...common}
                      inputMode={f.type === "int" || f.type === "money" || f.type === "float" ? "decimal" : undefined}
                      defaultValue={v === null || v === undefined ? "" : String(v)}
                      className={adminInput}
                    />
                  )}
                  {f.help && <span className="text-[11px] text-ink-muted">{f.help}</span>}
                </>
              )}
            </label>
          );
        })}
        {extra && <div className="sm:col-span-2">{extra}</div>}
        <div className="sm:col-span-2 flex gap-2 pt-2">
          <button className={adminBtn}>{id ? "Сохранить" : "Создать"}</button>
        </div>
      </ActionForm>
      {id && remove && (
        <ActionForm action={remove} confirm="Удалить запись? Действие необратимо." className="mt-3">
          <input type="hidden" name="__entity" value={entity} />
          <input type="hidden" name="__id" value={id} />
          <button className={clsx(adminBtnOutline, "text-danger")}>Удалить</button>
        </ActionForm>
      )}
    </div>
  );
}
