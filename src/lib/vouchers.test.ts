import { describe, expect, it } from "vitest";
import {
  DEFAULT_VOUCHER_MONTHS,
  VOUCHER_SEED,
  balanceOf,
  expiryFrom,
  findVouchers,
  isExpired,
  issueVoucher,
  nextVoucherNumber,
  redeem,
  usedOf,
  voucherLine,
  voucherReport,
  voucherTotals,
  type Voucher,
} from "./vouchers";

const BOUGHT = { clientId: 12, clientName: "Vera van Heerden", on: "2026-07-25" };

const DRAFT = {
  recipientName: "Celina",
  recipientTel: "084 811 0426",
  amount: 1000,
  expires: "2027-07-25",
  barcode: "",
};

const voucher = (over: Partial<Voucher> = {}): Voucher => ({
  number: 2019012152,
  barcode: "2019012152",
  clientId: 12,
  clientName: "Vera van Heerden",
  recipientName: "Celina",
  recipientTel: "0848110426",
  amount: 1000,
  purchasedOn: "2026-07-04",
  expires: "2027-07-04",
  redemptions: [],
  ...over,
});

describe("expiry", () => {
  it("runs twelve months by default", () => {
    expect(expiryFrom("2026-07-25")).toBe("2027-07-25");
    expect(DEFAULT_VOUCHER_MONTHS).toBe(12);
  });

  it("takes another term when the salon says so", () => {
    expect(expiryFrom("2026-07-25", 6)).toBe("2027-01-25");
  });

  it("knows when one has run out", () => {
    const v = voucher({ expires: "2026-07-04" });
    expect(isExpired(v, "2026-07-04")).toBe(false);
    expect(isExpired(v, "2026-07-05")).toBe(true);
  });
});

describe("issuing a voucher", () => {
  it("carries on from the salon's numbering", () => {
    const r = issueVoucher([], DRAFT, BOUGHT);
    expect(r.ok && r.voucher.number).toBe(VOUCHER_SEED + 1);
  });

  it("never reuses a number", () => {
    const existing = [voucher({ number: VOUCHER_SEED + 5 })];
    expect(nextVoucherNumber(existing)).toBe(VOUCHER_SEED + 6);
  });

  it("uses the number as the barcode when none is typed", () => {
    const r = issueVoucher([], DRAFT, BOUGHT);
    expect(r.ok && r.voucher.barcode).toBe(String(VOUCHER_SEED + 1));
  });

  it("keeps the barcode printed on the card", () => {
    const r = issueVoucher([], { ...DRAFT, barcode: "HL-0042" }, BOUGHT);
    expect(r.ok && r.voucher.barcode).toBe("HL-0042");
  });

  it("refuses a barcode already on another voucher", () => {
    const r = issueVoucher([voucher({ barcode: "HL-0042" })], { ...DRAFT, barcode: "HL-0042" }, BOUGHT);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/already on another voucher/i);
  });

  it("records who bought it and when", () => {
    const r = issueVoucher([], DRAFT, { ...BOUGHT, invoice: 93733 });
    expect(r.ok && r.voucher.clientName).toBe("Vera van Heerden");
    expect(r.ok && r.voucher.purchasedOn).toBe("2026-07-25");
    expect(r.ok && r.voucher.soldOn).toBe(93733);
  });

  it("books a walk-in purchase as a walk-in", () => {
    const r = issueVoucher([], DRAFT, { clientId: null, clientName: "", on: "2026-07-25" });
    expect(r.ok && r.voucher.clientName).toBe("Walk-in");
    expect(r.ok && r.voucher.clientId).toBeNull();
  });

  it("refuses one with nobody's name on it", () => {
    expect(issueVoucher([], { ...DRAFT, recipientName: "  " }, BOUGHT).ok).toBe(false);
  });

  it("refuses one with no money on it", () => {
    expect(issueVoucher([], { ...DRAFT, amount: 0 }, BOUGHT).ok).toBe(false);
  });

  it("refuses a malformed phone number but allows none at all", () => {
    expect(issueVoucher([], { ...DRAFT, recipientTel: "123" }, BOUGHT).ok).toBe(false);
    expect(issueVoucher([], { ...DRAFT, recipientTel: "" }, BOUGHT).ok).toBe(true);
  });

  it("refuses an expiry that has already passed", () => {
    expect(issueVoucher([], { ...DRAFT, expires: "2026-07-24" }, BOUGHT).ok).toBe(false);
  });
});

describe("the line it puts on the docket", () => {
  it("is a Hairline stock sale with no stylist against it", () => {
    const line = voucherLine(DRAFT, "k1");
    expect(line.kind).toBe("stock");
    expect(line.stylistId).toBeNull();
  });

  it("names the recipient and carries the amount", () => {
    const line = voucherLine(DRAFT, "k1");
    expect(line.descr).toBe("Gift voucher — Celina");
    expect(line.price).toBe(1000);
    expect(line.qty).toBe(1);
  });

  it("keeps the draft on the line, so a parked docket can still issue it", () => {
    expect(voucherLine(DRAFT, "k1").voucher?.recipientName).toBe("Celina");
  });
});

describe("finding one to redeem", () => {
  const all = [
    voucher({
      number: 2019012150,
      barcode: "2019012150",
      recipientName: "george",
      recipientTel: "",
      clientName: "Vouchers .",
    }),
    voucher({ number: 2019012151, barcode: "HL-0042", recipientName: "CELINA", clientName: "Walk-in", recipientTel: "0848110426" }),
  ];

  it("finds it by barcode", () => {
    expect(findVouchers(all, "HL-0042").map((v) => v.number)).toEqual([2019012151]);
  });

  it("finds it by voucher number", () => {
    expect(findVouchers(all, "2019012150").map((v) => v.number)).toEqual([2019012150]);
  });

  it("finds it by recipient, whatever the casing", () => {
    expect(findVouchers(all, "celina").map((v) => v.number)).toEqual([2019012151]);
  });

  it("finds it by the client who bought it", () => {
    expect(findVouchers(all, "vouchers").map((v) => v.number)).toEqual([2019012150]);
  });

  it("finds it by the recipient's cell", () => {
    expect(findVouchers(all, "084 811 0426").map((v) => v.number)).toEqual([2019012151]);
  });

  it("finds nothing on an empty search", () => {
    expect(findVouchers(all, "   ")).toEqual([]);
  });
});

describe("redeeming", () => {
  it("takes part of it and leaves the rest for next time", () => {
    const r = redeem(voucher(), 280, "2026-07-25", 93733);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(usedOf(r.voucher)).toBe(280);
      expect(balanceOf(r.voucher)).toBe(720);
      expect(r.voucher.redemptions[0].invoice).toBe(93733);
    }
  });

  it("adds up across visits", () => {
    const first = redeem(voucher(), 280, "2026-07-25");
    if (!first.ok) throw new Error("setup failed");
    const second = redeem(first.voucher, 150, "2026-08-01");
    expect(second.ok && balanceOf(second.voucher)).toBe(570);
    expect(second.ok && second.voucher.redemptions).toHaveLength(2);
  });

  it("refuses more than is left, and says how much that is", () => {
    const used = redeem(voucher(), 900, "2026-07-25");
    if (!used.ok) throw new Error("setup failed");
    const r = redeem(used.voucher, 200, "2026-07-25");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/only 100\.00 is left/i);
  });

  it("refuses one that has expired, and says when", () => {
    const r = redeem(voucher({ expires: "2026-07-04" }), 100, "2026-07-25");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/expired on 2026-07-04/);
  });

  it("refuses a fully used voucher", () => {
    const spent = voucher({ redemptions: [{ date: "2026-07-05", amount: 1000 }] });
    expect(redeem(spent, 50, "2026-07-25").ok).toBe(false);
  });

  it("refuses nothing at all", () => {
    expect(redeem(voucher(), 0, "2026-07-25").ok).toBe(false);
  });

  it("leaves the voucher it was given alone", () => {
    const v = voucher();
    redeem(v, 280, "2026-07-25");
    expect(v.redemptions).toHaveLength(0);
  });
});

describe("the vouchers report", () => {
  const all = [
    voucher({ number: 2019012150, purchasedOn: "2026-05-23", recipientName: "george", recipientTel: "", amount: 200, clientName: "Vouchers ." }),
    voucher({
      number: 2019012151,
      purchasedOn: "2026-07-04",
      recipientName: "CELINA",
      amount: 1000,
      redemptions: [{ date: "2026-07-20", amount: 1000 }],
    }),
    voucher({ number: 2019012199, purchasedOn: "2025-01-01", amount: 500 }),
  ];

  it("covers the period asked for", () => {
    const rows = voucherReport(all, "2026-05-13", "2026-08-13");
    expect(rows.map((r) => r.number)).toEqual([2019012150, 2019012151]);
  });

  it("shows what was sold, used and is still outstanding", () => {
    const [first, second] = voucherReport(all, "2026-05-13", "2026-08-13");
    expect([first.amount, first.used, first.outstanding]).toEqual([200, 0, 200]);
    expect([second.amount, second.used, second.outstanding]).toEqual([1000, 1000, 0]);
  });

  it("carries the client and the recipient's details", () => {
    const [first] = voucherReport(all, "2026-05-13", "2026-08-13");
    expect(first.client).toBe("Vouchers .");
    expect(first.recipient).toBe("george");
  });

  it("totals the columns", () => {
    const totals = voucherTotals(voucherReport(all, "2026-05-13", "2026-08-13"));
    expect(totals).toEqual({ amount: 1200, used: 1000, outstanding: 200 });
  });

  it("copes with a range given back to front", () => {
    expect(voucherReport(all, "2026-08-13", "2026-05-13")).toHaveLength(2);
  });
});
