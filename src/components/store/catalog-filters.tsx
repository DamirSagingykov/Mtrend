"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { SlidersHorizontal, X, Check } from "lucide-react";
import clsx from "clsx";
import { useI18n } from "./providers";
import type { Facets } from "@/lib/catalog";
import { pick } from "@/i18n/config";

type Props = { facets: Facets; total: number; lockNew?: boolean; lockSale?: boolean };

export function CatalogToolbar({ facets, total, lockNew, lockSale }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const activeCount = ["size", "color", "fit", "season", "material", "price_min", "price_max", "in_stock", "sale", "new"].reduce(
    (n, k) => n + sp.getAll(k).flatMap((v) => v.split(",")).filter(Boolean).length,
    0,
  );

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const setSort = (sort: string) => {
    const next = new URLSearchParams(sp.toString());
    next.set("sort", sort);
    next.delete("page");
    start(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  return (
    <>
      <div className={clsx("flex items-center justify-between gap-3 py-3 border-y border-line mb-6 md:mb-8 sticky top-14 md:top-[72px] bg-white z-30", pending && "opacity-60")}>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 text-[12px] uppercase tracking-[0.14em] h-10 lg:hidden">
          <SlidersHorizontal className="w-4 h-4" strokeWidth={1.5} />
          {t.catalog.filters}
          {activeCount > 0 && <span className="bg-ink text-white rounded-full w-5 h-5 text-[10px] flex items-center justify-center">{activeCount}</span>}
        </button>
        <span className="hidden lg:block text-sm text-ink-muted">
          {total} {t.catalog.products}
        </span>
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only md:not-sr-only text-ink-muted">{t.catalog.sort}:</span>
          <select
            value={sp.get("sort") || "popular"}
            onChange={(e) => setSort(e.target.value)}
            className="h-10 bg-transparent pr-2 text-[13px] focus:outline-none cursor-pointer"
          >
            {Object.entries(t.catalog.sortOptions).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>

      {open && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 top-12 bg-white flex flex-col animate-slide-up rounded-t-xl">
            <div className="flex items-center justify-between h-14 px-4 border-b border-line">
              <span className="text-[12px] uppercase tracking-[0.16em]">{t.catalog.filters}</span>
              <button onClick={() => setOpen(false)} className="p-2 -mr-2" aria-label={t.nav.close}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <FiltersForm facets={facets} total={total} onDone={() => setOpen(false)} lockNew={lockNew} lockSale={lockSale} mobile />
          </div>
        </div>
      )}
    </>
  );
}

export function FiltersSidebar(props: Props) {
  return (
    <aside className="hidden lg:block w-64 shrink-0">
      <div className="sticky top-[150px] max-h-[calc(100vh-170px)] overflow-y-auto pr-3 no-scrollbar">
        <FiltersForm {...props} />
      </div>
    </aside>
  );
}

function FiltersForm({ facets, onDone, lockNew, lockSale, mobile }: Props & { onDone?: () => void; mobile?: boolean }) {
  const { t, locale } = useI18n();
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [, start] = useTransition();

  const read = (k: string) => sp.getAll(k).flatMap((v) => v.split(",")).filter(Boolean);
  const [state, setState] = useState(() => ({
    size: read("size"),
    color: read("color"),
    fit: read("fit"),
    season: read("season"),
    material: read("material"),
    price_min: sp.get("price_min") ?? "",
    price_max: sp.get("price_max") ?? "",
    in_stock: sp.get("in_stock") === "1",
    sale: sp.get("sale") === "1",
    new: sp.get("new") === "1",
  }));

  useEffect(() => {
    setState({
      size: read("size"),
      color: read("color"),
      fit: read("fit"),
      season: read("season"),
      material: read("material"),
      price_min: sp.get("price_min") ?? "",
      price_max: sp.get("price_max") ?? "",
      in_stock: sp.get("in_stock") === "1",
      sale: sp.get("sale") === "1",
      new: sp.get("new") === "1",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  const apply = (s: typeof state) => {
    const next = new URLSearchParams();
    const keep = ["q", "sort"];
    for (const k of keep) {
      const v = sp.get(k);
      if (v) next.set(k, v);
    }
    for (const k of ["size", "color", "fit", "season", "material"] as const) if (s[k].length) next.set(k, s[k].join(","));
    if (s.price_min) next.set("price_min", s.price_min);
    if (s.price_max) next.set("price_max", s.price_max);
    if (s.in_stock) next.set("in_stock", "1");
    if (s.sale) next.set("sale", "1");
    if (s.new) next.set("new", "1");
    const qs = next.toString();
    start(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  const update = (patch: Partial<typeof state>) => {
    const s = { ...state, ...patch };
    setState(s);
    if (!mobile) apply(s);
  };

  const toggle = (key: "size" | "color" | "fit" | "season" | "material", value: string) => {
    const arr = state[key];
    update({ [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value] } as Partial<typeof state>);
  };

  const reset = () => {
    const s = { size: [], color: [], fit: [], season: [], material: [], price_min: "", price_max: "", in_stock: false, sale: false, new: false };
    setState(s);
    apply(s);
    onDone?.();
  };

  return (
    <div className={clsx("flex flex-col", mobile && "flex-1 min-h-0")}>
      <div className={clsx("space-y-7", mobile && "flex-1 overflow-y-auto p-4")}>
        <Group title={t.catalog.availability}>
          <Toggle checked={state.in_stock} onChange={(v) => update({ in_stock: v })} label={t.catalog.inStock} />
          {!lockSale && <Toggle checked={state.sale} onChange={(v) => update({ sale: v })} label={t.catalog.onSale} />}
          {!lockNew && <Toggle checked={state.new} onChange={(v) => update({ new: v })} label={t.catalog.newOnly} />}
        </Group>

        {facets.sizes.length > 0 && (
          <Group title={t.catalog.size}>
            <div className="flex flex-wrap gap-1.5">
              {facets.sizes.map((s) => (
                <button key={s} onClick={() => toggle("size", s)} className={clsx("chip min-w-[44px] justify-center", state.size.includes(s) && "chip-active")}>
                  {s}
                </button>
              ))}
            </div>
          </Group>
        )}

        {facets.colors.length > 0 && (
          <Group title={t.catalog.color}>
            <div className="grid grid-cols-2 gap-1">
              {facets.colors.map((c) => {
                const on = state.color.includes(c.code);
                return (
                  <button key={c.code} onClick={() => toggle("color", c.code)} className="flex items-center gap-2 py-1.5 text-sm text-left">
                    <span className={clsx("w-5 h-5 rounded-full border flex items-center justify-center", on ? "ring-1 ring-ink ring-offset-2" : "border-black/10")} style={{ background: c.hex }}>
                      {on && <Check className="w-3 h-3 mix-blend-difference text-white" />}
                    </span>
                    <span className={clsx(on && "font-medium")}>{pick(locale, c.nameRu, c.nameKz)}</span>
                  </button>
                );
              })}
            </div>
          </Group>
        )}

        <Group title={t.catalog.price}>
          <div className="flex items-center gap-2">
            <input
              inputMode="numeric"
              className="input h-10 text-sm"
              placeholder={`${t.catalog.from} ${facets.priceMin}`}
              value={state.price_min}
              onChange={(e) => setState({ ...state, price_min: e.target.value.replace(/\D/g, "") })}
              onBlur={() => !mobile && apply(state)}
              onKeyDown={(e) => e.key === "Enter" && !mobile && apply(state)}
            />
            <span className="text-ink-muted">—</span>
            <input
              inputMode="numeric"
              className="input h-10 text-sm"
              placeholder={`${t.catalog.to} ${facets.priceMax}`}
              value={state.price_max}
              onChange={(e) => setState({ ...state, price_max: e.target.value.replace(/\D/g, "") })}
              onBlur={() => !mobile && apply(state)}
              onKeyDown={(e) => e.key === "Enter" && !mobile && apply(state)}
            />
          </div>
        </Group>

        {facets.fits.length > 0 && (
          <Group title={t.catalog.fit}>
            {facets.fits.map((f) => (
              <Toggle key={f} checked={state.fit.includes(f)} onChange={() => toggle("fit", f)} label={t.fit[f]} />
            ))}
          </Group>
        )}

        {facets.seasons.length > 0 && (
          <Group title={t.catalog.season}>
            {facets.seasons.map((s) => (
              <Toggle key={s} checked={state.season.includes(s)} onChange={() => toggle("season", s)} label={t.season[s]} />
            ))}
          </Group>
        )}

        {facets.materials.length > 0 && (
          <Group title={t.catalog.material}>
            {facets.materials.map((m) => (
              <Toggle key={m.ru} checked={state.material.includes(m.ru)} onChange={() => toggle("material", m.ru)} label={locale === "kz" ? m.kz : m.ru} />
            ))}
          </Group>
        )}
      </div>

      <div className={clsx("flex gap-2", mobile ? "p-4 border-t border-line pb-safe" : "mt-8")}>
        <button onClick={reset} className={clsx(mobile ? "btn-outline flex-1" : "text-[12px] uppercase tracking-[0.14em] underline underline-offset-4")}>
          {t.catalog.reset}
        </button>
        {mobile && (
          <button
            onClick={() => {
              apply(state);
              onDone?.();
            }}
            className="btn-primary flex-1"
          >
            {t.catalog.apply}
          </button>
        )}
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="eyebrow mb-3 text-ink">{title}</legend>
      <div className="space-y-1">{children}</div>
    </fieldset>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 py-1.5 text-sm cursor-pointer select-none">
      <span className={clsx("w-[18px] h-[18px] border flex items-center justify-center transition-colors", checked ? "bg-ink border-ink" : "border-ink/30")}>
        {checked && <Check className="w-3 h-3 text-white" strokeWidth={2.5} />}
      </span>
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
