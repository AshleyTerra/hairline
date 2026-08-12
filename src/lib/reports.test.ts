import { describe, expect, it } from "vitest";
import {
  addRow,
  emptySplit,
  exVat,
  itemTracking,
  itemTrackingTotals,
  splitTotals,
  staffTurnover,
  turnoverByDate,
  type CatalogueEntry,
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

describe("item tracking", () => {
  const catalogue = new Map<string, CatalogueEntry>([
    ["cut", { dept: "General", deptNo: "0001", itemNo: "0001", kind: "service" }],
    ["shampoo", { dept: "Schwarzkopf Retail", deptNo: "0024", itemNo: "0007", kind: "product" }],
    ["tint 20g", { dept: "Schwarzkopf Stock", deptNo: "0025", itemNo: "0015", kind: "stock" }],
  ]);

  const SALES2: ReportSale[] = [
    sale({
      number: 900,
      date: "2026-07-01",
      client: "Thandi",
      lines: [
        { descr: "Cut", qty: 1, price: 600, disc: 0, stylistId: 1, kind: "service" },
        { descr: "Shampoo", qty: 2, price: 200, disc: 0, stylistId: 1, kind: "product" },
      ],
    }),
    sale({
      number: 901,
      date: "2026-07-02",
      client: "Sipho",
      lines: [{ descr: "Tint 20g", qty: 1, price: 90, disc: 0, stylistId: 2, kind: "stock" }],
    }),
  ];

  it("gives one row per line with the invoice, client and quantity", () => {
    const rows = itemTracking(SALES2, catalogue, { kinds: [] });
    expect(rows).toHaveLength(3);
    const shampoo = rows.find((r) => r.descr === "Shampoo");
    expect(shampoo).toMatchObject({ invoice: 900, client: "Thandi", qty: 2, value: 400 });
  });

  it("fills in the department and item numbers from the catalogue", () => {
    const rows = itemTracking(SALES2, catalogue, { kinds: [] });
    const cut = rows.find((r) => r.descr === "Cut");
    expect(cut?.dept).toBe("General");
    expect(cut?.deptNo).toBe("0001");
    expect(cut?.itemNo).toBe("0001");
  });

  it("marks an item missing from the catalogue rather than dropping it", () => {
    const odd: ReportSale[] = [
      sale({
        date: "2026-07-03",
        lines: [{ descr: "Mystery item", qty: 1, price: 10, disc: 0, stylistId: 1, kind: "product" }],
      }),
    ];
    const rows = itemTracking(odd, catalogue, { kinds: [] });
    expect(rows[0].dept).toBe("Unknown");
  });

  it("defaults to retail and salon stock only", () => {
    const rows = itemTracking(SALES2, catalogue, { kinds: ["product", "stock"] });
    expect(rows.map((r) => r.descr).sort()).toEqual(["Shampoo", "Tint 20g"]);
  });

  it("filters to one product", () => {
    const rows = itemTracking(SALES2, catalogue, { descrs: ["Shampoo"], kinds: [] });
    expect(rows).toHaveLength(1);
    expect(rows[0].descr).toBe("Shampoo");
  });

  it("filters by department", () => {
    const rows = itemTracking(SALES2, catalogue, { depts: ["Schwarzkopf Stock"], kinds: [] });
    expect(rows.map((r) => r.descr)).toEqual(["Tint 20g"]);
  });

  it("filters by stylist", () => {
    const rows = itemTracking(SALES2, catalogue, { stylistId: 2, kinds: [] });
    expect(rows.every((r) => r.stylistId === 2)).toBe(true);
  });

  it("applies quantity and discount to the line value", () => {
    const discounted: ReportSale[] = [
      sale({
        date: "2026-07-04",
        lines: [{ descr: "Shampoo", qty: 2, price: 200, disc: 50, stylistId: 1, kind: "product" }],
      }),
    ];
    expect(itemTracking(discounted, catalogue, { kinds: [] })[0].value).toBe(200);
  });

  it("lists the most recent day first", () => {
    const rows = itemTracking(SALES2, catalogue, { kinds: [] });
    expect(rows[0].date).toBe("2026-07-02");
  });

  it("totals the quantity and value", () => {
    const totals = itemTrackingTotals(itemTracking(SALES2, catalogue, { kinds: [] }));
    expect(totals.qty).toBe(4);
    expect(totals.value).toBe(600 + 400 + 90);
  });

  it("returns nothing when the filters exclude everything", () => {
    expect(itemTracking(SALES2, catalogue, { descrs: ["Nothing"], kinds: [] })).toEqual([]);
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
