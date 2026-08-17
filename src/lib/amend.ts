/**
 * Correcting a docket after it has been closed.
 *
 * Karin's note of 16 August: in haste a docket sometimes goes through without
 * being split between two stylists, or with the wrong payment type chosen. Both
 * are corrections to the record of a sale that genuinely happened — not a
 * re-ring — so what a sale was worth can never move. Only who earned it, and how
 * the money arrived, can.
 *
 * Every change is recorded against the person who made it. The password prompt
 * lives in the dialog; this file is only the arithmetic.
 */
import type { PaymentMethod, PlayInvoice, TillLine } from "./types";

export interface Amendment {
  by: string;
  /** ISO timestamp on the trading day. */
  at: string;
  /** Plain words, so the trail reads without decoding. */
  what: string;
}

export type AmendResult = { ok: true; value: PlayInvoice } | { ok: false; error: string };

const toCents = (rands: number) => Math.round((rands ?? 0) * 100);
const toRands = (cents: number) => Math.round(cents) / 100;

/** What a line is worth, honouring a hand-typed final value. */
const lineCents = (line: TillLine): number =>
  line.finalValue != null
    ? toCents(line.finalValue)
    : Math.round(toCents(line.price) * (line.qty ?? 1) * (1 - (line.disc ?? 0) / 100));

/** The sale's value after amendment — the figure that must never move. */
export function amendedTotal(invoice: PlayInvoice): number {
  return toRands(invoice.lines.reduce((sum, l) => sum + lineCents(l), 0));
}

/**
 * True when the payments still account for the sale plus any tip. A wrong
 * payment type is a relabelling, so this has to hold before and after.
 */
export function paymentsMatchTotal(invoice: PlayInvoice): boolean {
  const tips = invoice.tips.reduce((sum, t) => sum + toCents(t.amount), 0);
  const paid = invoice.payments.reduce((sum, p) => sum + toCents(p.amount), 0);
  return paid === toCents(amendedTotal(invoice)) + tips;
}

// ------------------------------------------------------------------ lines

/** Puts one line with a different stylist. The money does not move. */
export function setLineStylist(
  invoice: PlayInvoice,
  key: string,
  stylistId: number
): PlayInvoice {
  return {
    ...invoice,
    lines: invoice.lines.map((l) => (l.key === key ? { ...l, stylistId } : l)),
  };
}

/**
 * Splits one line between the stylist on it and somebody else.
 *
 * `share` is the percentage going to the other stylist. The two halves are
 * worked out in cents and the remainder stays on the original line, so the
 * docket total is unchanged to the cent — a lost cent here would show up as a
 * variance at cash-up.
 */
export function splitLine(
  invoice: PlayInvoice,
  key: string,
  otherStylistId: number,
  share: number
): AmendResult {
  const line = invoice.lines.find((l) => l.key === key);
  if (!line) return { ok: false, error: "That line is no longer on the docket." };
  if (!Number.isFinite(share) || share <= 0 || share >= 100) {
    return { ok: false, error: "A split needs a share between 1% and 99%." };
  }
  if (line.stylistId === otherStylistId) {
    return { ok: false, error: "Choose a different stylist to split with." };
  }

  const whole = lineCents(line);
  const theirs = Math.round((whole * share) / 100);
  if (theirs <= 0 || theirs >= whole) {
    return { ok: false, error: "That share leaves nothing for one of them." };
  }
  const mine = whole - theirs;

  /* Both halves become fixed amounts. Keeping price x qty would reintroduce
     rounding, and the point of the split is that the two add back to the whole. */
  const asFixed = (value: number, stylistId: number | null, suffix: string): TillLine => ({
    ...line,
    key: `${line.key}${suffix}`,
    qty: 1,
    disc: 0,
    finalValue: toRands(value),
    price: toRands(value),
    stylistId,
  });

  const lines = invoice.lines.flatMap((l) =>
    l.key === key
      ? [asFixed(mine, line.stylistId, ""), asFixed(theirs, otherStylistId, "-split")]
      : [l]
  );

  return { ok: true, value: { ...invoice, lines } };
}

// --------------------------------------------------------------- payments

/** Relabels a payment. The amount is untouched, because the money arrived. */
export function setPaymentMethod(
  invoice: PlayInvoice,
  index: number,
  method: PaymentMethod
): PlayInvoice {
  if (index < 0 || index >= invoice.payments.length) return invoice;
  return {
    ...invoice,
    payments: invoice.payments.map((p, i) => (i === index ? { ...p, method } : p)),
  };
}

/**
 * Splits one payment across two methods — the client paid part cash and part
 * card, and it went through as one. The total taken is unchanged.
 */
export function splitPayment(
  invoice: PlayInvoice,
  index: number,
  method: PaymentMethod,
  amount: number
): AmendResult {
  const payment = invoice.payments[index];
  if (!payment) return { ok: false, error: "That payment is no longer on the docket." };
  const moving = toCents(amount);
  const held = toCents(payment.amount);
  if (moving <= 0) return { ok: false, error: "How much went on the other method?" };
  if (moving >= held) {
    return {
      ok: false,
      error: "That is the whole payment — change its method instead of splitting it.",
    };
  }

  const payments = invoice.payments.flatMap((p, i) =>
    i === index
      ? [
          { ...p, amount: toRands(held - moving) },
          { ...p, method, amount: toRands(moving), voucherNumber: undefined },
        ]
      : [p]
  );

  return { ok: true, value: { ...invoice, payments } };
}

// ------------------------------------------------------------------ trail

/** Adds a line to the invoice's own record of what was changed. */
export function recordAmendment(
  invoice: PlayInvoice,
  by: string,
  at: string,
  what: string
): PlayInvoice {
  return { ...invoice, amendments: [...(invoice.amendments ?? []), { by, at, what }] };
}
