import type { Payment, TillLine, TillState, TillTotals } from "./types";

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
  | { type: "clear" };

/** Cents charged for a single line, after quantity and percentage discount. */
function lineCents(line: TillLine): number {
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

    case "clear":
      return emptyTill();

    default:
      return state;
  }
}

/** Seconds elapsed since the sale was started — the "under 30 seconds" clock. */
export function elapsedSeconds(state: TillState, now: number): number {
  if (state.startedAt == null) return 0;
  return Math.max(0, Math.round((now - state.startedAt) / 1000));
}
