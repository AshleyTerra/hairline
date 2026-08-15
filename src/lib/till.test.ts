import { describe, expect, it } from "vitest";
import {
  applyCostPrice,
  applyFinalValue,
  costIncl,
  emptyTill,
  restoreListPrice,
  tillReduce,
  totals,
} from "./till";
import type { TillLine } from "./types";

function line(price: number, qty = 1, disc = 0, stylistId: number | null = 1): TillLine {
  return {
    key: `k${price}-${qty}-${disc}`,
    descr: "Test item",
    price,
    qty,
    disc,
    stylistId,
    kind: "service",
  };
}

describe("till totals", () => {
  it("sums a single line", () => {
    const state = tillReduce(emptyTill(), { type: "add", line: line(350) });
    expect(totals(state).subtotal).toBe(350);
  });

  it("multiplies by quantity and applies a percentage discount", () => {
    let state = tillReduce(emptyTill(), { type: "add", line: line(350) });
    state = tillReduce(state, { type: "add", line: line(180, 2, 50) });
    expect(totals(state).subtotal).toBe(350 + 180 * 2 * 0.5);
  });

  it("treats VAT as 15/115 of the inclusive total", () => {
    const state = tillReduce(emptyTill(), { type: "add", line: line(115) });
    expect(totals(state).vat).toBeCloseTo(15, 2);
  });

  it("rounds money to two decimals rather than accumulating float error", () => {
    let state = emptyTill();
    for (let i = 0; i < 3; i += 1) {
      state = tillReduce(state, { type: "add", line: { ...line(0.1), key: `k${i}` } });
    }
    expect(totals(state).subtotal).toBe(0.3);
  });
});

describe("till payments", () => {
  it("accepts split payments and reports the outstanding balance", () => {
    let state = tillReduce(emptyTill(), { type: "add", line: line(500) });
    state = tillReduce(state, { type: "pay", payment: { method: "card", amount: 300 } });
    expect(totals(state).balance).toBe(200);
    state = tillReduce(state, { type: "pay", payment: { method: "cash", amount: 200 } });
    expect(totals(state).balance).toBe(0);
  });

  it("gives change on cash overpayment only", () => {
    let state = tillReduce(emptyTill(), { type: "add", line: line(500) });
    state = tillReduce(state, { type: "pay", payment: { method: "cash", amount: 550 } });
    const t = totals(state);
    expect(t.paid).toBe(550);
    expect(t.change).toBe(50);
    expect(t.balance).toBe(0);
  });

  it("clamps a card payment to the outstanding balance", () => {
    let state = tillReduce(emptyTill(), { type: "add", line: line(200) });
    state = tillReduce(state, { type: "pay", payment: { method: "card", amount: 500 } });
    expect(totals(state).paid).toBe(200);
    expect(totals(state).change).toBe(0);
  });

  it("clamps a voucher redemption to the outstanding balance", () => {
    let state = tillReduce(emptyTill(), { type: "add", line: line(200) });
    state = tillReduce(state, { type: "pay", payment: { method: "voucher", amount: 500 } });
    expect(totals(state).paid).toBe(200);
  });

  it("removes a payment with unpay", () => {
    let state = tillReduce(emptyTill(), { type: "add", line: line(500) });
    state = tillReduce(state, { type: "pay", payment: { method: "card", amount: 300 } });
    state = tillReduce(state, { type: "unpay", index: 0 });
    expect(totals(state).paid).toBe(0);
    expect(totals(state).balance).toBe(500);
  });
});

describe("till tips", () => {
  it("tracks tips per stylist and keeps them out of the sales figure", () => {
    let state = tillReduce(emptyTill(), { type: "add", line: line(300) });
    state = tillReduce(state, { type: "tip", stylistId: 7, amount: 40 });
    expect(totals(state).subtotal).toBe(300);
    expect(totals(state).tipTotal).toBe(40);
    expect(state.tips).toEqual([{ stylistId: 7, amount: 40 }]);
  });

  it("charges the tip to the client on top of the sale", () => {
    let state = tillReduce(emptyTill(), { type: "add", line: line(300) });
    state = tillReduce(state, { type: "tip", stylistId: 7, amount: 40 });
    const t = totals(state);
    // The client owes the tip too, so it cannot be forgotten at the card machine…
    expect(t.dueTotal).toBe(340);
    expect(t.balance).toBe(340);
    // …but the stylist's sales figure stays clean.
    expect(t.subtotal).toBe(300);
  });

  it("clears the balance only once the tip is covered as well", () => {
    let state = tillReduce(emptyTill(), { type: "add", line: line(300) });
    state = tillReduce(state, { type: "tip", stylistId: 7, amount: 40 });
    state = tillReduce(state, { type: "pay", payment: { method: "card", amount: 300 } });
    expect(totals(state).balance).toBe(40);
    state = tillReduce(state, { type: "pay", payment: { method: "card", amount: 40 } });
    expect(totals(state).balance).toBe(0);
  });

  it("lets a card cover the sale and the tip in one swipe", () => {
    let state = tillReduce(emptyTill(), { type: "add", line: line(500) });
    state = tillReduce(state, { type: "tip", stylistId: 3, amount: 50 });
    state = tillReduce(state, { type: "pay", payment: { method: "card", amount: 999 } });
    // Card is clamped to what is owed, tip included — never more.
    expect(totals(state).paid).toBe(550);
    expect(totals(state).balance).toBe(0);
    expect(totals(state).change).toBe(0);
  });

  it("gives change against the sale plus the tip", () => {
    let state = tillReduce(emptyTill(), { type: "add", line: line(300) });
    state = tillReduce(state, { type: "tip", stylistId: 7, amount: 40 });
    state = tillReduce(state, { type: "pay", payment: { method: "cash", amount: 400 } });
    expect(totals(state).change).toBe(60);
  });

  it("supports a tip for someone who did no billable work, such as an assistant", () => {
    let state = tillReduce(emptyTill(), { type: "add", line: line(300, 1, 0) });
    state = tillReduce(state, { type: "tip", stylistId: 21, amount: 30 });
    expect(state.tips).toEqual([{ stylistId: 21, amount: 30 }]);
    expect(totals(state).dueTotal).toBe(330);
  });

  it("adds up tips for several operators on one sale", () => {
    let state = tillReduce(emptyTill(), { type: "add", line: line(600) });
    state = tillReduce(state, { type: "tip", stylistId: 1, amount: 50 });
    state = tillReduce(state, { type: "tip", stylistId: 2, amount: 20 });
    const t = totals(state);
    expect(t.tipTotal).toBe(70);
    expect(t.dueTotal).toBe(670);
    expect(t.subtotal).toBe(600);
  });

  it("replaces rather than stacks a tip for the same stylist", () => {
    let state = tillReduce(emptyTill(), { type: "tip", stylistId: 7, amount: 40 });
    state = tillReduce(state, { type: "tip", stylistId: 7, amount: 60 });
    expect(state.tips).toEqual([{ stylistId: 7, amount: 60 }]);
  });

  it("drops a tip set to zero", () => {
    let state = tillReduce(emptyTill(), { type: "tip", stylistId: 7, amount: 40 });
    state = tillReduce(state, { type: "tip", stylistId: 7, amount: 0 });
    expect(state.tips).toEqual([]);
  });
});

describe("till line editing", () => {
  it("removes a line by key", () => {
    let state = tillReduce(emptyTill(), { type: "add", line: line(350) });
    state = tillReduce(state, { type: "add", line: { ...line(200), key: "second" } });
    state = tillReduce(state, { type: "remove", key: "second" });
    expect(state.lines).toHaveLength(1);
    expect(totals(state).subtotal).toBe(350);
  });

  it("updates the discount, quantity and stylist of a line", () => {
    let state = tillReduce(emptyTill(), { type: "add", line: { ...line(400), key: "a" } });
    state = tillReduce(state, { type: "update", key: "a", patch: { disc: 25, qty: 2, stylistId: 9 } });
    expect(totals(state).subtotal).toBe(400 * 2 * 0.75);
    expect(state.lines[0].stylistId).toBe(9);
  });

  it("clear resets to an empty till", () => {
    let state = tillReduce(emptyTill(), { type: "add", line: line(350) });
    state = tillReduce(state, { type: "pay", payment: { method: "cash", amount: 350 } });
    state = tillReduce(state, { type: "clear" });
    expect(state.lines).toHaveLength(0);
    expect(state.payments).toHaveLength(0);
    expect(state.clientId).toBeNull();
  });

  it("does not mutate the previous state", () => {
    const before = tillReduce(emptyTill(), { type: "add", line: line(350) });
    const after = tillReduce(before, { type: "add", line: { ...line(100), key: "b" } });
    expect(before.lines).toHaveLength(1);
    expect(after.lines).toHaveLength(2);
  });
});

describe("till client", () => {
  it("sets the client and starts the clock on the first action", () => {
    const state = tillReduce(emptyTill(), {
      type: "setClient",
      clientId: 42,
      clientName: "Thandi Nkosi",
      at: 1000,
    });
    expect(state.clientId).toBe(42);
    expect(state.startedAt).toBe(1000);
  });

  it("keeps the original start time once set", () => {
    let state = tillReduce(emptyTill(), {
      type: "setClient",
      clientId: 42,
      clientName: "Thandi Nkosi",
      at: 1000,
    });
    state = tillReduce(state, { type: "add", line: line(300), at: 5000 });
    expect(state.startedAt).toBe(1000);
  });
});

// ------------------------------------------- HF-01 / HF-02: price overrides

const product = (over: Partial<TillLine> = {}): TillLine => ({
  key: "p1",
  descr: "Smooth Down Shampoo 300ml",
  price: 225,
  qty: 1,
  disc: 0,
  stylistId: 1,
  kind: "product",
  cost: 114.86,
  ...over,
});

describe("cost price, including VAT", () => {
  /* MySalon stores cost excluding VAT — its own manual says so — but the salon
     asked to see the figure they actually pay, which includes it. */
  it("adds the 15% MySalon leaves off", () => {
    expect(costIncl(114.86)).toBe(132.09);
  });

  it("rounds to the cent", () => {
    expect(costIncl(349.75)).toBe(402.21);
  });

  it("leaves nothing at nothing", () => {
    expect(costIncl(0)).toBe(0);
  });
});

describe("selling at cost price", () => {
  it("charges the cost including VAT", () => {
    const sold = applyCostPrice(product(), "reception", "2026-08-14T10:00:00");
    expect(sold.price).toBe(132.09);
  });

  it("keeps the list price, so the original is never lost", () => {
    const sold = applyCostPrice(product(), "reception", "2026-08-14T10:00:00");
    expect(sold.listPrice).toBe(225);
  });

  it("records who did it and when", () => {
    const sold = applyCostPrice(product(), "reception", "2026-08-14T10:00:00");
    expect(sold.override).toMatchObject({
      by: "reception",
      at: "2026-08-14T10:00:00",
      from: 225,
      to: 132.09,
      mode: "cost",
    });
  });

  it("marks the line, so the report can keep it out of retail commission", () => {
    expect(applyCostPrice(product(), "reception", "t").priceMode).toBe("cost");
  });

  it("goes back to the list price on request", () => {
    const sold = applyCostPrice(product(), "reception", "t");
    const restored = restoreListPrice(sold);
    expect(restored.price).toBe(225);
    expect(restored.priceMode).toBeUndefined();
    expect(restored.finalValue).toBeUndefined();
  });

  it("refuses when the item has no cost on file, rather than charging zero", () => {
    const noCost = product({ cost: undefined });
    expect(applyCostPrice(noCost, "reception", "t")).toBe(noCost);
  });
});

describe("a final value typed at the counter", () => {
  it("charges exactly what was typed", () => {
    const state = tillReduce(emptyTill(), {
      type: "add",
      line: applyFinalValue(product(), 200, "reception", "t"),
    });
    expect(totals(state).subtotal).toBe(200);
  });

  it("is a fixed amount, not a percentage — it survives a quantity of three", () => {
    const three = applyFinalValue(product({ qty: 3 }), 500, "reception", "t");
    const state = tillReduce(emptyTill(), { type: "add", line: three });
    expect(totals(state).subtotal).toBe(500);
  });

  it("clears any percentage discount, so the two cannot both apply", () => {
    const line = applyFinalValue(product({ disc: 50 }), 200, "reception", "t");
    expect(line.disc).toBe(0);
    const state = tillReduce(emptyTill(), { type: "add", line });
    expect(totals(state).subtotal).toBe(200);
  });

  it("keeps the original price and records the override", () => {
    const line = applyFinalValue(product(), 200, "reception", "2026-08-14T10:00:00");
    expect(line.listPrice).toBe(225);
    expect(line.override).toMatchObject({ from: 225, to: 200, mode: "final", by: "reception" });
  });

  it("can be more than the list price, because a quote is a quote", () => {
    const line = applyFinalValue(product(), 400, "reception", "t");
    const state = tillReduce(emptyTill(), { type: "add", line });
    expect(totals(state).subtotal).toBe(400);
  });

  it("refuses a negative amount", () => {
    const p = product();
    expect(applyFinalValue(p, -50, "reception", "t")).toBe(p);
  });

  it("allows zero, for a line given away", () => {
    const line = applyFinalValue(product(), 0, "reception", "t");
    const state = tillReduce(emptyTill(), { type: "add", line });
    expect(totals(state).subtotal).toBe(0);
  });

  it("still counts VAT on what was actually charged", () => {
    const state = tillReduce(emptyTill(), {
      type: "add",
      line: applyFinalValue(product(), 115, "reception", "t"),
    });
    expect(totals(state).vat).toBeCloseTo(15, 2);
  });
});
