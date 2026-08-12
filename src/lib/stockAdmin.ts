import { parseCsv } from "./csv";

/**
 * Stock administration: adding lines, importing a spreadsheet, spotting items
 * that have not sold in three years, and archiving them without losing history.
 */

export type Shelf = "retail" | "backbar";

export interface StockDraft {
  name: string;
  brand: string;
  shelf: Shelf;
  cost: number;
  price: number;
  reorder: number;
  barcode: string;
}

export interface StockImportResult {
  rows: StockDraft[];
  errors: string[];
}

/** Header spellings a supplier price list is likely to use. */
const HEADERS: Record<string, string[]> = {
  name: ["item", "name", "description", "product", "product name", "stock item"],
  brand: ["brand", "vendor", "supplier", "range"],
  shelf: ["shelf", "type", "kind", "service type"],
  cost: ["cost", "unit cost", "cost price", "nett cost", "net cost"],
  price: ["price", "rsp", "selling price", "retail price", "unit rsp"],
  reorder: ["reorder", "reorder level", "min", "minimum"],
  barcode: ["barcode", "ean", "sku", "code"],
};

function findHeader(headers: string[], candidates: string[]): string | null {
  const lower = headers.map((h) => h.toLowerCase());
  for (const c of candidates) {
    const i = lower.indexOf(c);
    if (i !== -1) return headers[i];
  }
  return null;
}

/** Money written as "R 1 234,56" or "1234.56" both need to become a number. */
export function parseMoney(raw: string): number | null {
  const cleaned = String(raw ?? "")
    .replace(/[Rr\s ]/g, "")
    .replace(/,(\d{1,2})$/, ".$1")
    .replace(/,/g, "");
  if (cleaned === "") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

/** Reads a supplier spreadsheet, reporting bad rows rather than accepting them. */
export function parseStockImport(text: string, defaultShelf: Shelf = "retail"): StockImportResult {
  const raw = parseCsv(text);
  const errors: string[] = [];
  if (raw.length === 0) return { rows: [], errors: ["That file has no rows under its header."] };

  const headers = Object.keys(raw[0]);
  const map = {
    name: findHeader(headers, HEADERS.name),
    brand: findHeader(headers, HEADERS.brand),
    shelf: findHeader(headers, HEADERS.shelf),
    cost: findHeader(headers, HEADERS.cost),
    price: findHeader(headers, HEADERS.price),
    reorder: findHeader(headers, HEADERS.reorder),
    barcode: findHeader(headers, HEADERS.barcode),
  };

  if (!map.name) {
    return {
      rows: [],
      errors: ["No item column found. Add a column called Item (or Description) and try again."],
    };
  }

  const rows: StockDraft[] = [];
  const seen = new Map<string, number>();

  raw.forEach((record, i) => {
    const line = i + 2; // header is row 1
    const name = (map.name ? record[map.name] : "").trim();
    if (!name) {
      errors.push(`Row ${line}: no item name, so the row was skipped.`);
      return;
    }

    const key = name.toLowerCase();
    const first = seen.get(key);
    if (first !== undefined) {
      errors.push(`Row ${line} (${name}): already listed on row ${first}.`);
      return;
    }

    const cost = map.cost ? parseMoney(record[map.cost]) : 0;
    const price = map.price ? parseMoney(record[map.price]) : 0;

    if (map.cost && record[map.cost].trim() !== "" && cost === null) {
      errors.push(`Row ${line} (${name}): "${record[map.cost]}" is not a cost we can read.`);
      return;
    }
    if (map.price && record[map.price].trim() !== "" && price === null) {
      errors.push(`Row ${line} (${name}): "${record[map.price]}" is not a price we can read.`);
      return;
    }

    const shelfRaw = (map.shelf ? record[map.shelf] : "").toLowerCase();
    const shelf: Shelf = /back|stock|professional|salon/.test(shelfRaw)
      ? "backbar"
      : /retail|r$/.test(shelfRaw)
        ? "retail"
        : defaultShelf;

    if (shelf === "retail" && (price ?? 0) <= 0) {
      errors.push(`Row ${line} (${name}): retail lines need a selling price.`);
      return;
    }

    seen.set(key, line);
    rows.push({
      name,
      brand: (map.brand ? record[map.brand] : "").trim() || "Unknown",
      shelf,
      cost: cost ?? 0,
      price: price ?? 0,
      reorder: map.reorder ? Math.max(0, Math.round(Number(record[map.reorder]) || 0)) : 0,
      barcode: (map.barcode ? record[map.barcode] : "").trim(),
    });
  });

  return { rows, errors };
}

// ------------------------------------------------------------- archiving

export interface ArchivableItem {
  id: number;
  name: string;
  timesSold: number;
  qty: number;
}

/**
 * Items with no sale in the window. The prototype's history reaches back three
 * years, so "never sold in it" is the test.
 */
export function inactiveItems<T extends ArchivableItem>(items: readonly T[]): T[] {
  return items.filter((i) => i.timesSold === 0);
}

export function archive(archived: readonly number[], id: number): number[] {
  return archived.includes(id) ? [...archived] : [...archived, id];
}

export function unarchive(archived: readonly number[], id: number): number[] {
  return archived.filter((x) => x !== id);
}

export function archiveMany(archived: readonly number[], ids: readonly number[]): number[] {
  return [...new Set([...archived, ...ids])];
}

export const isArchived = (archived: readonly number[], id: number): boolean =>
  archived.includes(id);

/** Archiving hides an item from selection; it never removes past sales. */
export function activeOnly<T extends { id: number }>(
  items: readonly T[],
  archived: readonly number[]
): T[] {
  return items.filter((i) => !archived.includes(i.id));
}
