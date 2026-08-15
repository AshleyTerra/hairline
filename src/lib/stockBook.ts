/**
 * Stock as the salon maintains it.
 *
 * Eleven years of migrated lines, plus anything added since, plus whatever has
 * been corrected on the Stock screen — one list, so a barcode changed this
 * morning is the barcode the till scans this afternoon. Archiving hides a line
 * from selection without touching its history.
 */
import { parseMoney, type StockDraft } from "./stockAdmin";
import type { Product } from "./types";

/** A correction to one line. Only the fields that were changed are present. */
export interface StockEdit {
  id: number;
  name?: string;
  brand?: string;
  barcode?: string;
  cost?: number;
  price?: number;
  reorder?: number;
}

/** The maintenance form, as typed. */
export interface StockEditInput {
  name: string;
  brand: string;
  cost: string;
  price: string;
  reorder: string;
  barcode: string;
}

export type StockValidation =
  | { ok: true; patch: Omit<StockEdit, "id"> }
  | { ok: false; field: "name" | "brand" | "cost" | "price" | "reorder"; error: string };

const round = (v: number) => Math.round(v * 100) / 100;

/** Margin on the selling price, the way the salon's own price list reads it. */
const marginOf = (cost: number, price: number): number | null =>
  price > 0 && cost > 0 ? Math.round(((price - cost) / price) * 1000) / 10 : null;

/** Returns a new product with the edit applied; the original is untouched. */
export function applyEdit(product: Product, edit: StockEdit): Product {
  const cost = edit.cost ?? product.cost;
  const price = edit.price ?? product.price;
  return {
    ...product,
    name: edit.name ?? product.name,
    brand: edit.brand ?? product.brand,
    barcode: edit.barcode !== undefined ? edit.barcode || null : product.barcode,
    cost,
    price,
    margin: marginOf(cost, price),
    reorder: edit.reorder ?? product.reorder,
  };
}

/**
 * Checks a correction before it is saved. Barcodes are deliberately free text:
 * the same product arrives with a changed code, and plenty of items never carry
 * a supplier barcode at all, so the salon writes its own.
 */
export function validateStockEdit(input: StockEditInput): StockValidation {
  const name = String(input.name ?? "").trim();
  if (!name) return { ok: false, field: "name", error: "Give the item a name." };

  const brand = String(input.brand ?? "").trim();
  if (!brand) return { ok: false, field: "brand", error: "Which brand is it?" };

  const rawCost = String(input.cost ?? "").trim();
  const cost = rawCost === "" ? 0 : parseMoney(rawCost);
  if (cost === null) {
    return { ok: false, field: "cost", error: `"${rawCost}" is not a cost we can read.` };
  }
  if (cost < 0) return { ok: false, field: "cost", error: "A cost cannot be less than nothing." };

  const rawPrice = String(input.price ?? "").trim();
  const price = rawPrice === "" ? 0 : parseMoney(rawPrice);
  if (price === null) {
    return { ok: false, field: "price", error: `"${rawPrice}" is not a price we can read.` };
  }
  if (price < 0) return { ok: false, field: "price", error: "A price cannot be less than nothing." };

  const reorder = Math.max(0, Math.round(Number(input.reorder) || 0));

  return {
    ok: true,
    patch: {
      name,
      brand,
      cost: round(cost),
      price: round(price),
      reorder,
      barcode: String(input.barcode ?? "").trim(),
    },
  };
}

/** A line added at the counter: real details, and no history yet. */
export function asProduct(drafted: StockDraft, id: number): Product {
  return {
    id,
    name: drafted.name,
    brand: drafted.brand,
    dept: drafted.brand,
    cost: drafted.cost,
    price: drafted.price,
    margin: marginOf(drafted.cost, drafted.price),
    qty: 0,
    reorder: drafted.reorder,
    barcode: drafted.barcode || null,
    /* Nothing has been counted onto the shelf yet, and saying so is the honest
       starting point — the salon's whole stock problem began with silence here. */
    needsCount: true,
    lowStock: false,
    timesSold: 0,
  };
}

/** Negative ids, to stay clear of the migrated stock file. */
export const nextStockId = (added: readonly { id: number }[]): number => -(added.length + 1);

/**
 * The maintained list: migrated lines and new ones, with corrections applied and
 * archived lines left out. Newest first, because a line added a minute ago is
 * the one somebody is looking for.
 */
export function stockBook(
  migrated: readonly Product[],
  added: readonly StockDraft[],
  edits: readonly StockEdit[],
  archived: readonly number[],
  shelf?: StockDraft["shelf"]
): Product[] {
  /* A later edit to the same line wins, so the list is folded in order. */
  const byId = new Map<number, StockEdit>();
  for (const edit of edits) {
    byId.set(edit.id, { ...(byId.get(edit.id) ?? { id: edit.id }), ...edit });
  }

  /* Numbered from the whole list before the shelf is narrowed, so a retail line
     and a back-bar line can never end up sharing an id — an edit aimed at one
     would otherwise land on both. */
  const fresh = added
    .map((d, i) => ({ shelf: d.shelf, product: asProduct(d, -(i + 1)) }))
    .filter((x) => shelf === undefined || x.shelf === shelf)
    .map((x) => x.product)
    .reverse();
  const hidden = new Set(archived);

  return [...fresh, ...migrated]
    .filter((p) => !hidden.has(p.id))
    .map((p) => {
      const edit = byId.get(p.id);
      return edit ? applyEdit(p, edit) : p;
    });
}

/** Records a correction, keeping the history of what was changed. */
export function editStock(
  edits: readonly StockEdit[],
  id: number,
  patch: Omit<StockEdit, "id">
): StockEdit[] {
  return [...edits, { id, ...patch }];
}
