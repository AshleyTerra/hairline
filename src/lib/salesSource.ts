import { daybook, demoday, meta, products, services } from "./data";
import type { CatalogueEntry, ReportLine, ReportSale } from "./reports";
import type { PlayInvoice } from "./types";

/**
 * Every sale in a date range, drawn from the same places the till and the
 * Clients-today tab use, so a report can never disagree with the screen.
 */

const KINDS: ReportLine["kind"][] = ["service", "product", "stock"];

export function salesBetween(from: string, to: string, playInvoices: PlayInvoice[]): ReportSale[] {
  const lo = from <= to ? from : to;
  const hi = from <= to ? to : from;
  const out: ReportSale[] = [];

  // History, excluding the demo day which comes from demoday.json below.
  for (const [day, list] of Object.entries(daybook.days)) {
    if (day < lo || day > hi || day === meta.demoDate) continue;
    for (const inv of list) {
      out.push({
        number: inv.n,
        date: day,
        client: inv.c,
        lines: inv.L.map((line) => {
          const [descrIndex = 0, qty = 1, price = 0, disc = 0, stylistId = 0, kind = 0] = line;
          return {
            descr: daybook.dict[descrIndex] ?? "Item",
            qty,
            price,
            disc,
            stylistId,
            kind: KINDS[kind] ?? "service",
          };
        }),
      });
    }
  }

  if (lo <= meta.demoDate && meta.demoDate <= hi) {
    for (const inv of demoday.invoices) {
      out.push({
        number: inv.id,
        date: meta.demoDate,
        client: inv.clientName,
        lines: inv.lines.map((l) => ({
          descr: l.descr,
          qty: l.qty,
          price: l.price,
          disc: l.disc,
          stylistId: l.stylistId ?? 0,
          kind: l.kind === "product" ? "product" : "service",
        })),
      });
    }
    // Sales rung up during the demo count towards the demo day.
    for (const inv of playInvoices) {
      out.push({
        number: inv.id,
        date: meta.demoDate,
        client: inv.clientName,
        lines: inv.lines.map((l) => ({
          descr: l.descr,
          qty: l.qty,
          price: l.price,
          disc: l.disc,
          stylistId: l.stylistId ?? 0,
          kind: l.kind === "product" ? "product" : "service",
        })),
      });
    }
  }

  return out.sort((a, b) => a.date.localeCompare(b.date) || a.number - b.number);
}

/** The earliest date reports can reach, for date-input limits. */
export const reportsFrom = daybook.from;

/**
 * Department and item numbers for each catalogue line, keyed by description,
 * so an invoice line can be reported the way MySalon numbers it.
 */
export const catalogue: ReadonlyMap<string, CatalogueEntry> = (() => {
  const map = new Map<string, CatalogueEntry>();
  const pad = (n: number) => String(n).padStart(4, "0");
  const key = (name: string) => name.trim().toLowerCase();

  for (const s of services) {
    map.set(key(s.name), {
      dept: s.dept,
      deptNo: pad(s.id % 10000),
      itemNo: pad(s.id),
      kind: "service",
    });
  }
  for (const p of products.retail) {
    map.set(key(p.name), { dept: p.dept, deptNo: pad(p.id % 10000), itemNo: pad(p.id), kind: "product" });
  }
  for (const p of products.backbar) {
    map.set(key(p.name), { dept: p.dept, deptNo: pad(p.id % 10000), itemNo: pad(p.id), kind: "stock" });
  }
  return map;
})();

/** Departments that actually appear in the catalogue, for the report filter. */
export const catalogueDepts = [...new Set([...catalogue.values()].map((c) => c.dept))].sort();

/** Every sellable line description, for the item filter. */
export const catalogueItems = (() => {
  const seen = new Map<string, { name: string; dept: string; kind: string }>();
  for (const s of services) seen.set(s.name, { name: s.name, dept: s.dept, kind: "service" });
  for (const p of products.retail) seen.set(p.name, { name: p.name, dept: p.dept, kind: "retail" });
  for (const p of products.backbar) seen.set(p.name, { name: p.name, dept: p.dept, kind: "stock" });
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
})();

export interface PeriodStats {
  total: number;
  count: number;
  cardShare: number;
  cashShare: number;
  days: number;
}

/**
 * Headline figures for any date or range, so the dashboard is not stuck on the
 * demo day. Uses invoice totals and payments, which is what the till records.
 */
export function periodStats(from: string, to: string, playInvoices: PlayInvoice[]): PeriodStats {
  const lo = from <= to ? from : to;
  const hi = from <= to ? to : from;

  let total = 0;
  let count = 0;
  let card = 0;
  let cash = 0;
  const days = new Set<string>();

  const addPayments = (pairs: [string, number][]) => {
    for (const [method, amount] of pairs) {
      if (method === "card") card += amount;
      else if (method === "cash") cash += amount;
    }
  };

  for (const [day, list] of Object.entries(daybook.days)) {
    if (day < lo || day > hi || day === meta.demoDate) continue;
    for (const inv of list) {
      total += inv.v;
      count += 1;
      days.add(day);
      addPayments(inv.p.map((p) => [String(p[0]), Number(p[1]) || 0]));
    }
  }

  if (lo <= meta.demoDate && meta.demoDate <= hi) {
    days.add(meta.demoDate);
    for (const inv of demoday.invoices) {
      total += inv.total;
      count += 1;
      addPayments([
        ["cash", inv.payments.cash],
        ["card", inv.payments.card],
      ]);
    }
    for (const inv of playInvoices) {
      total += inv.total;
      count += 1;
      addPayments(inv.payments.map((p) => [p.method, p.amount]));
    }
  }

  const paid = card + cash || 1;
  return {
    total: Math.round(total * 100) / 100,
    count,
    cardShare: card / paid,
    cashShare: cash / paid,
    days: days.size,
  };
}
