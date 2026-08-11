import { describe, expect, it } from "vitest";
import { emptyTill, tillReduce, totals } from "./till";
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
