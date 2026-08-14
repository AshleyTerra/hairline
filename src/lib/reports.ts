import { VAT_RATE } from "./till";

/**
 * Report maths, kept free of React and of the data files so the figures that
 * feed wage checking can be tested on their own.
 */

export type LineKind = "service" | "product" | "stock";

export interface ReportLine {
  descr: string;
  qty: number;
  price: number;
  disc: number;
  stylistId: number;
  kind: LineKind;
}

export interface ReportSale {
  number: number;
  date: string;
  client: string;
  lines: ReportLine[];
}

/** Services, retail and Stock Sales, plus their total. */
export interface Split {
  services: number;
  retail: number;
  stock: number;
  total: number;
}

export interface TurnoverRow {
  stylistId: number;
  inclVat: Split;
  exVat: Split;
}

export interface DailyTurnoverRow {
  date: string;
  inclVat: Split;
  exVat: Split;
}

const round = (v: number) => Math.round(v * 100) / 100;

/** Prices are VAT-inclusive, so the excluding figure is the price less 15/115. */
export const exVat = (inclusive: number): number => round(inclusive / (1 + VAT_RATE));

export const emptySplit = (): Split => ({ services: 0, retail: 0, stock: 0, total: 0 });

export const lineValue = (line: ReportLine): number =>
  round(line.price * (line.qty ?? 1) * (1 - (line.disc ?? 0) / 100));

export function splitTotals(lines: readonly ReportLine[]): Split {
  const split = emptySplit();
  for (const line of lines) {
    const value = lineValue(line);
    if (line.kind === "product") split.retail += value;
    else if (line.kind === "stock") split.stock += value;
    else split.services += value;
    split.total += value;
  }
  return {
    services: round(split.services),
    retail: round(split.retail),
    stock: round(split.stock),
    total: round(split.total),
  };
}

/**
 * Money the salon takes with nobody behind it — a gift voucher is paid for
 * before any work is done, so it belongs to Hairline rather than to a stylist.
 *
 * "Stock Sales" is the salon's own term, carried over from MySalon, and the
 * feedback of 14 August asked for that one label everywhere rather than a
 * mixture of "salon stock", "Hairline (salon)" and "stock sale". It reports
 * under staff number 0, and a line here must never reach a stylist's figure —
 * these numbers set wages.
 */
export const SALON_ID = 0;
export const SALON_NAME = "Stock Sales";

export function addRow(a: Split, b: Split): Split {
  return {
    services: round(a.services + b.services),
    retail: round(a.retail + b.retail),
    stock: round(a.stock + b.stock),
    total: round(a.total + b.total),
  };
}

const asExVat = (split: Split): Split => ({
  services: exVat(split.services),
  retail: exVat(split.retail),
  stock: exVat(split.stock),
  total: exVat(split.total),
});

/**
 * One row per requested staff member. Each line counts towards the stylist on
 * that line, so a sale worked by two people splits correctly.
 */
export function staffTurnover(
  sales: readonly ReportSale[],
  stylistIds: readonly number[]
): TurnoverRow[] {
  const totals = new Map<number, Split>(stylistIds.map((id) => [id, emptySplit()]));

  for (const sale of sales) {
    for (const line of sale.lines) {
      const current = totals.get(line.stylistId);
      if (!current) continue; // not a staff member this report asked for
      totals.set(line.stylistId, addRow(current, splitTotals([line])));
    }
  }

  return [...totals.entries()]
    .map(([stylistId, inclVat]) => ({ stylistId, inclVat, exVat: asExVat(inclVat) }))
    .sort((a, b) => b.inclVat.total - a.inclVat.total || a.stylistId - b.stylistId);
}

/** One row per trading day for a single staff member. */
export function turnoverByDate(
  sales: readonly ReportSale[],
  stylistId: number
): DailyTurnoverRow[] {
  const byDay = new Map<string, Split>();

  for (const sale of sales) {
    const mine = sale.lines.filter((l) => l.stylistId === stylistId);
    if (mine.length === 0) continue;
    const day = sale.date.slice(0, 10);
    byDay.set(day, addRow(byDay.get(day) ?? emptySplit(), splitTotals(mine)));
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, inclVat]) => ({ date, inclVat, exVat: asExVat(inclVat) }));
}

// ------------------------------------------------------- item tracking

/** What the catalogue knows about a line, looked up by its description. */
export interface CatalogueEntry {
  dept: string;
  deptNo: string;
  itemNo: string;
  kind: LineKind;
}

export interface ItemTrackingRow {
  invoice: number;
  date: string;
  client: string;
  stylistId: number;
  deptNo: string;
  dept: string;
  itemNo: string;
  descr: string;
  qty: number;
  price: number;
  value: number;
}

export interface ItemTrackingFilter {
  /** Empty means every department. */
  depts?: readonly string[];
  /** Empty means every item. */
  descrs?: readonly string[];
  /** Null means every stylist. */
  stylistId?: number | null;
  /** Which kinds to include; defaults to retail and Stock Sales. */
  kinds?: readonly LineKind[];
}

/**
 * Every line matching the filter, one row per line — the shape of MySalon's
 * Item Tracking report: invoice, date, client, staff, department, item and
 * quantity.
 */
export function itemTracking(
  sales: readonly ReportSale[],
  catalogue: ReadonlyMap<string, CatalogueEntry>,
  filter: ItemTrackingFilter = {}
): ItemTrackingRow[] {
  const wantDept = new Set(filter.depts ?? []);
  const wantDescr = new Set(filter.descrs ?? []);
  const wantKind = new Set(filter.kinds ?? []);
  const rows: ItemTrackingRow[] = [];

  for (const sale of sales) {
    for (const line of sale.lines) {
      const info = catalogue.get(line.descr.trim().toLowerCase());
      const dept = info?.dept ?? "Unknown";
      const kind = info?.kind ?? line.kind;

      if (wantKind.size > 0 && !wantKind.has(kind)) continue;
      if (wantDept.size > 0 && !wantDept.has(dept)) continue;
      if (wantDescr.size > 0 && !wantDescr.has(line.descr)) continue;
      if (filter.stylistId != null && line.stylistId !== filter.stylistId) continue;

      rows.push({
        invoice: sale.number,
        date: sale.date.slice(0, 10),
        client: sale.client,
        stylistId: line.stylistId,
        deptNo: info?.deptNo ?? "—",
        dept,
        itemNo: info?.itemNo ?? "—",
        descr: line.descr,
        qty: line.qty,
        price: line.price,
        value: lineValue(line),
      });
    }
  }

  return rows.sort(
    (a, b) => b.date.localeCompare(a.date) || a.invoice - b.invoice || a.descr.localeCompare(b.descr)
  );
}

/** Totals for the foot of an item-tracking report. */
export function itemTrackingTotals(rows: readonly ItemTrackingRow[]): {
  qty: number;
  value: number;
} {
  return {
    qty: rows.reduce((n, r) => n + r.qty, 0),
    value: round(rows.reduce((n, r) => n + r.value, 0)),
  };
}

/** Column totals for the bottom of a report. */
export function sumRows(rows: readonly { inclVat: Split; exVat: Split }[]): {
  inclVat: Split;
  exVat: Split;
} {
  return rows.reduce(
    (acc, r) => ({ inclVat: addRow(acc.inclVat, r.inclVat), exVat: addRow(acc.exVat, r.exVat) }),
    { inclVat: emptySplit(), exVat: emptySplit() }
  );
}
