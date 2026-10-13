/**
 * Обмен с 1С через файлы (альтернатива HTTP API).
 * 1С выгружает JSON-файлы в папку обмена (например, по FTP/SFTP или общую папку),
 * cron запускает этот скрипт каждые ~10 минут:
 *
 *   npm run 1c:import-file -- /var/exchange/1c/in
 *
 * Файлы catalog*.json → importCatalog, stock*.json → importStock.
 * Обработанные файлы перемещаются в подпапку processed/, ошибочные — в failed/.
 * Формат — docs/1C_INTEGRATION.md.
 */
import { readdir, readFile, rename, mkdir } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/lib/db";
import { catalogPayloadSchema, importCatalog, importStock, stockPayloadSchema } from "../src/lib/import/catalog-import";

async function main() {
  const dir = process.argv[2];
  if (!dir) throw new Error("Укажите папку обмена");
  await mkdir(path.join(dir, "processed"), { recursive: true });
  await mkdir(path.join(dir, "failed"), { recursive: true });
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  for (const f of files) {
    const full = path.join(dir, f);
    const started = Date.now();
    const operation = f.startsWith("stock") ? "stock" : "catalog";
    try {
      const json = JSON.parse(await readFile(full, "utf8"));
      const report =
        operation === "stock" ? await importStock(stockPayloadSchema.parse(json)) : await importCatalog(catalogPayloadSchema.parse(json), "1c");
      await prisma.integrationLog.create({
        data: {
          source: "1c",
          operation,
          status: report.errors.length ? "partial" : "success",
          message: `Файл ${f}`,
          stats: { ...report, errors: undefined },
          errors: report.errors.slice(0, 500),
          durationMs: Date.now() - started,
        },
      });
      await rename(full, path.join(dir, "processed", `${Date.now()}-${f}`));
      console.log(`${f}: OK`, { ...report, errors: report.errors.length });
    } catch (e) {
      await prisma.integrationLog.create({ data: { source: "1c", operation, status: "error", message: `Файл ${f}: ${String(e).slice(0, 900)}` } });
      await rename(full, path.join(dir, "failed", `${Date.now()}-${f}`));
      console.error(`${f}: ERROR`, e);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
