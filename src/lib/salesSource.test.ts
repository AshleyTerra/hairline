import { describe, expect, it } from "vitest";
import { analytics, daybook, meta } from "./data";
import { periodStats } from "./salesSource";

/**
 * These run against the real generated dataset, so they double as a check that
 * the dashboard's headline figures agree with the analytics the deck quotes.
 */
describe("period figures", () => {
  it("reads a single day from the day book", () => {
    const s = periodStats(meta.demoDate, meta.demoDate, []);
    expect(s.source).toBe("daybook");
    expect(s.count).toBe(34);
    expect(s.total).toBe(42790);
  });

  it("reports card and cash as percentages, not fractions", () => {
    const s = periodStats(meta.demoDate, meta.demoDate, []);
    // The demo day was entirely card and EFT, so card share is a real percentage.
    expect(s.cardShare).toBeGreaterThan(50);
    expect(s.cardShare).toBeLessThanOrEqual(100);
  });

  it("uses monthly detail for a recent year, and the months sum to the year", () => {
    // 2025 sits inside the 24-month window, so the finer source is used — and
    // its total must still reconcile with the yearly figure the deck quotes.
    const s = periodStats("2025-01-01", "2025-12-31", []);
    expect(s.source).toBe("months");
    const y = analytics.revenueByYear.find((x) => x.year === 2025);
    expect(s.total).toBeCloseTo(y!.revenue, 0);
    expect(s.count).toBe(y!.invoices);
  });

  it("falls back to the yearly aggregate for a year before the monthly window", () => {
    const s = periodStats("2019-01-01", "2019-12-31", []);
    expect(s.source).toBe("years");
    const y = analytics.revenueByYear.find((x) => x.year === 2019);
    expect(s.total).toBeCloseTo(y!.revenue, 2);
    expect(s.count).toBe(y!.invoices);
  });

  it("falls back to the monthly aggregate for a month before the day book", () => {
    const s = periodStats("2025-12-01", "2025-12-31", []);
    expect(s.source).toBe("months");
    const m = analytics.revenueByMonth.find((x) => x.ym === "2025-12");
    expect(s.total).toBeCloseTo(m!.revenue, 2);
  });

  it("uses the day book for a month inside its window", () => {
    expect(periodStats("2026-06-01", "2026-06-30", []).source).toBe("daybook");
  });

  it("marks aggregate periods so the card share can be labelled honestly", () => {
    const s = periodStats("2019-01-01", "2019-12-31", []);
    expect(s.source).not.toBe("daybook");
    expect(s.cardShare).toBe(analytics.paymentMix.cardShare);
  });

  it("counts trading days, not calendar days", () => {
    const s = periodStats(daybook.from, meta.demoDate, []);
    expect(s.days).toBeLessThan(200);
    expect(s.days).toBeGreaterThan(100);
  });

  it("tolerates the dates being the wrong way round", () => {
    const forward = periodStats("2026-06-01", "2026-06-30", []);
    const backward = periodStats("2026-06-30", "2026-06-01", []);
    expect(backward.total).toBe(forward.total);
  });

  it("adds sales rung up in the demo to the demo day", () => {
    const before = periodStats(meta.demoDate, meta.demoDate, []);
    const after = periodStats(meta.demoDate, meta.demoDate, [
      {
        id: 1,
        date: `${meta.demoDate}T12:00:00`,
        clientId: null,
        clientName: "Walk-in",
        total: 500,
        lines: [],
        payments: [{ method: "card", amount: 500 }],
        tips: [],
        seconds: 20,
      },
    ]);
    expect(after.total).toBe(before.total + 500);
    expect(after.count).toBe(before.count + 1);
  });
});
