import type {
  Payment,
  PriceOverride,
  TillLine,
  TillState,
  TillTotals,
} from "./types";

/** South African VAT, charged inclusive of the displayed price. */
export const VAT_RATE = 0.15;

/**
 * All arithmetic runs in cents so that repeated additions of prices like 0.1
 * cannot accumulate binary floating-point error.
 */
const toCents = (rands: number): number => Math.round((rands ?? 0) * 100);
const toRands = (cents: number): number => Math.round(cents) / 100;

export function emptyTill(): TillState {
  return {
    clientId: null,
    clientName: null,
    lines: [],
    payments: [],
    tips: [],
    startedAt: null,
  };
}

export type TillAction =
  | { type: "setClient"; clientId: number | null; clientName: string | null; at?: number }
  | { type: "add"; line: TillLine; at?: number }
  | { type: "remove"; key: string }
  | { type: "update"; key: string; patch: Partial<Omit<TillLine, "key">>; at?: number }
  | { type: "pay"; payment: Payment }
  | { type: "unpay"; index: number }
  | { type: "tip"; stylistId: number; amount: number }
  /** Restores a parked docket exactly as it was left. */
  | { type: "load"; state: TillState }
  | { type: "clear" };

/**
 * Cents charged for a single line, after quantity and percentage discount — or
 * exactly the amount typed at the counter, when there is one. A final value is
 * taken as read: it is the whole point of it that R500 for three items is R500,
 * not three times a rounded unit price.
 */
function lineCents(line: TillLine): number {
  if (line.finalValue != null) return toCents(line.finalValue);
  const gross = toCents(line.price) * (line.qty ?? 1);
  const discounted = gross * (1 - (line.disc ?? 0) / 100);
  return Math.round(discounted);
}

function subtotalCents(state: TillState): number {
  return state.lines.reduce((sum, line) => sum + lineCents(line), 0);
}

/**
 * Cash may be tendered above the balance (the difference is change). Every
 * other method is clamped to what is still owing, so a card or voucher can
 * never be over-captured.
 */
function tipCents(state: TillState): number {
  return state.tips.reduce((sum, t) => sum + toCents(t.amount), 0);
}

/**
 * What the client actually has to pay: the sale plus any tip.
 *
 * The tip is collected here so it cannot be forgotten at the card machine, but
 * it never enters `subtotal` — a tip is not turnover, and counting it would
 * inflate the stylist's sales and their commission.
 */
function dueCents(state: TillState): number {
  return subtotalCents(state) + tipCents(state);
}

function applicableCents(state: TillState, payment: Payment): number {
  const requested = toCents(payment.amount);
  if (requested <= 0) return 0;
  if (payment.method === "cash") return requested;

  const owing = dueCents(state) - paidCents(state);
  return Math.max(0, Math.min(requested, owing));
}

function paidCents(state: TillState): number {
  return state.payments.reduce((sum, p) => sum + toCents(p.amount), 0);
}

export function totals(state: TillState): TillTotals {
  const subtotal = subtotalCents(state);
  const tipTotal = tipCents(state);
  const due = subtotal + tipTotal;
  const paid = paidCents(state);
  const outstanding = due - paid;

  return {
    subtotal: toRands(subtotal),
    vat: toRands(Math.round((subtotal * VAT_RATE) / (1 + VAT_RATE))),
    tipTotal: toRands(tipTotal),
    dueTotal: toRands(due),
    paid: toRands(paid),
    balance: toRands(Math.max(0, outstanding)),
    change: toRands(Math.max(0, -outstanding)),
  };
}

/** Pure reducer: always returns a new state, never mutates the input. */
export function tillReduce(state: TillState, action: TillAction): TillState {
  const stamp = (next: TillState, at?: number): TillState =>
    next.startedAt == null && at != null ? { ...next, startedAt: at } : next;

  switch (action.type) {
    case "setClient":
      return stamp(
        { ...state, clientId: action.clientId, clientName: action.clientName },
        action.at
      );

    case "add":
      return stamp({ ...state, lines: [...state.lines, action.line] }, action.at);

    case "remove":
      return { ...state, lines: state.lines.filter((l) => l.key !== action.key) };

    case "update":
      return stamp(
        {
          ...state,
          lines: state.lines.map((l) => (l.key === action.key ? { ...l, ...action.patch } : l)),
        },
        action.at
      );

    case "pay": {
      const amount = toRands(applicableCents(state, action.payment));
      if (amount <= 0) return state;
      return { ...state, payments: [...state.payments, { ...action.payment, amount }] };
    }

    case "unpay":
      return { ...state, payments: state.payments.filter((_, i) => i !== action.index) };

    case "tip": {
      const others = state.tips.filter((t) => t.stylistId !== action.stylistId);
      if (action.amount <= 0) return { ...state, tips: others };
      return { ...state, tips: [...others, { stylistId: action.stylistId, amount: action.amount }] };
    }

    case "load":
      return action.state;

    case "clear":
      return emptyTill();

    default:
      return state;
  }
}

// ------------------------------------------------------- price overrides

/**
 * Cost price as the salon actually pays it.
 *
 * MySalon stores cost excluding VAT — its own manual is explicit about it — but
 * the figure reception needs to see is the one on the invoice from the supplier,
 * which includes VAT. Retail prices are already VAT-inclusive, so this puts the
 * two on the same footing.
 */
export function costIncl(costExVat: number): number {
  return toRands(Math.round(toCents(costExVat ?? 0) * (1 + VAT_RATE)));
}

const stampOverride = (
  line: TillLine,
  to: number,
  mode: "cost" | "final",
  by: string,
  at: string
): PriceOverride => ({ by, at, from: line.listPrice ?? line.price, to, mode });

/**
 * Sells a line at cost — a staff purchase, or a product handed over at what it
 * owed. Refused when the item has no cost on file, because charging zero by
 * accident is far worse than declining.
 */
export function applyCostPrice(line: TillLine, by: string, at: string): TillLine {
  if (line.cost == null || line.cost <= 0) return line;
  const price = costIncl(line.cost);
  return {
    ...line,
    listPrice: line.listPrice ?? line.price,
    price,
    finalValue: undefined,
    priceMode: "cost",
    override: stampOverride(line, price, "cost", by, at),
  };
}

/**
 * Charges an exact amount for the line. A fixed figure rather than a percentage,
 * so any discount already on the line is cleared — the two together would make
 * the number on the screen a guess.
 */
export function applyFinalValue(
  line: TillLine,
  finalValue: number,
  by: string,
  at: string
): TillLine {
  if (!Number.isFinite(finalValue) || finalValue < 0) return line;
  const value = toRands(toCents(finalValue));
  return {
    ...line,
    listPrice: line.listPrice ?? line.price,
    disc: 0,
    finalValue: value,
    priceMode: "final",
    override: stampOverride(line, value, "final", by, at),
  };
}

/** Puts a line back to the price on the menu, and forgets the override. */
export function restoreListPrice(line: TillLine): TillLine {
  const price = line.listPrice ?? line.price;
  return {
    ...line,
    price,
    listPrice: undefined,
    finalValue: undefined,
    priceMode: undefined,
    override: undefined,
  };
}

/** Seconds elapsed since the sale was started — the "under 30 seconds" clock. */
export function elapsedSeconds(state: TillState, now: number): number {
  if (state.startedAt == null) return 0;
  return Math.max(0, Math.round((now - state.startedAt) / 1000));
}
