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
}

export interface TillLine {
  key: string;
  descr: string;
  price: number;
  qty: number;
  disc: number;
  stylistId: number | null;
  kind: "service" | "product";
  mins?: number;
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
}
