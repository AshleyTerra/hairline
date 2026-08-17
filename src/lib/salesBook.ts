/**
 * Closed sales, and the corrections made to them.
 *
 * Karin asked to correct a docket "once it has been closed" — a split between
 * two stylists that was missed in haste, or the wrong payment type. That has to
 * include the sales already in the day book, because those are the ones on the
 * screen; restricting it to sales rung up in the same browser session made the
 * function look absent. A correction is stored as a whole corrected copy of the
 * sale, keyed by its invoice number, and swapped in wherever the sale appears —
 * the day book and the turnover reports alike.
 */
import type { DemoInvoice, Payment, PaymentMethod, PlayInvoice, TillLine } from "./types";

/** The order payments are listed in, so a split always reads the same way. */
const METHOD_ORDER: { key: keyof DemoInvoice["payments"]; method: PaymentMethod }[] = [
  { key: "cash", method: "cash" },
  { key: "card", method: "card" },
  { key: "eft", method: "eft" },
  { key: "voucher", method: "voucher" },
  { key: "toPay", method: "topay" },
];

/**
 * A day-book sale in the shape the amend editor works in. The invoice number is
 * kept as the id so a correction lands on the right sale.
 */
export function demoSaleAsPlayInvoice(sale: DemoInvoice): PlayInvoice {
  return {
    id: sale.id,
    clientId: sale.clientId,
    clientName: sale.clientName,
    date: sale.date,
    total: sale.total,
    lines: sale.lines.map((l, i) => ({
      key: `inv${sale.id}-${i}`,
      descr: l.descr,
      price: l.price,
      qty: l.qty,
      disc: l.disc,
      stylistId: l.stylistId,
      kind: l.kind,
    })) as TillLine[],
    payments: METHOD_ORDER.filter(({ key }) => (sale.payments[key] ?? 0) > 0).map(
      ({ key, method }): Payment => ({ method, amount: sale.payments[key] })
    ),
    tips: [],
    seconds: 0,
  };
}

/**
 * The sale a correction is aimed at, wherever it lives: rung up here, already
 * corrected once, or still sitting untouched in the day book.
 */
export function resolveSale(
  id: number,
  prototype: readonly PlayInvoice[],
  corrected: readonly PlayInvoice[],
  dayBook: readonly DemoInvoice[]
): PlayInvoice | undefined {
  const rung = prototype.find((i) => i.id === id);
  if (rung) return rung;

  const already = corrected.find((i) => i.id === id);
  if (already) return already;

  const original = dayBook.find((i) => i.id === id);
  return original ? demoSaleAsPlayInvoice(original) : undefined;
}

export interface SaleForDisplay extends PlayInvoice {
  /** True when this is a corrected version rather than the original. */
  wasAmended: boolean;
}

/**
 * Every day-book sale, with any correction swapped in. Used by the day book and
 * by the reports, so a stylist split fixed at the counter shows in the turnover
 * figures immediately — which is the whole point of correcting it.
 */
export function amendedOrOriginal(
  dayBook: readonly DemoInvoice[],
  corrected: readonly PlayInvoice[]
): SaleForDisplay[] {
  const byId = new Map(corrected.map((c) => [c.id, c]));
  return dayBook.map((sale) => {
    const fix = byId.get(sale.id);
    return fix
      ? { ...fix, wasAmended: true }
      : { ...demoSaleAsPlayInvoice(sale), wasAmended: false };
  });
}
