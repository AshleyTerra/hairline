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

/** Services, retail and salon stock, plus their total. */
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
