export type Role = "owner" | "reception" | "stylist";

export type StaffRole = "stylist" | "assistant" | "reception";

export interface ClockEntry {
  day: string;
  in: string | null;
  out: string | null;
}

export interface Staff {
  id: number;
  name: string;
  firstName: string;
  role: StaffRole;
  onDiary: boolean;
  startDate: string | null;
  serviceRevenue: number;
  retailRevenue: number;
  totalRevenue: number;
  invoices: number;
  retailShare: number;
  monthly: { ym: string; revenue: number }[];
  monthlyTarget: number;
  tips: { total: number; times: number; lastTip: string | null };
  subs: { total: number; times: number };
  clock: ClockEntry[];
}

export interface Service {
  id: number;
  dept: string;
  name: string;
  price: number;
  cost: number;
  mins: number;
  /** Times rung up in the last 13 months, so the till can lead with these. */
  timesSold: number;
}

export interface Product {
  id: number;
  name: string;
  brand: string;
  dept: string;
  cost: number;
  price: number;
  margin: number | null;
  qty: number;
  reorder: number;
  barcode: string | null;
  needsCount: boolean;
  lowStock: boolean;
  /** Times rung up in the last 13 months. */
  timesSold: number;
}

export interface ProductData {
  retail: Product[];
  backbar: Product[];
  till: Product[];
}

export interface VisitLine {
  descr: string;
  price: number;
  qty: number;
  disc: number;
  stylistId: number | null;
  kind: "service" | "product";
}

export interface Visit {
  id: number;
  clientId: number;
  date: string;
  total: number;
  payments: {
    cash: number;
    card: number;
    eft: number;
    toPay: number;
    voucher: number;
  };
  lines: VisitLine[];
}

export interface Client {
  id: number;
  name: string;
  firstName: string;
  surname: string;
  tel: string;
  email: string | null;
  birthday: string | null;
  firstVisit: string | null;
  lastVisit: string | null;
  visitCount: number;
  lifetimeSpend: number;
  avgTicket: number;
  prefStylistId: number | null;
  lapsed: boolean;
  vip: boolean;
  medical: string | null;
  notes: string | null;
}

export interface Booking {
  invoiceId: number;
  clientId: number;
  clientName: string;
  stylistId: number | null;
  service: string;
  dept: string;
  start: string;
  end: string;
  mins: number;
  total: number;
}

export interface DemoInvoice extends Visit {
  clientName: string;
}

export interface DemoDay {
  date: string;
  invoiceCount: number;
  totals: {
    total: number;
    cash: number;
    card: number;
    eft: number;
    toPay: number;
    voucher: number;
  };
  avgTicket: number;
  float: number;
  invoices: DemoInvoice[];
  bookings: Booking[];
}

export interface Analytics {
  revenueByYear: { year: number; invoices: number; revenue: number }[];
  revenueByMonth: { ym: string; invoices: number; revenue: number }[];
  dailyRevenue90: { date: string; invoices: number; revenue: number }[];
  topServices: { name: string; times: number; revenue: number }[];
  topProducts: { name: string; times: number; revenue: number }[];
  mixByYear: {
    year: number;
    service: number;
    retail: number;
    retailShare: number;
    partial: boolean;
  }[];
  paymentMix: {
    cash: number;
    card: number;
    eft: number;
    toPay: number;
    voucher: number;
    cardShare: number;
    cashShare: number;
  };
  retention: { active90: number; lapsed: number; oneTimers: number; loyal10plus: number };
  clientHealth: {
    activeClients: number;
    withBirthday: number;
    withEmail: number;
    withPhone: number;
  };
  stockHealth: {
    total: number;
    negative: number;
    zero: number;
    positive: number;
    valueOnHand: number;
  };
}

export interface Meta {
  company: string;
  /** The salon's highest invoice number so far; new dockets carry on from it. */
  lastInvoiceNumber: number;
  demoDate: string;
  dataAsOf: string;
  totalInvoicesAllTime: number;
  activeClientsAllTime: number;
  clientsInDemo: number;
  servicesInDemo: number;
  productsInDemo: number;
  firstInvoiceYear: number;
  generatedFrom: string;
  privacy: string;
}

// ------------------------------------------------------------------ till

export type PaymentMethod = "cash" | "card" | "eft" | "topay" | "voucher";

export interface Payment {
  method: PaymentMethod;
  amount: number;
  /**
   * Set when the payment is a voucher. The voucher is only drawn down once the
   * sale completes, so removing the payment — or voiding the sale — leaves the
   * client's balance untouched.
   */
  voucherNumber?: number;
  /**
   * Who did the work a voucher is paying for. Kept on the payment so the credit
   * survives a docket parked half-finished, and applied when the sale completes.
   */
  voucherStylistId?: number | null;
}

/** Why a line is not being charged at its list price. */
export type PriceMode = "cost" | "final";

/** Kept whenever a price is changed at the counter, so the change is answerable. */
export interface PriceOverride {
  /** The signed-in user who made the change. */
  by: string;
  /** When, as an ISO timestamp on the trading day. */
  at: string;
  /** The list price before the change. */
  from: number;
  /** What is being charged instead. */
  to: number;
  mode: PriceMode;
}

export interface TillLine {
  key: string;
  descr: string;
  price: number;
  qty: number;
  disc: number;
  stylistId: number | null;
  /** "stock" is a Hairline sale — a voucher, say — with no stylist behind it. */
  kind: "service" | "product" | "stock";
  mins?: number;
  /** Cost price excluding VAT, as MySalon stores it. Retail and stock only. */
  cost?: number;
  /** The unit price as listed when the line was added, kept through an override. */
  listPrice?: number;
  /**
   * An exact amount for the whole line, typed at the counter. Held separately
   * from `price` so the figure asked for is the figure charged, whatever the
   * quantity — a fixed amount, not a percentage off.
   */
  finalValue?: number;
  /** Absent when the line is being charged at its list price. */
  priceMode?: PriceMode;
  override?: PriceOverride;
  /**
   * Set on a voucher line. The voucher itself is issued when the sale completes,
   * so a docket parked half-finished keeps everything needed to issue it later.
   */
  voucher?: {
    recipientName: string;
    recipientTel: string;
    amount: number;
    expires: string;
    barcode: string;
  };
}

export interface Tip {
  stylistId: number;
  amount: number;
}

export interface TillState {
  clientId: number | null;
  clientName: string | null;
  lines: TillLine[];
  payments: Payment[];
  tips: Tip[];
  startedAt: number | null;
}

export interface TillTotals {
  /** Services and products only — this is the stylist's sales figure. */
  subtotal: number;
  vat: number;
  tipTotal: number;
  /** Subtotal plus tip: what the client actually pays. */
  dueTotal: number;
  paid: number;
  balance: number;
  change: number;
}

/** A client captured at the till during the demo. */
/** One paid invoice as it appears in the day book. Keys are short to keep the file small. */
export interface DayBookEntry {
  /** Invoice number. */
  n: number;
  /** Date, YYYY-MM-DD. */
  d: string;
  /** Time, HH:MM. */
  t: string;
  /** Client name. */
  c: string;
  /** Stylist id. */
  s: number;
  /** Invoice total. */
  v: number;
  /** Number of items. */
  i: number;
  /** Lines as [descriptionIndex, qty, unitPrice, discountPercent, stylistId]. */
  L: number[][];
  /** Payments actually used, as [method, amount]. */
  p: (string | number)[][];
}

export interface DayBook {
  from: string;
  to: string;
  /** Item descriptions, referenced by index from each line. */
  dict: string[];
  days: Record<string, DayBookEntry[]>;
}

export interface NewClient {
  /** Negative, to stay clear of the migrated client file. */
  id: number;
  name: string;
  tel: string;
  email: string;
  /**
   * Day and month only, as "--MM-DD". The salon wants birthdays for greetings,
   * not ages, and the migrated file's years are MySalon artefacts anyway.
   */
  birthday: string;
  notes: string;
  /**
   * True when captured under the simplified walk-in rule. Marked so a
   * deliberately incomplete record is never mistaken for a full client file.
   */
  walkIn: boolean;
}

/** One correction made to a docket after it was closed. */
export interface InvoiceAmendment {
  by: string;
  at: string;
  what: string;
}

/** A completed sale rung up in the prototype. */
export interface PlayInvoice {
  id: number;
  clientId: number | null;
  clientName: string;
  date: string;
  total: number;
  lines: TillLine[];
  payments: Payment[];
  tips: Tip[];
  seconds: number;
  /**
   * Corrections made after the docket was closed — a stylist split that was
   * missed, or a payment type chosen in haste. Absent on a sale nobody touched.
   */
  amendments?: InvoiceAmendment[];
}
