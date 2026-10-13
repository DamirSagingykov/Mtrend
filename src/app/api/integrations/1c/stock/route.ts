import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyOnecRequest } from "@/lib/import/onec-auth";
import { importStock, stockPayloadSchema } from "@/lib/import/catalog-import";

export const maxDuration = 300;

/** Быстрая синхронизация остатков и цен (рекомендуемая частота — каждые 10 минут) */
export async function POST(req: Request) {
  const raw = await req.text();
  const auth = await verifyOnecRequest(req, raw);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const started = Date.now();
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = stockPayloadSchema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 100).map((i) => ({ ref: i.path.join("."), message: i.message }));
    await prisma.integrationLog.create({ data: { source: "1c", operation: "stock", status: "error", message: "Ошибка валидации", errors: issues } });
    return NextResponse.json({ error: "validation", issues }, { status: 422 });
  }
  try {
    const report = await importStock(parsed.data);
    await prisma.integrationLog.create({
      data: {
        source: "1c",
        operation: "stock",
        status: report.errors.length ? "partial" : "success",
        message: `Строк остатков: ${parsed.data.items.length}, цен: ${parsed.data.prices?.length ?? 0}`,
        stats: { ...report, errors: undefined },
        errors: report.errors.slice(0, 500),
        durationMs: Date.now() - started,
      },
    });
    return NextResponse.json(report);
  } catch (e) {
    console.error("[1c] stock import failed", e);
    await prisma.integrationLog.create({ data: { source: "1c", operation: "stock", status: "error", message: String(e).slice(0, 1000), durationMs: Date.now() - started } });
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
