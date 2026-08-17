/**
 * One client's purchase history, in the shape MySalon printed it.
 *
 * Karin's note of 16 August is that this has to be easy to reach: it is what
 * reception looks at while the client is standing there, and what a stylist
 * checks before mixing colour. The columns follow MySalon's own printout —
 * invoice, staff, date, department, description, item, price, quantity and
 * service type — so nobody has to learn a new one.
 */
import { lineValue, type CatalogueEntry, type LineKind } from "./reports";
import type { PlayInvoice, Visit } from "./types";

export type ServiceTypeFilter = "all" | "service" | "retail" | "stock";

export const SERVICE_TYPES: { value: ServiceTypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "service", label: "Services" },
  { value: "retail", label: "Retail" },
  { value: "stock", label: "Stock Sales" },
];

export interface PurchaseFilter {
  serviceType: ServiceTypeFilter;
  from: string;
  to: string;
}

export interface PurchaseRow {
  invoice: number;
  /** YYYY-MM-DD. */
  date: string;
  stylistId: number | null;
  deptNo: string;
  dept: string;
  itemNo: string;
  descr: string;
  qty: number;
  price: number;
  /** After quantity and discount. */
  value: number;
  /** As the salon reads it: SERVICE, RETAIL or STOCK SALES. */
  serviceType: string;
  kind: LineKind;
}

const LABELS: Record<LineKind, string> = {
  service: "SERVICE",
  product: "RETAIL",
  stock: "STOCK SALES",
};

const round = (v: number) => Math.round(v * 100) / 100;

/** A raw line on its way to becoming a row. */
interface Incoming {
  invoice: number;
  date: string;
  descr: string;
  price: number;
  qty: number;
  disc: number;
  stylistId: number | null;
  kind: LineKind;
}

function toRow(line: Incoming, catalogue: ReadonlyMap<string, CatalogueEntry>): PurchaseRow {
  const info = catalogue.get(line.descr.trim().toLowerCase());
  /* The catalogue is the better authority on what an item is — the same
     description can be sold as retail from the shelf or used from the back bar. */
  const kind = info?.kind ?? line.kind;
  return {
    invoice: line.invoice,
    date: line.date,
    stylistId: line.stylistId,
    deptNo: info?.deptNo ?? "—",
    dept: info?.dept ?? "Unknown",
    itemNo: info?.itemNo ?? "—",
    descr: line.descr,
    qty: line.qty,
    price: line.price,
    value: lineValue({
      descr: line.descr,
      qty: line.qty,
      price: line.price,
      disc: line.disc,
      stylistId: line.stylistId ?? 0,
      kind,
    }),
    serviceType: LABELS[kind],
    kind,
  };
}

const matches = (row: PurchaseRow, filter: PurchaseFilter): boolean => {
  if (row.date < filter.from || row.date > filter.to) return false;
  if (filter.serviceType === "all") return true;
  if (filter.serviceType === "service") return row.kind === "service";
  if (filter.serviceType === "retail") return row.kind === "product";
  return row.kind === "stock";
};

/**
 * Every line this client has bought, newest first.
 *
 * `visits` is their migrated history; `sales` are the ones rung up here, which
 * matter most — a client asking "what did I have last time" usually means today
 * or yesterday. Pass `clientId` to keep another client's sales out.
 */
export function purchaseHistory(
  visits: readonly Visit[],
  sales: readonly PlayInvoice[],
  catalogue: ReadonlyMap<string, CatalogueEntry>,
  filter: PurchaseFilter,
  clientId?: number
): PurchaseRow[] {
  const incoming: Incoming[] = [];

  for (const v of visits) {
    if (clientId != null && v.clientId !== clientId) continue;
    for (const l of v.lines) {
      incoming.push({
        invoice: v.id,
        date: v.date.slice(0, 10),
        descr: l.descr,
        price: l.price,
        qty: l.qty,
        disc: l.disc,
        stylistId: l.stylistId,
        kind: l.kind === "product" ? "product" : "service",
      });
    }
  }

  for (const s of sales) {
    if (clientId != null && s.clientId !== clientId) continue;
    if (clientId != null && s.clientId == null) continue;
    for (const l of s.lines) {
      incoming.push({
        invoice: s.id,
        date: s.date.slice(0, 10),
        descr: l.descr,
        price: l.finalValue != null && l.qty > 0 ? round(l.finalValue / l.qty) : l.price,
        qty: l.qty,
        disc: l.finalValue != null ? 0 : l.disc,
        stylistId: l.stylistId,
        kind: l.kind,
      });
    }
  }

  return incoming
    .map((l) => toRow(l, catalogue))
    .filter((r) => matches(r, filter))
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.invoice - a.invoice || a.descr.localeCompare(b.descr)
    );
}

/** Foot of the sheet: items, value, and how many separate visits they cover. */
export function purchaseTotals(rows: readonly PurchaseRow[]): {
  qty: number;
  value: number;
  visits: number;
} {
  return {
    qty: rows.reduce((n, r) => n + r.qty, 0),
    value: round(rows.reduce((n, r) => n + r.value, 0)),
    visits: new Set(rows.map((r) => r.invoice)).size,
  };
}
