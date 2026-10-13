/**
 * Помощник подбора размера.
 * Работает ТОЛЬКО по таблице замеров конкретной модели (SizeChart.rows), загруженной администратором.
 * Никаких «универсальных» размерных сеток: если таблицы нет — рекомендация не выдаётся.
 */

export type SizeChartRow = {
  size: string;
  height?: string | null; // ростовка (для костюмов)
  chestMin?: number | null;
  chestMax?: number | null;
  waistMin?: number | null;
  waistMax?: number | null;
  heightMin?: number | null;
  heightMax?: number | null;
  weightMin?: number | null;
  weightMax?: number | null;
  hipsMin?: number | null;
  hipsMax?: number | null;
};

export type FitPreference = "fitted" | "regular" | "loose";

export type SizeInput = {
  height?: number;
  weight?: number;
  chest?: number;
  waist?: number;
  preference: FitPreference;
  modelFit?: "SLIM" | "REGULAR" | "RELAXED" | null;
};

export type SizeRecommendation = {
  size: string;
  height: string | null;
  confidence: "high" | "medium" | "low";
  /** подробности по каждому параметру: попадает ли в диапазон */
  matches: { param: "chest" | "waist" | "height" | "weight"; inRange: boolean }[];
  alternative: string | null;
};

export const chartColumns = [
  "size",
  "height",
  "chestMin",
  "chestMax",
  "waistMin",
  "waistMax",
  "heightMin",
  "heightMax",
  "weightMin",
  "weightMax",
  "hipsMin",
  "hipsMax",
] as const;

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function normalizeChartRows(raw: unknown): SizeChartRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object" && "size" in r)
    .map((r) => ({
      size: String(r.size).trim(),
      height: r.height ? String(r.height).trim() : null,
      chestMin: num(r.chestMin),
      chestMax: num(r.chestMax),
      waistMin: num(r.waistMin),
      waistMax: num(r.waistMax),
      heightMin: num(r.heightMin),
      heightMax: num(r.heightMax),
      weightMin: num(r.weightMin),
      weightMax: num(r.weightMax),
      hipsMin: num(r.hipsMin),
      hipsMax: num(r.hipsMax),
    }))
    .filter((r) => r.size.length > 0);
}

/** Расстояние от значения до диапазона (0 — внутри). null — параметр не участвует. */
function distance(value: number | undefined, min?: number | null, max?: number | null): number | null {
  if (value === undefined || (min == null && max == null)) return null;
  const lo = min ?? max!;
  const hi = max ?? min!;
  if (value < lo) return lo - value;
  if (value > hi) return value - hi;
  return 0;
}

/** Положение значения внутри диапазона: 0 — нижняя граница, 1 — верхняя */
function position(value: number | undefined, min?: number | null, max?: number | null): number | null {
  if (value === undefined || min == null || max == null || max <= min) return null;
  return (value - min) / (max - min);
}

// Веса параметров: грудь и талия определяют размер, рост — ростовку, вес — вспомогательный
const WEIGHTS = { chest: 1, waist: 0.8, height: 0.6, weight: 0.3 } as const;

export function recommendSize(rows: SizeChartRow[], input: SizeInput): SizeRecommendation | null {
  if (!rows.length) return null;
  if (!input.height && !input.chest && !input.waist) return null;

  const scored = rows.map((row, index) => {
    const parts = {
      chest: distance(input.chest, row.chestMin, row.chestMax),
      waist: distance(input.waist, row.waistMin, row.waistMax),
      height: distance(input.height, row.heightMin, row.heightMax),
      weight: distance(input.weight, row.weightMin, row.weightMax),
    };
    let score = 0;
    let used = 0;
    for (const key of Object.keys(parts) as (keyof typeof parts)[]) {
      const d = parts[key];
      if (d === null) continue;
      used++;
      score += d * WEIGHTS[key];
    }
    return { row, index, parts, score: used ? score : Infinity, used };
  });

  const valid = scored.filter((s) => s.used > 0).sort((a, b) => a.score - b.score || a.index - b.index);
  if (!valid.length) return null;
  let best = valid[0];

  // Учёт предпочтения посадки: если грудь/талия у верхней границы — «свободная» посадка берёт следующий размер,
  // для модели Slim Fit при стандартной посадке тоже рекомендуем больший размер у самой границы.
  const sizesOrder = Array.from(new Set(rows.map((r) => r.size)));
  const pos = Math.max(
    position(input.chest, best.row.chestMin, best.row.chestMax) ?? 0,
    position(input.waist, best.row.waistMin, best.row.waistMax) ?? 0,
  );
  const wantsBigger =
    best.score === 0 &&
    ((input.preference === "loose" && pos >= 0.5) ||
      (input.preference === "regular" && input.modelFit === "SLIM" && pos >= 0.85));

  let alternative: string | null = null;
  if (wantsBigger) {
    const nextSize = sizesOrder[sizesOrder.indexOf(best.row.size) + 1];
    if (nextSize) {
      const candidates = scored.filter((s) => s.row.size === nextSize).sort((a, b) => (a.parts.height ?? 0) - (b.parts.height ?? 0));
      if (candidates[0]) {
        alternative = best.row.size;
        best = candidates[0];
      }
    }
  } else if (input.preference === "fitted" && pos <= 0.15 && best.score === 0) {
    const prevSize = sizesOrder[sizesOrder.indexOf(best.row.size) - 1];
    if (prevSize) alternative = prevSize;
  } else {
    const second = valid.find((s) => s.row.size !== best.row.size);
    if (second && second.score - best.score < 2) alternative = second.row.size;
  }

  const matches = (["chest", "waist", "height", "weight"] as const)
    .filter((p) => best.parts[p] !== null)
    .map((p) => ({ param: p, inRange: best.parts[p] === 0 }));

  const outOfRange = matches.filter((m) => !m.inRange).length;
  const confidence: SizeRecommendation["confidence"] =
    best.score === 0 && !wantsBigger ? (alternative ? "medium" : "high") : best.score <= 3 && outOfRange <= 1 ? "medium" : "low";

  return { size: best.row.size, height: best.row.height ?? null, confidence, matches, alternative };
}

/** Разбор таблицы замеров из CSV-текста (разделитель ; или , или таб). Первая строка — заголовок с названиями колонок. */
export function parseChartCsv(text: string): { rows: SizeChartRow[]; errors: string[] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const errors: string[] = [];
  if (lines.length < 2) return { rows: [], errors: ["Нужна строка заголовка и хотя бы одна строка данных"] };
  const sep = lines[0].includes(";") ? ";" : lines[0].includes("\t") ? "\t" : ",";
  const header = lines[0].split(sep).map((h) => h.trim());
  const unknown = header.filter((h) => !(chartColumns as readonly string[]).includes(h));
  if (unknown.length) errors.push(`Неизвестные колонки: ${unknown.join(", ")}`);
  if (!header.includes("size")) errors.push("Отсутствует обязательная колонка size");
  const raw = lines.slice(1).map((line) => {
    const cells = line.split(sep);
    return Object.fromEntries(header.map((h, i) => [h, (cells[i] ?? "").trim()]));
  });
  return { rows: normalizeChartRows(raw), errors };
}

export function chartToCsv(rows: SizeChartRow[]): string {
  const used = chartColumns.filter((c) => c === "size" || rows.some((r) => r[c] !== null && r[c] !== undefined && r[c] !== ""));
  return [used.join(";"), ...rows.map((r) => used.map((c) => r[c] ?? "").join(";"))].join("\n");
}
