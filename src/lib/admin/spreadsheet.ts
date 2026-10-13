import "server-only";
import ExcelJS from "exceljs";
import Papa from "papaparse";

export type Sheet = { columns: { key: string; header: string; width?: number }[]; rows: Record<string, unknown>[] };

export async function toXlsx(sheet: Sheet, name = "Лист1"): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(name);
  ws.columns = sheet.columns.map((c) => ({ key: c.key, header: c.header, width: c.width ?? 16 }));
  ws.getRow(1).font = { bold: true };
  ws.addRows(sheet.rows);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function toCsv(sheet: Sheet): string {
  // BOM для корректного открытия в Excel
  return "﻿" + Papa.unparse({ fields: sheet.columns.map((c) => c.header), data: sheet.rows.map((r) => sheet.columns.map((c) => r[c.key] ?? "")) }, { delimiter: ";" });
}

/** Чтение загруженного CSV/XLSX в массив объектов по заголовкам первой строки */
export async function readTable(file: File): Promise<Record<string, unknown>[]> {
  const buf = Buffer.from(await file.arrayBuffer());
  if (/\.xlsx$/i.test(file.name)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    if (!ws) return [];
    const headers: string[] = [];
    ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => (headers[col] = String(cell.value ?? "").trim()));
    const rows: Record<string, unknown>[] = [];
    ws.eachRow((row, n) => {
      if (n === 1) return;
      const obj: Record<string, unknown> = {};
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        const v = cell.value;
        obj[headers[col]] = v && typeof v === "object" && "result" in v ? (v as { result: unknown }).result : v && typeof v === "object" && "text" in v ? (v as { text: unknown }).text : v;
      });
      rows.push(obj);
    });
    return rows;
  }
  const text = buf.toString("utf8").replace(/^﻿/, "");
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true, delimitersToGuess: [";", ",", "\t"] });
  return parsed.data;
}
