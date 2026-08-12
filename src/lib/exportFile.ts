import * as XLSX from "xlsx";
import { downloadCsv, toCsv, type CsvColumn } from "./csv";

/**
 * One place for getting a report off the screen: a real Excel workbook, a CSV,
 * or the browser's print dialogue for a PDF.
 */

export interface SheetSpec<T> {
  /** Worksheet name; Excel allows 31 characters and no : \ / ? * [ ] */
  name: string;
  rows: readonly T[];
  columns: readonly CsvColumn<T>[];
  /** Optional lines above the table, e.g. the report title and period. */
  heading?: string[];
}

/** Excel refuses some characters in sheet names, so clean them up. */
export function safeSheetName(name: string): string {
  return name.replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 31) || "Report";
}

/** Builds an .xlsx workbook and downloads it. */
export function downloadXlsx<T>(filename: string, sheets: readonly SheetSpec<T>[]): void {
  const book = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const header = sheet.columns.map((c) => c.label);
    const body = sheet.rows.map((row) =>
      sheet.columns.map((c) => {
        const value = c.value ? c.value(row) : (row[c.key] as unknown);
        return value === null || value === undefined ? "" : value;
      })
    );

    const aoa: unknown[][] = [];
    for (const line of sheet.heading ?? []) aoa.push([line]);
    if (sheet.heading?.length) aoa.push([]);
    aoa.push(header, ...body);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // Give every column a sensible width so nothing arrives as ####.
    ws["!cols"] = sheet.columns.map((c) => ({
      wch: Math.max(12, Math.min(42, c.label.length + 4)),
    }));
    XLSX.utils.book_append_sheet(book, ws, safeSheetName(sheet.name));
  }

  XLSX.writeFile(book, filename);
}

/** CSV of a single table, for anyone who prefers it. */
export function downloadTableCsv<T>(
  filename: string,
  rows: readonly T[],
  columns: readonly CsvColumn<T>[]
): void {
  downloadCsv(filename, toCsv(rows, columns));
}

/** Hands the current page to the browser's print dialogue, where PDF lives. */
export function printReport(): void {
  window.print();
}

/** A filename-safe stamp, e.g. hairline-staff-turnover-2026-07-01_2026-07-31.xlsx */
export function reportFilename(slug: string, from: string, to: string, ext: string): string {
  const period = from === to ? from : `${from}_${to}`;
  return `hairline-${slug}-${period}.${ext}`;
}
