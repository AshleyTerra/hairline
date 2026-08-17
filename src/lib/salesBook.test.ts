import { describe, expect, it } from "vitest";
import { amendedOrOriginal, demoSaleAsPlayInvoice, resolveSale } from "./salesBook";
import type { DemoInvoice, PlayInvoice } from "./types";

const demoSale = (over: Partial<DemoInvoice> = {}): DemoInvoice => ({
  id: 93675,
  clientId: 412,
  clientName: "Marius Pillay",
  date: "2026-07-25T07:09:00",
  total: 780,
  payments: { cash: 0, card: 780, eft: 0, toPay: 0, voucher: 0 },
  lines: [
    { descr: "Cut - gents", price: 300, qty: 1, disc: 0, stylistId: 1, kind: "service" },
    { descr: "Beard trim", price: 480, qty: 1, disc: 0, stylistId: 1, kind: "service" },
  ],
  ...over,
});

const play = (over: Partial<PlayInvoice> = {}): PlayInvoice => ({
  id: 999,
  clientId: 7,
  clientName: "Thandi Nkosi",
  date: "2026-07-25T10:00:00",
  total: 600,
  lines: [
    { key: "l1", descr: "Cut - ladies", price: 600, qty: 1, disc: 0, stylistId: 4, kind: "service" },
  ],
  payments: [{ method: "card", amount: 600 }],
  tips: [],
  seconds: 20,
  ...over,
});

describe("turning a day-book sale into something correctable", () => {
  it("keeps the invoice number, so the correction lands on the right sale", () => {
    expect(demoSaleAsPlayInvoice(demoSale()).id).toBe(93675);
  });

  it("keeps the client, the date and the total", () => {
    const p = demoSaleAsPlayInvoice(demoSale());
    expect(p).toMatchObject({
      clientId: 412,
      clientName: "Marius Pillay",
      date: "2026-07-25T07:09:00",
      total: 780,
    });
  });

  it("gives every line a key, because the editor needs one to track it by", () => {
    const keys = demoSaleAsPlayInvoice(demoSale()).lines.map((l) => l.key);
    expect(new Set(keys).size).toBe(2);
    expect(keys.every((k) => k.length > 0)).toBe(true);
  });

  it("carries the lines across intact", () => {
    const p = demoSaleAsPlayInvoice(demoSale());
    expect(p.lines[0]).toMatchObject({ descr: "Cut - gents", price: 300, stylistId: 1 });
  });

  it("turns the payment totals into payments, dropping the empty ones", () => {
    expect(demoSaleAsPlayInvoice(demoSale()).payments).toEqual([{ method: "card", amount: 780 }]);
  });

  it("renames toPay to the method the till uses", () => {
    const onAccount = demoSale({
      payments: { cash: 0, card: 0, eft: 0, toPay: 500, voucher: 0 },
    });
    expect(demoSaleAsPlayInvoice(onAccount).payments).toEqual([{ method: "topay", amount: 500 }]);
  });

  it("keeps a split across two methods", () => {
    const split = demoSale({
      payments: { cash: 280, card: 500, eft: 0, toPay: 0, voucher: 0 },
    });
    const methods = demoSaleAsPlayInvoice(split).payments;
    expect(methods).toHaveLength(2);
    expect(methods.reduce((s, p) => s + p.amount, 0)).toBe(780);
  });

  it("starts with no tip and no amendments", () => {
    const p = demoSaleAsPlayInvoice(demoSale());
    expect(p.tips).toEqual([]);
    expect(p.amendments).toBeUndefined();
  });
});

describe("finding the sale a correction is aimed at", () => {
  it("finds one rung up here", () => {
    expect(resolveSale(999, [play()], [], [demoSale()])?.clientName).toBe("Thandi Nkosi");
  });

  it("finds one from the day book", () => {
    expect(resolveSale(93675, [play()], [], [demoSale()])?.clientName).toBe("Marius Pillay");
  });

  it("prefers a correction already made over the original", () => {
    const corrected = { ...demoSaleAsPlayInvoice(demoSale()), clientName: "Corrected" };
    expect(resolveSale(93675, [play()], [corrected], [demoSale()])?.clientName).toBe("Corrected");
  });

  it("returns nothing for a sale that does not exist", () => {
    expect(resolveSale(1234, [play()], [], [demoSale()])).toBeUndefined();
  });
});

describe("showing the corrected version wherever the sale appears", () => {
  it("swaps in the correction", () => {
    const corrected = {
      ...demoSaleAsPlayInvoice(demoSale()),
      lines: demoSaleAsPlayInvoice(demoSale()).lines.map((l) => ({ ...l, stylistId: 6 })),
    };
    const rows = amendedOrOriginal([demoSale()], [corrected]);
    expect(rows[0].lines.every((l) => l.stylistId === 6)).toBe(true);
  });

  it("leaves an untouched sale alone", () => {
    const rows = amendedOrOriginal([demoSale()], []);
    expect(rows[0].lines[0].stylistId).toBe(1);
  });

  it("marks which ones were corrected", () => {
    const corrected = demoSaleAsPlayInvoice(demoSale());
    expect(amendedOrOriginal([demoSale()], [corrected])[0].wasAmended).toBe(true);
    expect(amendedOrOriginal([demoSale()], [])[0].wasAmended).toBe(false);
  });

  it("keeps every sale, corrected or not", () => {
    const two = [demoSale(), demoSale({ id: 93676, clientName: "Second" })];
    expect(amendedOrOriginal(two, [demoSaleAsPlayInvoice(demoSale())])).toHaveLength(2);
  });

  it("ignores a correction that matches nothing in the day book", () => {
    const stray = { ...demoSaleAsPlayInvoice(demoSale()), id: 5 };
    expect(amendedOrOriginal([demoSale()], [stray])[0].wasAmended).toBe(false);
  });
});
