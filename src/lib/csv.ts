/** CSV reading and writing, kept free of the DOM so it can be unit tested. */

export interface CsvColumn<T> {
  key: keyof T & string;
  label: string;
  /** Optional formatter, e.g. to flatten a nested value or force a date shape. */
  value?: (row: T) => string | number | null | undefined;
}

/** Spreadsheets need quoting around commas, quotes and newlines. */
function escape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (text === "") return "";
  // Leading zeros (phone numbers) survive only inside quotes.
  const needsQuotes = /[",\n\r]/.test(text) || /^0\d/.test(text);
  return needsQuotes ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const header = columns.map((c) => escape(c.label)).join(",");
  if (rows.length === 0) return header;
  const body = rows.map((row) =>
    columns.map((c) => escape(c.value ? c.value(row) : (row[c.key] as never))).join(",")
  );
  return [header, ...body].join("\r\n");
}

/** Splits one CSV line, respecting quoted fields. */
function splitLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out;
}

/** Reads a CSV into objects keyed by the header row. */
export function parseCsv(text: string): Record<string, string>[] {
  if (!text || !text.trim()) return [];

  // Keep newlines that sit inside quoted fields.
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"') inQuotes = !inQuotes;
    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      lines.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current !== "") lines.push(current);

  const rows = lines.filter((l) => l.trim() !== "");
  if (rows.length < 2) return [];

  const headers = splitLine(rows[0]).map((h) => h.trim());
  return rows.slice(1).map((line) => {
    const cells = splitLine(line);
    const record: Record<string, string> = {};
    headers.forEach((h, i) => {
      record[h] = (cells[i] ?? "").trim();
    });
    return record;
  });
}

/** Triggers a browser download. Kept here so pages never touch the DOM directly. */
export function downloadCsv(filename: string, csv: string): void {
  // A BOM makes Excel open UTF-8 correctly.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
