import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyOnecRequest } from "@/lib/import/onec-auth";
import { catalogPayloadSchema, importCatalog } from "@/lib/import/catalog-import";

export const maxDuration = 300;

/** Приём номенклатуры из 1С: товары, артикулы, цвета, размеры, ростовки, цены, остатки по складам */
export async function POST(req: Request) {
  const raw = await req.text();
  const auth = await verifyOnecRequest(req, raw);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const started = Date.now();
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    await prisma.integrationLog.create({ data: { source: "1c", operation: "catalog", status: "error", message: "Некорректный JSON" } });
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = catalogPayloadSchema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 100).map((i) => ({ ref: i.path.join("."), message: i.message }));
    await prisma.integrationLog.create({ data: { source: "1c", operation: "catalog", status: "error", message: "Ошибка валидации", errors: issues } });
    return NextResponse.json({ error: "validation", issues }, { status: 422 });
  }
  try {
    const report = await importCatalog(parsed.data, "1c");
    await prisma.integrationLog.create({
      data: {
        source: "1c",
        operation: "catalog",
        status: report.errors.length ? "partial" : "success",
        message: `Товаров в пакете: ${parsed.data.products.length}${report.dryRun ? " (dryRun)" : ""}`,
        stats: { ...report, errors: undefined },
        errors: report.errors.slice(0, 500),
        durationMs: Date.now() - started,
      },
    });
    return NextResponse.json(report);
  } catch (e) {
    console.error("[1c] catalog import failed", e);
    await prisma.integrationLog.create({ data: { source: "1c", operation: "catalog", status: "error", message: String(e).slice(0, 1000), durationMs: Date.now() - started } });
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
