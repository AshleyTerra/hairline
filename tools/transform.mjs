/**
 * Transforms the raw MySalon extract into the prototype's committed dataset.
 *
 * Real: services, prices, costs, products, barcodes, revenue, visit patterns, staff first names.
 * Pseudonymized: client names, phones, emails, birthdays (shifted), notes.
 *
 * Deterministic: same input always yields the same output (seeded RNG).
 *
 * Usage: node tools/transform.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAW =
  process.env.HAIRLINE_RAW ||
  "C:\\temp\\claude\\c--Data-OneDrive---Terra-Group-Applications-Hairline\\6305bd13-c82c-4c05-b471-9115eecd7529\\scratchpad\\extract";
const OUT = join(__dirname, "..", "src", "data");

const SEED = 20260805;

// ---------------------------------------------------------------- utilities

function load(name) {
  // PowerShell writes a UTF-8 BOM that JSON.parse rejects.
  return JSON.parse(readFileSync(join(RAW, `${name}.raw.json`), "utf8").replace(/^﻿/, ""));
}

/** mulberry32 - small deterministic PRNG */
function rngFrom(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable per-id RNG so a client always gets the same pseudonym. */
function idRng(id) {
  return rngFrom((SEED + Number(id) * 2654435761) >>> 0);
}

const money = (v) => Math.round(Number(v || 0) * 100) / 100;
const num = (v) => Number(v || 0);
const pick = (arr, r) => arr[Math.floor(r() * arr.length) % arr.length];

/** Strips MySalon's sort-order prefixes: "1 Karin" -> "Karin" */
const cleanName = (s) =>
  String(s || "")
    .replace(/^\s*\d+\s+/, "")
    .replace(/\s+/g, " ")
    .trim();

const titleCase = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\b(Ml|Kg)\b/g, (m) => m.toLowerCase());

// ------------------------------------------------------- pseudonym name pool

const FIRST_NAMES = [
  "Amahle", "Anele", "Anika", "Ayanda", "Bianca", "Bongi", "Candice", "Carmen",
  "Chantel", "Charlize", "Chloe", "Danielle", "Dineo", "Elmarie", "Erin",
  "Fatima", "Gugu", "Hannah", "Hlengiwe", "Ilse", "Imke", "Jade", "Jodi",
  "Kanya", "Karabo", "Keshni", "Khanyi", "Kirsten", "Lebo", "Leandi", "Lerato",
  "Lindiwe", "Lisa", "Mandisa", "Marise", "Megan", "Melissa", "Mpho", "Naledi",
  "Nadia", "Nandi", "Nomsa", "Nthabiseng", "Palesa", "Petra", "Priya", "Refilwe",
  "Retha", "Riana", "Robyn", "Sanele", "Sarah", "Shanaaz", "Sibongile", "Simone",
  "Sinead", "Tanya", "Tasneem", "Thandi", "Thato", "Tracy", "Vanessa", "Yolandi",
  "Zanele", "Zinhle", "Adriaan", "Ashwin", "Ben", "Bradley", "Cameron", "Craig",
  "Devan", "Dylan", "Ethan", "Faizel", "Gareth", "Grant", "Hendrik", "Ismail",
  "Jarryd", "Johan", "Kagiso", "Keegan", "Kyle", "Lwazi", "Marius", "Mothusi",
  "Nkosi", "Pieter", "Rajesh", "Riaan", "Ryan", "Sipho", "Stefan", "Themba",
  "Tumelo", "Warren", "Wesley", "Xolani", "Zaid",
];

const SURNAMES = [
  "Abrahams", "Adams", "Baloyi", "Barnard", "Bezuidenhout", "Booysen", "Botha",
  "Brits", "Cele", "Coetzee", "Cronje", "Daniels", "De Beer", "De Villiers",
  "Dlamini", "Du Plessis", "Ferreira", "Fourie", "Fredericks", "Gouws",
  "Govender", "Greyling", "Hlongwane", "Human", "Isaacs", "Jacobs", "Joubert",
  "Kekana", "Khumalo", "Kruger", "Labuschagne", "Lombard", "Louw", "Mabaso",
  "Madonsela", "Mahlangu", "Maluleke", "Marais", "Mashaba", "Masondo", "Mathebula",
  "Mbatha", "Meyer", "Mkhize", "Mokoena", "Molefe", "Moodley", "Motaung",
  "Mthembu", "Naidoo", "Nel", "Ngcobo", "Nkosi", "Ntuli", "Oosthuizen", "Peters",
  "Pillay", "Potgieter", "Pretorius", "Radebe", "Ramaphosa", "Reddy", "Roos",
  "Sithole", "Smit", "Snyman", "Steyn", "Swanepoel", "Theron", "Tshabalala",
  "Van Der Merwe", "Van Niekerk", "Van Wyk", "Venter", "Vermeulen", "Viljoen",
  "Visser", "Williams", "Xaba", "Zulu", "Zwane", "Da Silva", "Ferreira",
  "Goncalves", "Pereira", "Sousa", "Khan", "Patel", "Osman", "Sayed",
];

const NOTE_TEMPLATES = [
  "Prefers 20 vol on regrowth only — scalp sensitive.",
  "Patch test done Feb — no reaction.",
  "Likes a blunt line, no texturising at the ends.",
  "Books standing appointment every 5 weeks.",
  "Colour formula: 6.0 + 6.34 (1:1) 30g, 20 vol.",
  "Prefers Karin, will wait rather than switch.",
  "Allergic to PPD — use ammonia-free line only.",
  "Always takes home the treatment masque.",
  "Wedding client — trial booked before the day.",
  "Doesn't like the neck rest, use the folded towel.",
  "Colour formula: 8.1 + 9.1 (2:1) 40g, 30 vol on lengths.",
  "Prefers early morning slots before work.",
];

const MED_NOTES = [
  "Sensitive scalp — patch test required before every colour service.",
  "Pregnant — avoid ammonia products, ventilate station.",
  "On medication affecting hair porosity — adjust developer.",
];

/** Deterministic realistic stand-in identity for a real client id. */
function pseudonym(id) {
  const r = idRng(id);
  const first = pick(FIRST_NAMES, r);
  const sur = pick(SURNAMES, r);
  const tel = `0${pick(["82", "83", "72", "73", "76", "78", "84", "60", "61", "71"], r)} ${String(
    Math.floor(r() * 900 + 100)
  )} ${String(Math.floor(r() * 9000 + 1000))}`;
  return {
    name: `${first} ${sur}`,
    firstName: first,
    surname: sur,
    tel,
    email: `${first.toLowerCase()}.${sur.toLowerCase().replace(/[^a-z]/g, "")}@example.co.za`,
  };
}

function shiftDate(iso, days) {
  if (!iso) return null;
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const daysBetween = (a, b) =>
  Math.round(
    (new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400000
  );

// ------------------------------------------------------------------- load in

const rawMeta = load("meta")[0];
const rawStaff = load("staff");
const rawServices = load("services");
const rawProducts = load("products");
const rawClients = load("clients");
const rawInvoices = load("invoices13m");
const revenueByYear = load("revenueByYear");
const revenueByMonth = load("revenueByMonth");
const topServices = load("topServices");
const topProducts = load("topProducts");
const stylistPerf = load("stylistPerf");
const stylistMonthly = load("stylistMonthly");
const demoDayRow = load("demoDay")[0];
const tipsAllTime = load("tipsAllTime");
const subsAllTime = load("subsAllTime");
const dailyRevenue90 = load("dailyRevenue90");
const mixByYear = load("mixByYear");
const paymentMix = load("paymentMix12m")[0];
const demoDayInvoices = load("demoDayInvoices");
const demoDayClients = load("demoDayClients");
const stockHealth = load("stockHealth")[0];
const clientHealth = load("clientHealth")[0];
const retention = load("retention")[0];
const clockRecent = load("clockRecent");

const DEMO_DATE = String(demoDayRow.d).slice(0, 10);

// -------------------------------------------------------------------- staff

/** Placeholder rows in MySalon's Stylists table, e.g. "Stock Salone Use". */
const NON_PERSON_STAFF = /^(stock|salon|house|comp|admin|test)\b/i;

const staff = rawStaff
  .filter((s) => !NON_PERSON_STAFF.test(cleanName(s.firstName)))
  .map((s) => {
  const first = cleanName(s.firstName).split(" ")[0];
  const surInitial = cleanName(s.surname).charAt(0).toUpperCase();
  const perf = stylistPerf.find((p) => p.stylistId === s.id);
  const tips = tipsAllTime.find((t) => t.stylistId === s.id);
  const subs = subsAllTime.find((t) => t.stylistId === s.id);
  const monthly = stylistMonthly
    .filter((m) => m.stylistId === s.id)
    .sort((a, b) => String(a.ym).localeCompare(String(b.ym)))
    .map((m) => ({ ym: m.ym, revenue: money(m.revenue) }));
  const serviceRevenue = money(perf?.serviceRevenue);
  const retailRevenue = money(perf?.retailRevenue);
  // Assistants clock in and earn tips, but MySalon bills their work under the
  // senior stylist, so no revenue is attributed to them.
  const role = s.isReception
    ? "reception"
    : serviceRevenue + retailRevenue > 0
      ? "stylist"
      : "assistant";
  return {
    id: s.id,
    name: `${first}${surInitial ? ` ${surInitial}.` : ""}`,
    firstName: first,
    role,
    onDiary: Boolean(s.onDiary),
    startDate: s.startDate ? String(s.startDate).slice(0, 10) : null,
    serviceRevenue,
    retailRevenue,
    totalRevenue: money(serviceRevenue + retailRevenue),
    invoices: num(perf?.invoices),
    retailShare: serviceRevenue + retailRevenue > 0
      ? Math.round((retailRevenue / (serviceRevenue + retailRevenue)) * 1000) / 10
      : 0,
    monthly,
    tips: { total: money(tips?.total), times: num(tips?.times), lastTip: tips?.lastTip || null },
    subs: { total: money(subs?.total), times: num(subs?.times) },
  };
});

const activeStylists = staff.filter((s) => s.role === "stylist" && s.totalRevenue > 0);

// Monthly target = 110% of their best month in the last 12 (an honest stretch goal)
for (const s of staff) {
  const best = s.monthly.reduce((m, x) => Math.max(m, x.revenue), 0);
  s.monthlyTarget = best > 0 ? Math.round((best * 1.1) / 500) * 500 : 0;
}

// Clock: re-date the most recent clock records onto the demo week
const clockByStylist = new Map();
{
  const sorted = [...clockRecent]
    .filter((c) => c.clockIn)
    .sort((a, b) => String(b.clockIn).localeCompare(String(a.clockIn)));
  const latestDay = sorted.length ? String(sorted[0].day).slice(0, 10) : DEMO_DATE;
  const offset = daysBetween(latestDay, DEMO_DATE);
  for (const c of sorted) {
    const day = shiftDate(String(c.day).slice(0, 10), offset);
    if (!day) continue;
    const gap = daysBetween(day, DEMO_DATE);
    if (gap < 0 || gap > 6) continue; // demo week only
    const list = clockByStylist.get(c.stylistId) || [];
    if (list.some((x) => x.day === day)) continue;
    list.push({
      day,
      in: c.clockIn ? String(c.clockIn).slice(11, 16) : null,
      out: c.clockOut ? String(c.clockOut).slice(11, 16) : null,
    });
    clockByStylist.set(c.stylistId, list);
  }
}
for (const s of staff) {
  s.clock = (clockByStylist.get(s.id) || []).sort((a, b) => a.day.localeCompare(b.day));
}

// ------------------------------------------------------------------ services

const SERVICE_DEPTS = new Set([
  "General", "Colour", "Perm", "Treatments", "Brazillian", "Extensions",
  "MK Straightners", "Welle straight",
]);

const DEPT_LABEL = {
  General: "Cutting & Styling",
  Colour: "Colour",
  Perm: "Perms",
  Treatments: "Treatments",
  Brazillian: "Brazilian & Keratin",
  Extensions: "Extensions",
  "MK Straightners": "Mycro Keratin",
  "Welle straight": "Wella Straightening",
};

/** Capitalises names typed in lower case without wrecking codes like "BBX 10ML". */
const tidyServiceName = (s) => {
  const t = String(s || "").trim();
  return /^[a-z]/.test(t) ? t.charAt(0).toUpperCase() + t.slice(1) : t;
};

/**
 * How often each item was actually rung up over the last 13 months, so the till
 * can lead with what reception reaches for most instead of an alphabetical list.
 */
const timesSold = new Map();
for (const line of rawInvoices) {
  const key = String(line.descr || "").trim().toLowerCase();
  if (!key) continue;
  timesSold.set(key, (timesSold.get(key) ?? 0) + 1);
}
const popularityOf = (name) => timesSold.get(String(name || "").trim().toLowerCase()) ?? 0;

const serviceByName = new Map();
for (const s of rawServices) {
  if (!SERVICE_DEPTS.has(s.dept)) continue;
  const name = tidyServiceName(s.name);
  if (!name || num(s.price) <= 0) continue;
  const prev = serviceByName.get(name.toLowerCase());
  if (!prev || s.id > prev.id) {
    serviceByName.set(name.toLowerCase(), {
      id: s.id,
      dept: DEPT_LABEL[s.dept] || s.dept,
      name,
      price: money(s.price),
      cost: money(s.cost),
      mins: Number.parseInt(String(s.mins || "").replace(/\D/g, ""), 10) || 45,
    });
  }
}
/** Departments in the order reception actually reaches for them. */
const DEPT_ORDER = [
  "Cutting & Styling",
  "Colour",
  "Treatments",
  "Brazilian & Keratin",
  "Extensions",
  "Mycro Keratin",
  "Perms",
  "Wella Straightening",
];

const deptRank = (d) => {
  const i = DEPT_ORDER.indexOf(d);
  return i === -1 ? DEPT_ORDER.length : i;
};

// Most-used first within each department: that is the order reception scans in.
const services = [...serviceByName.values()]
  .map((s) => ({ ...s, timesSold: popularityOf(s.name) }))
  .sort(
    (a, b) =>
      deptRank(a.dept) - deptRank(b.dept) || b.timesSold - a.timesSold || a.price - b.price
  );

const serviceLookup = new Map(services.map((s) => [s.name.toLowerCase(), s]));

// ------------------------------------------------------------------ products

function mapProduct(p) {
  const qty = num(p.qty);
  const cost = money(p.cost);
  const price = money(p.price);
  return {
    id: p.id,
    name: titleCase(String(p.name || "").trim()),
    brand: titleCase(String(p.vendor || "").trim()) || "Unbranded",
    dept: String(p.dept || "").replace(/\s*(Retail|Stock)$/i, "").trim() || "Other",
    cost,
    price,
    margin: price > 0 && cost > 0 ? Math.round(((price - cost) / price) * 1000) / 10 : null,
    qty,
    reorder: num(p.reorder),
    barcode: p.barcode ? String(p.barcode).trim() : null,
    // Honest data-quality flag: MySalon lets stock go negative.
    needsCount: qty < 0,
    lowStock: qty >= 0 && num(p.reorder) > 0 && qty <= num(p.reorder),
  };
}

// Back-bar products are used on clients, not sold, so many carry a cost but no
// retail price. Keep anything that has either.
const allProducts = rawProducts
  .filter((p) => String(p.name || "").trim() && (num(p.price) > 0 || num(p.cost) > 0))
  .map(mapProduct);

const withPopularity = (p) => ({ ...p, timesSold: popularityOf(p.name) });

const products = {
  retail: allProducts
    .filter((p) => rawProducts.find((r) => r.id === p.id)?.kind === "R")
    .map(withPopularity)
    .sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name)),
  backbar: allProducts
    .filter((p) => rawProducts.find((r) => r.id === p.id)?.kind === "Stock Item")
    .map(withPopularity)
    .sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name)),
};

// Retail for the till: grouped by vendor, most-sold first inside each vendor.
const tillProducts = products.retail
  .filter((p) => p.price > 0)
  .sort((a, b) => b.timesSold - a.timesSold || b.qty - a.qty)
  .slice(0, 120)
  .sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name));

// ------------------------------------------------------------------- clients

/** invoice id -> { header, lines[] } for the 13-month window */
function groupInvoices(rows) {
  const byInvoice = new Map();
  for (const r of rows) {
    let inv = byInvoice.get(r.id);
    if (!inv) {
      inv = {
        id: r.id,
        clientId: r.clientId,
        date: String(r.date).slice(0, 19).replace(" ", "T"),
        total: money(r.total),
        payments: {
          cash: money(r.cash), card: money(r.card), eft: money(r.eft),
          toPay: money(r.toPay), voucher: money(r.voucher),
        },
        lines: [],
      };
      byInvoice.set(r.id, inv);
    }
    inv.lines.push({
      descr: String(r.descr || "").trim(),
      price: money(r.price),
      qty: num(r.qty) || 1,
      disc: num(r.disc),
      stylistId: r.stylistId,
      kind: r.kind === "R" ? "product" : "service",
    });
  }
  return [...byInvoice.values()];
}

// The demo presents DEMO_DATE as "today", so nothing in the dataset may be
// dated after it. A handful of visits fall in the few trading days that follow.
const invoices13m = groupInvoices(rawInvoices).filter(
  (inv) => inv.date.slice(0, 10) <= DEMO_DATE
);
const visitsByClient = new Map();
for (const inv of invoices13m) {
  const list = visitsByClient.get(inv.clientId) || [];
  list.push(inv);
  visitsByClient.set(inv.clientId, list);
}

const spends = rawClients.map((c) => num(c.lifetimeSpend)).sort((a, b) => b - a);
const vipThreshold = spends[Math.floor(spends.length * 0.1)] || Infinity;

const clients = rawClients.map((c) => {
  const p = pseudonym(c.id);
  const r = idRng(c.id + 7);
  const visits = (visitsByClient.get(c.id) || [])
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 40);
  const rawLast = c.lastVisit ? String(c.lastVisit).slice(0, 10) : null;
  // Pull a post-demo-day last visit back to the newest visit we still show.
  const lastVisit =
    rawLast && rawLast > DEMO_DATE ? (visits[0]?.date.slice(0, 10) ?? null) : rawLast;
  const lifetimeSpend = money(c.lifetimeSpend);
  const visitCount = num(c.visitCount);
  const gapDays = lastVisit ? daysBetween(lastVisit, DEMO_DATE) : null;
  const hasMed = num(c.med) !== 0;
  // Notes are absent in the source; seed a realistic subset so the screen has content.
  const wantsNote = r() < 0.35;
  return {
    id: c.id,
    name: p.name,
    firstName: p.firstName,
    surname: p.surname,
    tel: p.tel,
    email: c.email ? p.email : null,
    birthday: c.bday ? shiftDate(String(c.bday).slice(0, 10), Math.floor(r() * 29) - 14) : null,
    firstVisit: c.firstVisit ? String(c.firstVisit).slice(0, 10) : null,
    lastVisit,
    visitCount,
    lifetimeSpend,
    avgTicket: visitCount > 0 ? money(lifetimeSpend / visitCount) : 0,
    prefStylistId: c.prefStylist || null,
    lapsed: gapDays !== null && gapDays > 90,
    vip: lifetimeSpend >= vipThreshold,
    medical: hasMed ? pick(MED_NOTES, r) : null,
    notes: wantsNote ? pick(NOTE_TEMPLATES, r) : null,
    visits,
  };
});

// ------------------------------------------------------------------ demo day

const demoInvoices = groupInvoices(demoDayInvoices).sort((a, b) => a.date.localeCompare(b.date));
const demoClientIds = new Set(demoDayClients.map((c) => c.id));
const demoClientNames = new Map(
  [...demoClientIds].map((id) => [id, pseudonym(id).name])
);

/**
 * MySalon's AppMins field is largely left at its default, so a diary built from
 * it collapses into 15-minute blocks. Chair time is estimated from the service
 * instead, which is both more realistic and how the salon actually books.
 */
function chairMinutes(descr, dept) {
  const d = String(descr).toLowerCase();
  if (/tape|weave|bond|extension|volo|hair ?piece/.test(d)) return 150;
  if (/bbx|braz|keratin|mycro|straight/.test(d)) return 120;
  if (/highlight|foil|balayage|whl|full head/.test(d)) return 120;
  if (/tint|colour|color|toner|regrowth|roots/.test(d)) return 75;
  if (/perm/.test(d)) return 90;
  if (/treatment|trichoton|olaplex|masque|dht/.test(d)) return 30;
  if (/cut and blow|cut & blow/.test(d)) return 60;
  if (/blow ?wave|blow ?dry/.test(d)) return 45;
  if (/cut|trim|fringe/.test(d)) return 30;
  if (/wash|shampoo|spray/.test(d)) return 15;
  if (dept === "Colour") return 75;
  return 45;
}

const OPENING_MIN = 7 * 60;
const END_OF_DAY_MIN = 19 * 60;
const clampMinutes = (m) => Math.max(OPENING_MIN + 15, Math.min(END_OF_DAY_MIN, m));
const hhmm = (m) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.round(m) % 60).padStart(2, "0")}`;

const bookings = demoInvoices.map((inv) => {
  const mainLine =
    inv.lines.find((l) => l.kind === "service") || inv.lines[0] || { descr: "Service", stylistId: null };
  const svc = serviceLookup.get(String(mainLine.descr).toLowerCase());
  const dept = svc?.dept || "Cutting & Styling";
  const mins = chairMinutes(mainLine.descr, dept);

  // The invoice is rung up at checkout, so it marks the END of the appointment.
  const [ih, im] = inv.date.slice(11, 16).split(":").map(Number);
  const endMin = clampMinutes(ih * 60 + im);
  // Never let the clamp push the start past the end.
  const startMin = Math.min(endMin - 15, Math.max(OPENING_MIN, endMin - mins));

  return {
    invoiceId: inv.id,
    clientId: inv.clientId,
    clientName: demoClientNames.get(inv.clientId) || pseudonym(inv.clientId).name,
    stylistId: mainLine.stylistId,
    service: mainLine.descr,
    dept,
    start: hhmm(startMin),
    end: hhmm(endMin),
    mins: endMin - startMin,
    total: inv.total,
  };
});

const knownStaffIds = new Set(staff.map((s) => s.id));

const demoTotals = demoInvoices.reduce(
  (acc, inv) => ({
    total: money(acc.total + inv.total),
    cash: money(acc.cash + inv.payments.cash),
    card: money(acc.card + inv.payments.card),
    eft: money(acc.eft + inv.payments.eft),
    toPay: money(acc.toPay + inv.payments.toPay),
    voucher: money(acc.voucher + inv.payments.voucher),
  }),
  { total: 0, cash: 0, card: 0, eft: 0, toPay: 0, voucher: 0 }
);

const demoday = {
  date: DEMO_DATE,
  invoiceCount: demoInvoices.length,
  totals: demoTotals,
  avgTicket: demoInvoices.length ? money(demoTotals.total / demoInvoices.length) : 0,
  float: 850,
  invoices: demoInvoices.map((inv) => ({
    ...inv,
    clientName: demoClientNames.get(inv.clientId) || pseudonym(inv.clientId).name,
  })),
  bookings: bookings
    .filter((b) => knownStaffIds.has(b.stylistId))
    .sort((a, b) => a.start.localeCompare(b.start)),
};

// ----------------------------------------------------------------- analytics

const totalMix12m =
  num(paymentMix.cash) + num(paymentMix.card) + num(paymentMix.eft) +
  num(paymentMix.toPay) + num(paymentMix.voucher);

// The data ends mid-month, so the final month is incomplete and would render as
// a cliff on any trend line. Drop it rather than imply a collapse in trade.
const lastCompleteMonth = String(rawMeta.maxInvoiceDate).slice(0, 7);
const lastCompleteYear = Number(String(rawMeta.maxInvoiceDate).slice(0, 4));

const analytics = {
  revenueByYear: revenueByYear
    .map((r) => ({ year: r.yr, invoices: r.invoices, revenue: money(r.revenue) }))
    .sort((a, b) => a.year - b.year),
  revenueByMonth: revenueByMonth
    .filter((r) => String(r.ym) < lastCompleteMonth)
    .map((r) => ({ ym: r.ym, invoices: r.invoices, revenue: money(r.revenue) }))
    .sort((a, b) => String(a.ym).localeCompare(String(b.ym))),
  dailyRevenue90: dailyRevenue90
    .map((r) => ({ date: r.d, invoices: r.invoices, revenue: money(r.revenue) }))
    .sort((a, b) => String(a.date).localeCompare(String(b.date))),
  topServices: topServices.map((t) => ({
    name: String(t.name).trim(), times: t.times, revenue: money(t.revenue),
  })),
  topProducts: topProducts.map((t) => ({
    name: titleCase(String(t.name).trim()), times: t.times, revenue: money(t.revenue),
  })),
  mixByYear: mixByYear
    .map((m) => ({
      year: m.yr, service: money(m.service), retail: money(m.retail),
      retailShare: Math.round((money(m.retail) / (money(m.service) + money(m.retail))) * 1000) / 10,
      partial: m.yr >= lastCompleteYear,
    }))
    .sort((a, b) => a.year - b.year),
  paymentMix: {
    cash: money(paymentMix.cash), card: money(paymentMix.card), eft: money(paymentMix.eft),
    toPay: money(paymentMix.toPay), voucher: money(paymentMix.voucher),
    cardShare: totalMix12m ? Math.round((num(paymentMix.card) / totalMix12m) * 1000) / 10 : 0,
    cashShare: totalMix12m ? Math.round((num(paymentMix.cash) / totalMix12m) * 1000) / 10 : 0,
  },
  retention: {
    active90: num(retention.active90),
    lapsed: num(retention.lapsed),
    oneTimers: num(retention.oneTimers),
    loyal10plus: num(retention.loyal10plus),
  },
  clientHealth: {
    activeClients: num(clientHealth.activeClients),
    withBirthday: num(clientHealth.withBirthday),
    withEmail: num(clientHealth.withEmail),
    withPhone: num(clientHealth.withPhone),
  },
  stockHealth: {
    total: num(stockHealth.total),
    negative: num(stockHealth.negative),
    zero: num(stockHealth.zero),
    positive: num(stockHealth.positive),
    valueOnHand: money(stockHealth.valueOnHand),
  },
};

// ---------------------------------------------------------------------- meta

// The salon's highest invoice number so far: new dockets carry on from here.
const lastInvoiceNumber = rawInvoices.reduce((max, i) => Math.max(max, num(i.id)), 0);

// ------------------------------------------------------------------ day book
/**
 * Who came in on any given day, so reception can pick a date — or a range —
 * instead of only ever seeing today. Built from the real invoice history and
 * capped to keep the download reasonable.
 */
const DAYBOOK_DAYS = 180;

const daybookFrom = (() => {
  const d = new Date(`${DEMO_DATE}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - DAYBOOK_DAYS);
  return d.toISOString().slice(0, 10);
})();

/**
 * Item descriptions repeat constantly, so they are held once in a dictionary and
 * referenced by index. That keeps every docket's lines available for viewing
 * without the file ballooning.
 */
const descrDict = [];
const descrIndex = new Map();
const descrId = (text) => {
  const key = String(text ?? "").trim();
  if (!descrIndex.has(key)) {
    descrIndex.set(key, descrDict.length);
    descrDict.push(key);
  }
  return descrIndex.get(key);
};

const invoiceIndex = new Map();
for (const row of rawInvoices) {
  const stamp = String(row.date ?? "");
  const day = stamp.slice(0, 10);
  if (!day || day < daybookFrom || day > DEMO_DATE) continue;

  let inv = invoiceIndex.get(row.id);
  if (!inv) {
    inv = {
      n: num(row.id),
      d: day,
      t: stamp.slice(11, 16),
      c: pseudonym(num(row.clientId)).name,
      s: num(row.stylistId),
      v: money(row.total),
      i: 0,
      // [descriptionIndex, qty, unitPrice, discountPercent, stylistId]
      L: [],
      // Only the methods actually used, e.g. [["card", 780]]
      p: [
        ["cash", money(row.cash)],
        ["card", money(row.card)],
        ["eft", money(row.eft)],
        ["topay", money(row.toPay)],
        ["voucher", money(row.voucher)],
      ].filter(([, amount]) => amount > 0),
    };
    invoiceIndex.set(row.id, inv);
  }
  inv.i += 1;
  inv.L.push([descrId(row.descr), num(row.qty) || 1, money(row.price), num(row.disc), num(row.stylistId)]);
}

const daybook = {};
for (const inv of invoiceIndex.values()) {
  (daybook[inv.d] ??= []).push(inv);
}
for (const day of Object.keys(daybook)) {
  daybook[day].sort((a, b) => a.t.localeCompare(b.t));
}

const meta = {
  lastInvoiceNumber,
  company: rawMeta.companyName || "Hairline",
  demoDate: DEMO_DATE,
  dataAsOf: String(rawMeta.maxInvoiceDate).slice(0, 10),
  totalInvoicesAllTime: num(rawMeta.totalInvoices),
  activeClientsAllTime: num(rawMeta.activeClients),
  clientsInDemo: clients.length,
  servicesInDemo: services.length,
  productsInDemo: products.retail.length + products.backbar.length,
  firstInvoiceYear: analytics.revenueByYear[0]?.year ?? 2015,
  generatedFrom: "MySalon SQL Server backup, 29 July 2026",
  privacy:
    "Client names, phone numbers, e-mail addresses and birthdays are anonymised stand-ins. " +
    "Services, prices, products, revenue, visit patterns and staff are real.",
};

// ------------------------------------------------------------- privacy check

const emitted = JSON.stringify({ clients, demoday }).toLowerCase();

// 1. No real client's full name (first + surname) may appear anywhere in the output.
const realFullNames = [...rawClients, ...demoDayClients]
  .map((c) => `${String(c.fn || "").trim()} ${String(c.sn || "").trim()}`.trim().toLowerCase())
  .filter((n) => n.length > 6 && n.includes(" "));
const nameLeaks = [...new Set(realFullNames)].filter((n) => emitted.includes(n));

// 2. Every emitted client name must be built only from the pseudonym pools.
const poolFirst = new Set(FIRST_NAMES.map((n) => n.toLowerCase()));
const poolSur = new Set(SURNAMES.map((n) => n.toLowerCase()));
const emittedNames = [
  ...clients.map((c) => ({ f: c.firstName, s: c.surname })),
  ...demoday.bookings.map((b) => {
    const parts = String(b.clientName).split(" ");
    return { f: parts[0], s: parts.slice(1).join(" ") };
  }),
];
const poolLeaks = emittedNames.filter(
  (n) => !poolFirst.has(String(n.f).toLowerCase()) || !poolSur.has(String(n.s).toLowerCase())
);

// 3. No real phone number may survive.
const realPhones = new Set(
  rawClients.map((c) => String(c.tel || "").replace(/\D/g, "")).filter((t) => t.length >= 9)
);
const digitsInOutput = emitted.replace(/\D/g, "");
const phoneLeaks = [...realPhones].filter((t) => digitsInOutput.includes(t));

if (nameLeaks.length || poolLeaks.length || phoneLeaks.length) {
  console.error("PRIVACY CHECK FAILED");
  if (nameLeaks.length) console.error(`  real full names in output: ${nameLeaks.slice(0, 5).join(" | ")}`);
  if (poolLeaks.length)
    console.error(`  names outside pseudonym pool: ${poolLeaks.slice(0, 5).map((n) => `${n.f} ${n.s}`).join(" | ")}`);
  if (phoneLeaks.length) console.error(`  real phone numbers in output: ${phoneLeaks.length}`);
  process.exit(1);
}

// -------------------------------------------------------------------- write

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

// Visit history is bulky and only ever needed for one client at a time, so each
// client's history is written as its own small file the page fetches on demand.
const VISIT_DIR = join(__dirname, "..", "public", "data", "visits");
if (!existsSync(VISIT_DIR)) mkdirSync(VISIT_DIR, { recursive: true });
let visitFiles = 0;
for (const c of clients) {
  if (!c.visits.length) continue;
  writeFileSync(join(VISIT_DIR, `${c.id}.json`), JSON.stringify(c.visits.slice(0, 20)), "utf8");
  visitFiles += 1;
}

const clientSummaries = clients.map(({ visits: _visits, ...rest }) => rest);

const files = {
  "meta.json": meta,
  "staff.json": staff,
  "services.json": services,
  "products.json": { ...products, till: tillProducts },
  "clients.json": clientSummaries,
  "demoday.json": demoday,
  "analytics.json": analytics,
  "daybook.json": { from: daybookFrom, to: DEMO_DATE, dict: descrDict, days: daybook },
};

for (const [name, data] of Object.entries(files)) {
  writeFileSync(join(OUT, name), JSON.stringify(data), "utf8");
  const kb = (Buffer.byteLength(JSON.stringify(data)) / 1024).toFixed(0);
  console.log(`${name.padEnd(16)} ${String(kb).padStart(6)} KB`);
}

console.log(`visits/          ${String(visitFiles).padStart(6)} per-client files`);
console.log(`\nDemo day: ${DEMO_DATE} - ${demoday.invoiceCount} invoices, R${demoTotals.total}`);
console.log(`Clients: ${clients.length} (pseudonymized)  Services: ${services.length}  Products: ${meta.productsInDemo}`);
console.log("Privacy check passed.");
