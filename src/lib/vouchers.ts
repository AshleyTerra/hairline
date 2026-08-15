/**
 * Gift vouchers.
 *
 * Two jobs, as the salon describes them: selling a new voucher, which goes onto
 * a docket like any other line, and redeeming one, which can happen a little at
 * a time across several visits.
 *
 * The money taken for a voucher belongs to the salon, not to a stylist — nobody
 * has done any work yet — so the line is a Hairline stock sale with no stylist
 * against it. The stylist earns when the voucher is redeemed against their work.
 */
import { validateTel } from "./staffAdmin";
import type { TillLine } from "./types";

/** Carries on from the salon's own voucher numbering. */
export const VOUCHER_SEED = 2019012151;

/** How long a voucher lasts unless someone says otherwise. */
export const DEFAULT_VOUCHER_MONTHS = 12;

export interface Redemption {
  /** YYYY-MM-DD. */
  date: string;
  amount: number;
  /** The invoice it was redeemed against, where there is one. */
  invoice?: number;
  /**
   * Who did the work the voucher paid for. The service value counts towards
   * their turnover for wages, while the cash itself was banked when the voucher
   * was sold — so it must not be counted as business turnover a second time.
   */
  stylistId?: number | null;
}

export interface Voucher {
  number: number;
  /** What is printed on the card. Defaults to the number. */
  barcode: string;
  /** Who bought it, when they are on file. */
  clientId: number | null;
  clientName: string;
  recipientName: string;
  recipientTel: string;
  amount: number;
  purchasedOn: string;
  expires: string;
  redemptions: Redemption[];
  /** The invoice the voucher was sold on. */
  soldOn?: number;
}

export interface VoucherDraft {
  recipientName: string;
  recipientTel: string;
  amount: number;
  expires: string;
  barcode: string;
}

export type VoucherResult = { ok: true; voucher: Voucher } | { ok: false; error: string };

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** The same day next year, or however many months the salon allows. */
export function expiryFrom(purchasedOn: string, months = DEFAULT_VOUCHER_MONTHS): string {
  const [y, m, d] = purchasedOn.split("-").map(Number);
  return iso(new Date(Date.UTC(y, (m ?? 1) - 1 + months, d ?? 1)));
}

export const nextVoucherNumber = (vouchers: readonly Voucher[]): number =>
  vouchers.reduce((max, v) => Math.max(max, v.number), VOUCHER_SEED) + 1;

export const usedOf = (voucher: Voucher): number =>
  voucher.redemptions.reduce((sum, r) => sum + r.amount, 0);

export const balanceOf = (voucher: Voucher): number =>
  Math.max(0, round(voucher.amount - usedOf(voucher)));

export const isExpired = (voucher: Voucher, on: string): boolean => on > voucher.expires;

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Issues a voucher, refusing anything that would leave it unusable. */
export function issueVoucher(
  existing: readonly Voucher[],
  draft: VoucherDraft,
  bought: { clientId: number | null; clientName: string; on: string; invoice?: number }
): VoucherResult {
  const recipientName = draft.recipientName.trim();
  if (!recipientName) return { ok: false, error: "Who is the voucher for? Add a name." };
  if (!Number.isFinite(draft.amount) || draft.amount <= 0) {
    return { ok: false, error: "A voucher needs an amount." };
  }
  if (draft.recipientTel.trim() && !validateTel(draft.recipientTel)) {
    return { ok: false, error: `“${draft.recipientTel}” does not look like a phone number.` };
  }
  if (!draft.expires || draft.expires <= bought.on) {
    return { ok: false, error: "The expiry date has to be after today." };
  }

  const barcode = draft.barcode.trim() || String(nextVoucherNumber(existing));
  if (existing.some((v) => v.barcode === barcode)) {
    return { ok: false, error: `Barcode ${barcode} is already on another voucher.` };
  }

  return {
    ok: true,
    voucher: {
      number: nextVoucherNumber(existing),
      barcode,
      clientId: bought.clientId,
      clientName: bought.clientName.trim() || "Walk-in",
      recipientName,
      recipientTel: draft.recipientTel.trim(),
      amount: round(draft.amount),
      purchasedOn: bought.on,
      expires: draft.expires,
      redemptions: [],
      soldOn: bought.invoice,
    },
  };
}

/**
 * The line a voucher puts on the docket. No stylist: the salon has taken money
 * for work nobody has done yet, so it is a Hairline stock sale.
 */
export function voucherLine(draft: VoucherDraft, key: string): TillLine {
  return {
    key,
    descr: `Gift voucher — ${draft.recipientName.trim() || "recipient"}`,
    price: round(draft.amount),
    qty: 1,
    disc: 0,
    stylistId: null,
    kind: "stock",
    voucher: draft,
  };
}

/** Barcode, voucher number, recipient or the client who bought it. */
export function findVouchers(vouchers: readonly Voucher[], query: string): Voucher[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return vouchers.filter(
    (v) =>
      v.barcode.toLowerCase() === q ||
      String(v.number) === q ||
      v.barcode.toLowerCase().includes(q) ||
      String(v.number).includes(q) ||
      v.recipientName.toLowerCase().includes(q) ||
      v.clientName.toLowerCase().includes(q) ||
      v.recipientTel.replace(/\s/g, "").includes(q.replace(/\s/g, ""))
  );
}

export type RedeemResult = { ok: true; voucher: Voucher } | { ok: false; error: string };

/**
 * Whether this much can come off the voucher today. `pending` covers anything
 * already promised on the sale in front of reception but not yet rung up.
 */
export function checkRedemption(
  voucher: Voucher,
  amount: number,
  on: string,
  pending = 0
): { ok: true; left: number } | { ok: false; error: string } {
  if (isExpired(voucher, on)) {
    return { ok: false, error: `That voucher expired on ${voucher.expires}.` };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "How much of it is being used?" };
  }
  const left = round(balanceOf(voucher) - Math.max(0, pending));
  if (left <= 0) return { ok: false, error: "That voucher is already fully used." };
  if (round(amount) > left) {
    return { ok: false, error: `Only ${left.toFixed(2)} is left on that voucher.` };
  }
  return { ok: true, left };
}

/**
 * Takes part or all of what is left. Nobody has to spend a voucher in one visit,
 * so whatever is not used stays on it for next time.
 */
export function redeem(
  voucher: Voucher,
  amount: number,
  on: string,
  invoice?: number,
  stylistId?: number | null
): RedeemResult {
  const check = checkRedemption(voucher, amount, on);
  if (!check.ok) return check;

  return {
    ok: true,
    voucher: {
      ...voucher,
      redemptions: [
        ...voucher.redemptions,
        { date: on, amount: round(amount), invoice, stylistId: stylistId ?? null },
      ],
    },
  };
}

/**
 * Everything redeemed in a period, across every voucher.
 *
 * This is the figure that has to come off business turnover: the salon banked
 * the money when it sold the voucher, so counting the service it later paid for
 * would count the same rand twice. The stylist still keeps it in their own
 * figures, which is what the reconciliation on the report makes plain.
 */
export function redeemedBetween(
  vouchers: readonly Voucher[],
  from: string,
  to: string
): number {
  let total = 0;
  for (const v of vouchers) {
    for (const r of v.redemptions) {
      if (r.date >= from && r.date <= to) total += r.amount;
    }
  }
  return round(total);
}

/** What is still owed to voucher holders — the salon's outstanding liability. */
export function outstandingAt(vouchers: readonly Voucher[], on: string): number {
  return round(
    vouchers
      .filter((v) => v.purchasedOn <= on && !isExpired(v, on))
      .reduce((sum, v) => sum + balanceOf(v), 0)
  );
}

export interface VoucherReportRow {
  number: number;
  barcode: string;
  client: string;
  purchased: string;
  recipient: string;
  tel: string;
  amount: number;
  used: number;
  outstanding: number;
  expires: string;
}

/** The salon's own report: what was sold, what has been used, what is still out. */
export function voucherReport(
  vouchers: readonly Voucher[],
  from: string,
  to: string
): VoucherReportRow[] {
  const lo = from <= to ? from : to;
  const hi = from <= to ? to : from;
  return vouchers
    .filter((v) => v.purchasedOn >= lo && v.purchasedOn <= hi)
    .sort((a, b) => a.number - b.number)
    .map((v) => ({
      number: v.number,
      barcode: v.barcode,
      client: v.clientName,
      purchased: v.purchasedOn,
      recipient: v.recipientName,
      tel: v.recipientTel,
      amount: v.amount,
      used: usedOf(v),
      outstanding: balanceOf(v),
      expires: v.expires,
    }));
}

export function voucherTotals(rows: readonly VoucherReportRow[]): {
  amount: number;
  used: number;
  outstanding: number;
} {
  return {
    amount: round(rows.reduce((sum, r) => sum + r.amount, 0)),
    used: round(rows.reduce((sum, r) => sum + r.used, 0)),
    outstanding: round(rows.reduce((sum, r) => sum + r.outstanding, 0)),
  };
}
