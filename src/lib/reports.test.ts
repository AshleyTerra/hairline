import { describe, expect, it } from "vitest";
import {
  addRow,
  emptySplit,
  exVat,
  splitTotals,
  staffTurnover,
  turnoverByDate,
  type ReportSale,
} from "./reports";

/** A sale with one line of each kind, priced so the maths is easy to read. */
const sale = (
  overrides: Partial<ReportSale> & Pick<ReportSale, "date" | "lines">
): ReportSale => ({
  number: 1,
  client: "A Client",
  ...overrides,
});

describe("VAT", () => {
  it("strips 15% inclusive VAT", () => {
    expect(exVat(115)).toBeCloseTo(100, 2);
  });

  it("leaves zero alone", () => {
    expect(exVat(0)).toBe(0);
  });
});

describe("splitting a sale by kind", () => {
  it("separates services, retail and salon stock", () => {
    const split = splitTotals([
      { descr: "Cut", qty: 1, price: 600, disc: 0, stylistId: 1, kind: "service" },
      { descr: "Shampoo", qty: 2, price: 150, disc: 0, stylistId: 1, kind: "product" },
      { descr: "Tint 20g", qty: 1, price: 90, disc: 0, stylistId: 1, kind: "stock" },
    ]);
    expect(split.services).toBe(600);
    expect(split.retail).toBe(300);
    expect(split.stock).toBe(90);
    expect(split.total).toBe(990);
  });

  it("applies quantity and discount before splitting", () => {
    const split = splitTotals([
      { descr: "Cut", qty: 2, price: 100, disc: 50, stylistId: 1, kind: "service" },
    ]);
    expect(split.services).toBe(100);
  });

  it("returns zeros for no lines", () => {
    expect(splitTotals([])).toEqual(emptySplit());
  });

  it("adds two splits together", () => {
    const a = { services: 100, retail: 50, stock: 10, total: 160 };
    const b = { services: 200, retail: 5, stock: 0, total: 205 };
    expect(addRow(a, b)).toEqual({ services: 300, retail: 55, stock: 10, total: 365 });
  });
});

const SALES: ReportSale[] = [
  sale({
    date: "2026-07-01",
    lines: [
      { descr: "Cut", qty: 1, price: 600, disc: 0, stylistId: 1, kind: "service" },
      { descr: "Shampoo", qty: 1, price: 200, disc: 0, stylistId: 1, kind: "product" },
    ],
  }),
  sale({
    date: "2026-07-01",
    lines: [{ descr: "Tint", qty: 1, price: 1000, disc: 0, stylistId: 2, kind: "service" }],
  }),
  sale({
    date: "2026-07-02",
    lines: [{ descr: "Cut", qty: 1, price: 400, disc: 0, stylistId: 1, kind: "service" }],
  }),
];

describe("staff turnover, one row per staff member", () => {
  it("totals each staff member's services and retail", () => {
    const rows = staffTurnover(SALES, [1, 2]);
    const karin = rows.find((r) => r.stylistId === 1);
    expect(karin?.inclVat.services).toBe(1000);
    expect(karin?.inclVat.retail).toBe(200);
    expect(karin?.inclVat.total).toBe(1200);
  });

  it("reports the same figures excluding VAT", () => {
    const rows = staffTurnover(SALES, [2]);
    expect(rows[0].exVat.services).toBeCloseTo(1000 / 1.15, 2);
  });

  it("includes a requested staff member with no sales, as a zero row", () => {
    const rows = staffTurnover(SALES, [1, 2, 99]);
    const quiet = rows.find((r) => r.stylistId === 99);
    expect(quiet?.inclVat.total).toBe(0);
  });

  it("only reports the staff asked for", () => {
    expect(staffTurnover(SALES, [2]).map((r) => r.stylistId)).toEqual([2]);
  });

  it("attributes each line to the stylist on that line, not the invoice", () => {
    const mixed: ReportSale[] = [
      sale({
        date: "2026-07-01",
        lines: [
          { descr: "Cut", qty: 1, price: 300, disc: 0, stylistId: 1, kind: "service" },
          { descr: "Colour", qty: 1, price: 700, disc: 0, stylistId: 2, kind: "service" },
        ],
      }),
    ];
    const rows = staffTurnover(mixed, [1, 2]);
    expect(rows.find((r) => r.stylistId === 1)?.inclVat.total).toBe(300);
    expect(rows.find((r) => r.stylistId === 2)?.inclVat.total).toBe(700);
  });

  it("sorts biggest earner first", () => {
    expect(staffTurnover(SALES, [1, 2]).map((r) => r.stylistId)).toEqual([1, 2]);
  });
});

describe("daily turnover for one staff member", () => {
  it("gives a row per trading day", () => {
    const rows = turnoverByDate(SALES, 1);
    expect(rows.map((r) => r.date)).toEqual(["2026-07-01", "2026-07-02"]);
  });

  it("splits each day by kind", () => {
    const rows = turnoverByDate(SALES, 1);
    expect(rows[0].inclVat.services).toBe(600);
    expect(rows[0].inclVat.retail).toBe(200);
    expect(rows[1].inclVat.total).toBe(400);
  });

  it("leaves out days the staff member did not work", () => {
    expect(turnoverByDate(SALES, 2).map((r) => r.date)).toEqual(["2026-07-01"]);
  });

  it("returns nothing for a staff member with no sales", () => {
    expect(turnoverByDate(SALES, 99)).toEqual([]);
  });

  it("keeps the days in date order", () => {
    const shuffled = [SALES[2], SALES[0]];
    expect(turnoverByDate(shuffled, 1).map((r) => r.date)).toEqual([
      "2026-07-01",
      "2026-07-02",
    ]);
  });
});
