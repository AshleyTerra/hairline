import { describe, expect, it } from "vitest";
import {
  SERVICE_TYPES,
  purchaseHistory,
  purchaseTotals,
  type PurchaseFilter,
} from "./purchases";
import type { CatalogueEntry } from "./reports";
import type { PlayInvoice, Visit } from "./types";

const catalogue = new Map<string, CatalogueEntry>([
  ["cut - gents", { dept: "General", deptNo: "0001", itemNo: "0002", kind: "service" }],
  ["nioxin system 2 cleanser 300ml", { dept: "Nioxin Retail", deptNo: "0027", itemNo: "0011", kind: "product" }],
  ["tint 20g", { dept: "Colour Stock", deptNo: "0025", itemNo: "0015", kind: "stock" }],
]);

const visit = (over: Partial<Visit> = {}): Visit => ({
  id: 62095,
  clientId: 852,
  date: "2021-12-17T13:59:00",
  total: 440,
  payments: { cash: 0, card: 440, eft: 0, toPay: 0, voucher: 0 },
  lines: [
    { descr: "Cut - gents", price: 180, qty: 1, disc: 0, stylistId: 1, kind: "service" },
    { descr: "Nioxin System 2 Cleanser 300ml", price: 260, qty: 1, disc: 0, stylistId: 1, kind: "product" },
  ],
  ...over,
});

const sale = (over: Partial<PlayInvoice> = {}): PlayInvoice => ({
  id: 93712,
  clientId: 852,
  clientName: ". Skirrow",
  date: "2026-07-25T10:15:00",
  total: 600,
  lines: [{ key: "l1", descr: "Cut - gents", price: 600, qty: 1, disc: 0, stylistId: 4, kind: "service" }],
  payments: [{ method: "card", amount: 600 }],
  tips: [],
  seconds: 20,
  ...over,
});

const all: PurchaseFilter = { serviceType: "all", from: "2000-01-01", to: "2030-12-31" };

describe("a client's purchase history", () => {
  it("gives one row per line, the way MySalon prints it", () => {
    const rows = purchaseHistory([visit()], [], catalogue, all);
    expect(rows).toHaveLength(2);
  });

  it("carries the invoice number, date, staff and description", () => {
    const rows = purchaseHistory([visit()], [], catalogue, all);
    expect(rows[0]).toMatchObject({
      invoice: 62095,
      date: "2021-12-17",
      stylistId: 1,
      descr: "Cut - gents",
      qty: 1,
      price: 180,
    });
  });

  it("looks the department and item number up from the catalogue", () => {
    const rows = purchaseHistory([visit()], [], catalogue, all);
    const cut = rows.find((r) => r.descr === "Cut - gents");
    expect(cut).toMatchObject({ dept: "General", deptNo: "0001", itemNo: "0002" });
  });

  it("labels the service type the way the salon reads it", () => {
    const rows = purchaseHistory([visit()], [], catalogue, all);
    expect(rows.find((r) => r.descr === "Cut - gents")?.serviceType).toBe("SERVICE");
    expect(rows.find((r) => r.descr.startsWith("Nioxin"))?.serviceType).toBe("RETAIL");
  });

  it("says so plainly when an item is not in the catalogue", () => {
    const odd = visit({
      lines: [{ descr: "Something long gone", price: 100, qty: 1, disc: 0, stylistId: 1, kind: "service" }],
    });
    expect(purchaseHistory([odd], [], catalogue, all)[0]).toMatchObject({
      dept: "Unknown",
      deptNo: "—",
      itemNo: "—",
    });
  });

  it("works the line value out after quantity and discount", () => {
    const twoOff = visit({
      lines: [{ descr: "Cut - gents", price: 200, qty: 2, disc: 10, stylistId: 1, kind: "service" }],
    });
    expect(purchaseHistory([twoOff], [], catalogue, all)[0].value).toBe(360);
  });

  it("includes sales rung up here, so today's visit is on the list", () => {
    const rows = purchaseHistory([visit()], [sale()], catalogue, all);
    expect(rows.some((r) => r.invoice === 93712)).toBe(true);
  });

  it("only takes the sales belonging to this client", () => {
    const rows = purchaseHistory([visit()], [sale({ clientId: 999 })], catalogue, all, 852);
    expect(rows.some((r) => r.invoice === 93712)).toBe(false);
  });

  it("leaves a walk-in sale out when a client is named", () => {
    const rows = purchaseHistory([], [sale({ clientId: null })], catalogue, all, 852);
    expect(rows).toHaveLength(0);
  });

  it("puts the most recent first, as a history should read", () => {
    const rows = purchaseHistory([visit()], [sale()], catalogue, all);
    expect(rows[0].date).toBe("2026-07-25");
  });
});

describe("filtering the history", () => {
  const rows = (f: Partial<PurchaseFilter>) =>
    purchaseHistory([visit()], [sale()], catalogue, { ...all, ...f });

  it("narrows to services only", () => {
    const only = rows({ serviceType: "service" });
    expect(only.every((r) => r.serviceType === "SERVICE")).toBe(true);
    expect(only.length).toBe(2);
  });

  it("narrows to retail only", () => {
    const only = rows({ serviceType: "retail" });
    expect(only.map((r) => r.descr)).toEqual(["Nioxin System 2 Cleanser 300ml"]);
  });

  it("narrows by date range", () => {
    expect(rows({ from: "2026-01-01" }).every((r) => r.date >= "2026-01-01")).toBe(true);
    expect(rows({ to: "2022-01-01" }).every((r) => r.date <= "2022-01-01")).toBe(true);
  });

  it("includes both ends of the range", () => {
    expect(rows({ from: "2021-12-17", to: "2021-12-17" })).toHaveLength(2);
  });

  it("returns nothing rather than everything when the range excludes all of it", () => {
    expect(rows({ from: "2030-01-01", to: "2030-12-31" })).toHaveLength(0);
  });

  it("offers the service types the salon uses", () => {
    expect(SERVICE_TYPES.map((t) => t.value)).toEqual(["all", "service", "retail", "stock"]);
  });
});

describe("totalling the history", () => {
  it("adds up what the client has spent and how many items", () => {
    const totals = purchaseTotals(purchaseHistory([visit()], [sale()], catalogue, all));
    expect(totals).toEqual({ qty: 3, value: 1040, visits: 2 });
  });

  it("counts a visit once however many lines it had", () => {
    expect(purchaseTotals(purchaseHistory([visit()], [], catalogue, all)).visits).toBe(1);
  });

  it("copes with nothing at all", () => {
    expect(purchaseTotals([])).toEqual({ qty: 0, value: 0, visits: 0 });
  });
});
