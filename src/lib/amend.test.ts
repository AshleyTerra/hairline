import { describe, expect, it } from "vitest";
import {
  amendedTotal,
  paymentsMatchTotal,
  recordAmendment,
  setLineStylist,
  setPaymentMethod,
  splitLine,
  splitPayment,
} from "./amend";
import type { PlayInvoice } from "./types";

const invoice = (over: Partial<PlayInvoice> = {}): PlayInvoice => ({
  id: 93712,
  clientId: 852,
  clientName: "Fatima Osman",
  date: "2026-07-25T10:15:00",
  total: 1000,
  lines: [
    { key: "a", descr: "Colour", price: 700, qty: 1, disc: 0, stylistId: 1, kind: "service" },
    { key: "b", descr: "Blow-dry", price: 300, qty: 1, disc: 0, stylistId: 1, kind: "service" },
  ],
  payments: [{ method: "card", amount: 1000 }],
  tips: [],
  seconds: 30,
  ...over,
});

describe("putting a line with the right stylist", () => {
  it("moves one line to somebody else", () => {
    const fixed = setLineStylist(invoice(), "b", 6);
    expect(fixed.lines.find((l) => l.key === "b")?.stylistId).toBe(6);
    expect(fixed.lines.find((l) => l.key === "a")?.stylistId).toBe(1);
  });

  it("does not change what the client paid", () => {
    expect(amendedTotal(setLineStylist(invoice(), "b", 6))).toBe(1000);
  });

  it("ignores a line that is not on the docket", () => {
    const same = setLineStylist(invoice(), "zzz", 6);
    expect(same.lines.map((l) => l.stylistId)).toEqual([1, 1]);
  });

  it("never mutates the invoice it was given", () => {
    const original = invoice();
    setLineStylist(original, "b", 6);
    expect(original.lines[1].stylistId).toBe(1);
  });
});

describe("splitting a line between two stylists", () => {
  it("makes a second line for the other stylist", () => {
    const r = splitLine(invoice(), "a", 6, 50);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.lines).toHaveLength(3);
    const mine = r.value.lines.filter((l) => l.descr === "Colour");
    expect(mine.map((l) => l.stylistId).sort()).toEqual([1, 6]);
  });

  it("halves the money between them", () => {
    const r = splitLine(invoice(), "a", 6, 50);
    if (!r.ok) throw new Error("split refused");
    const mine = r.value.lines.filter((l) => l.descr === "Colour");
    expect(mine.map((l) => l.price).sort((x, y) => x - y)).toEqual([350, 350]);
  });

  it("splits unevenly when asked", () => {
    const r = splitLine(invoice(), "a", 6, 30);
    if (!r.ok) throw new Error("split refused");
    const mine = r.value.lines.filter((l) => l.descr === "Colour");
    expect(mine.map((l) => l.price).sort((x, y) => x - y)).toEqual([210, 490]);
  });

  it("leaves the docket total exactly where it was", () => {
    for (const share of [10, 33, 50, 67, 90]) {
      const r = splitLine(invoice(), "a", 6, share);
      if (!r.ok) throw new Error("split refused");
      expect(amendedTotal(r.value)).toBe(1000);
    }
  });

  it("puts the odd cent somewhere rather than losing it", () => {
    const odd = invoice({
      total: 100.01,
      lines: [{ key: "a", descr: "Cut", price: 100.01, qty: 1, disc: 0, stylistId: 1, kind: "service" }],
    });
    const r = splitLine(odd, "a", 6, 50);
    if (!r.ok) throw new Error("split refused");
    expect(amendedTotal(r.value)).toBe(100.01);
  });

  it("refuses a share of nothing or everything, which is not a split", () => {
    expect(splitLine(invoice(), "a", 6, 0).ok).toBe(false);
    expect(splitLine(invoice(), "a", 6, 100).ok).toBe(false);
  });

  it("refuses to split a line with the same stylist", () => {
    expect(splitLine(invoice(), "a", 1, 50).ok).toBe(false);
  });

  it("refuses a line it cannot find", () => {
    expect(splitLine(invoice(), "zzz", 6, 50).ok).toBe(false);
  });
});

describe("correcting the payment type", () => {
  it("changes the method without touching the amount", () => {
    const fixed = setPaymentMethod(invoice(), 0, "cash");
    expect(fixed.payments[0]).toMatchObject({ method: "cash", amount: 1000 });
  });

  it("keeps the payments matching the total", () => {
    expect(paymentsMatchTotal(setPaymentMethod(invoice(), 0, "eft"))).toBe(true);
  });

  it("ignores a payment that is not there", () => {
    expect(setPaymentMethod(invoice(), 9, "cash").payments[0].method).toBe("card");
  });
});

describe("splitting a payment across two methods", () => {
  it("makes two payments out of one", () => {
    const r = splitPayment(invoice(), 0, "cash", 400);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.payments).toHaveLength(2);
    expect(r.value.payments.map((p) => [p.method, p.amount])).toEqual([
      ["card", 600],
      ["cash", 400],
    ]);
  });

  it("still adds up to what was taken", () => {
    const r = splitPayment(invoice(), 0, "cash", 400);
    if (!r.ok) throw new Error("refused");
    expect(paymentsMatchTotal(r.value)).toBe(true);
  });

  it("refuses to move more than the payment holds", () => {
    expect(splitPayment(invoice(), 0, "cash", 1200).ok).toBe(false);
  });

  it("refuses to move the whole payment, which is a method change not a split", () => {
    expect(splitPayment(invoice(), 0, "cash", 1000).ok).toBe(false);
  });

  it("refuses nothing, or a negative", () => {
    expect(splitPayment(invoice(), 0, "cash", 0).ok).toBe(false);
    expect(splitPayment(invoice(), 0, "cash", -5).ok).toBe(false);
  });
});

describe("the audit trail", () => {
  it("records who changed what, and when", () => {
    const noted = recordAmendment(invoice(), "Reception", "2026-07-25T16:40:00", "Blow-dry moved to Meagan V.");
    expect(noted.amendments).toEqual([
      { by: "Reception", at: "2026-07-25T16:40:00", what: "Blow-dry moved to Meagan V." },
    ]);
  });

  it("keeps every change, not just the last one", () => {
    let inv = recordAmendment(invoice(), "Reception", "t1", "first");
    inv = recordAmendment(inv, "Owner", "t2", "second");
    expect(inv.amendments?.map((a) => a.what)).toEqual(["first", "second"]);
  });
});

describe("the invariant that matters", () => {
  it("notices when payments no longer match the total", () => {
    const wrong = invoice({ payments: [{ method: "card", amount: 900 }] });
    expect(paymentsMatchTotal(wrong)).toBe(false);
  });

  it("allows a tip on top, which is not part of the sale total", () => {
    const tipped = invoice({
      tips: [{ stylistId: 1, amount: 50 }],
      payments: [{ method: "card", amount: 1050 }],
    });
    expect(paymentsMatchTotal(tipped)).toBe(true);
  });
});
