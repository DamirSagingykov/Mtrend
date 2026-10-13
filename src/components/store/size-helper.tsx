"use client";

import { useState } from "react";
import clsx from "clsx";
import { useI18n } from "./providers";
import { WhatsAppIcon } from "./whatsapp-button";
import { recommendSize, type FitPreference, type SizeRecommendation } from "@/lib/size-recommender";
import type { ChartInfo } from "./product-detail";

export function SizeHelper({
  chart,
  fit,
  waHref,
  onPick,
}: {
  chart: ChartInfo;
  fit: "SLIM" | "REGULAR" | "RELAXED" | null;
  waHref: string | null;
  onPick: (size: string, height: string | null) => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState({ height: "", weight: "", chest: "", waist: "" });
  const [pref, setPref] = useState<FitPreference>("regular");
  const [result, setResult] = useState<SizeRecommendation | null | "none">(null);
  const [error, setError] = useState<string | null>(null);

  const n = (v: string) => {
    const x = parseFloat(v.replace(",", "."));
    return Number.isFinite(x) && x > 0 ? x : undefined;
  };

  const calc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chart?.rows.length) return;
    const input = { height: n(form.height), weight: n(form.weight), chest: n(form.chest), waist: n(form.waist), preference: pref, modelFit: fit };
    if (!input.height || (!input.chest && !input.waist)) {
      setError(t.sizeHelper.fillAtLeast);
      return;
    }
    setError(null);
    const r = recommendSize(chart.rows, input);
    setResult(r ?? "none");
    if (r) onPick(r.size, r.height);
  };

  return (
    <div>
      <h2 className="font-display text-3xl">{t.sizeHelper.title}</h2>
      {!chart?.rows.length ? (
        <div className="mt-4">
          <p className="text-sm text-ink-muted">{t.sizeHelper.noChart}</p>
          {waHref && <WaButton href={waHref} label={t.sizeHelper.consult} />}
        </div>
      ) : (
        <>
          <p className="text-sm text-ink-muted mt-2">{t.sizeHelper.intro}</p>
          {fit === "SLIM" && <p className="text-xs mt-3 bg-milk p-3">{t.sizeHelper.slimNote}</p>}
          {fit === "REGULAR" && <p className="text-xs mt-3 bg-milk p-3">{t.sizeHelper.regularNote}</p>}
          {chart.isDemo && <p className="text-xs text-danger mt-3">{t.sizeHelper.chartDemo}</p>}
          <form onSubmit={calc} className="mt-6 grid grid-cols-2 gap-4">
            {(["height", "weight", "chest", "waist"] as const).map((k) => (
              <label key={k}>
                <span className="label">{t.sizeHelper[k]}</span>
                <input
                  className="input"
                  inputMode="decimal"
                  value={form[k]}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value.replace(/[^\d.,]/g, "") })}
                  placeholder={k === "height" ? "180" : k === "weight" ? "80" : k === "chest" ? "100" : "88"}
                />
              </label>
            ))}
            <fieldset className="col-span-2">
              <legend className="label">{t.sizeHelper.preference}</legend>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    ["fitted", t.sizeHelper.prefFitted],
                    ["regular", t.sizeHelper.prefRegular],
                    ["loose", t.sizeHelper.prefLoose],
                  ] as const
                ).map(([v, label]) => (
                  <button type="button" key={v} onClick={() => setPref(v)} className={clsx("h-11 border text-sm", pref === v ? "bg-ink text-white border-ink" : "border-line")}>
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            {error && <p className="col-span-2 text-sm text-danger">{error}</p>}
            <button className="btn-primary col-span-2">{t.sizeHelper.calculate}</button>
          </form>

          {result && (
            <div className="mt-6 border border-ink p-5 animate-fade-up">
              {result === "none" ? (
                <p className="text-sm">{t.sizeHelper.confidenceLow}</p>
              ) : (
                <>
                  <div className="eyebrow">{t.sizeHelper.result}</div>
                  <div className="font-display text-5xl mt-1">
                    {result.size}
                    {result.height && <span className="text-2xl text-ink-muted"> / {t.sizeHelper.heightResult} {result.height}</span>}
                  </div>
                  {result.alternative && <div className="text-sm text-ink-muted mt-1">≈ {result.alternative}</div>}
                  <p className={clsx("text-sm mt-3", result.confidence === "high" ? "text-success" : result.confidence === "medium" ? "text-wood-dark" : "text-danger")}>
                    {result.confidence === "high" ? t.sizeHelper.confidenceHigh : result.confidence === "medium" ? t.sizeHelper.confidenceMid : t.sizeHelper.confidenceLow}
                  </p>
                </>
              )}
              <p className="text-xs text-ink-muted mt-4">{t.sizeHelper.disclaimer}</p>
            </div>
          )}
          {waHref && <WaButton href={waHref} label={t.sizeHelper.consult} />}
        </>
      )}
    </div>
  );
}

function WaButton({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="mt-6 h-12 w-full flex items-center justify-center gap-2 text-sm bg-[#25D366] text-white">
      <WhatsAppIcon className="w-5 h-5" /> {label}
    </a>
  );
}
