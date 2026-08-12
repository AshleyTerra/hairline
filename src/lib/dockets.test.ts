import { describe, expect, it } from "vitest";
import {
  closeDocket,
  docketDate,
  docketTotal,
  docketsOn,
  findDocket,
  isEmptyDocket,
  nextNumber,
  openDocket,
  saveDocket,
  type Docket,
} from "./dockets";
import { emptyTill, tillReduce } from "./till";
import type { TillLine } from "./types";

const line = (price: number, qty = 1, disc = 0): TillLine => ({
  key: `k${price}-${qty}-${disc}`,
  descr: "Cut - ladies",
  price,
  qty,
  disc,
  stylistId: 1,
  kind: "service",
});

const withLines = (...lines: TillLine[]) =>
  lines.reduce((s, l) => tillReduce(s, { type: "add", line: l }), emptyTill());

describe("invoice numbering", () => {
  it("carries on from the salon's last used number", () => {
    expect(nextNumber([], 90183)).toBe(90184);
  });

  it("never reuses a number already on an open docket", () => {
    const dockets: Docket[] = [
      { number: 90184, openedAt: "", state: emptyTill() },
      { number: 90185, openedAt: "", state: emptyTill() },
    ];
    expect(nextNumber(dockets, 90183)).toBe(90186);
  });

  it("keeps counting up after dockets are closed out of order", () => {
    let dockets: Docket[] = [];
    ({ dockets } = openDocket(dockets, emptyTill(), 100, "t"));
    ({ dockets } = openDocket(dockets, emptyTill(), 100, "t"));
    dockets = closeDocket(dockets, 101);
    const { docket } = openDocket(dockets, emptyTill(), 100, "t");
    expect(docket.number).toBe(103);
  });
});

describe("which day a docket is for", () => {
  it("defaults to the day it was opened", () => {
    const { docket } = openDocket([], emptyTill(), 500, "2026-07-25T09:00:00Z");
    expect(docketDate(docket)).toBe("2026-07-25");
  });

  it("can be prepared for a future day", () => {
    const { docket } = openDocket([], emptyTill(), 500, "2026-07-25T09:00:00Z", "2026-07-28");
    expect(docketDate(docket)).toBe("2026-07-28");
  });

  it("falls back to the opened date for dockets saved before forDate existed", () => {
    const legacy: Docket = { number: 1, openedAt: "2026-07-20T08:00:00Z", state: emptyTill() };
    expect(docketDate(legacy)).toBe("2026-07-20");
  });

  it("lists only the dockets for a given day", () => {
    let dockets: Docket[] = [];
    ({ dockets } = openDocket(dockets, emptyTill(), 500, "2026-07-25T09:00:00Z"));
    ({ dockets } = openDocket(dockets, emptyTill(), 500, "2026-07-25T09:05:00Z", "2026-07-28"));
    expect(docketsOn(dockets, "2026-07-25").map((d) => d.number)).toEqual([501]);
    expect(docketsOn(dockets, "2026-07-28").map((d) => d.number)).toEqual([502]);
  });

  it("numbers a future docket from the same sequence", () => {
    let dockets: Docket[] = [];
    ({ dockets } = openDocket(dockets, emptyTill(), 93710, "2026-07-25T09:00:00Z"));
    const { docket } = openDocket(dockets, emptyTill(), 93710, "2026-07-25T09:05:00Z", "2026-08-01");
    expect(docket.number).toBe(93712);
  });
});

describe("open dockets", () => {
  it("opens a docket with the next number", () => {
    const { docket, dockets } = openDocket([], emptyTill(), 500, "2026-07-25T09:00");
    expect(docket.number).toBe(501);
    expect(dockets).toHaveLength(1);
    expect(docket.openedAt).toBe("2026-07-25T09:00");
  });

  it("saves changes without changing the number or the open time", () => {
    const { dockets } = openDocket([], emptyTill(), 500, "09:00");
    const updated = saveDocket(dockets, 501, withLines(line(600)));
    expect(updated[0].number).toBe(501);
    expect(updated[0].openedAt).toBe("09:00");
    expect(updated[0].state.lines).toHaveLength(1);
  });

  it("leaves other dockets alone when one is saved", () => {
    let dockets: Docket[] = [];
    ({ dockets } = openDocket(dockets, emptyTill(), 500, "09:00"));
    ({ dockets } = openDocket(dockets, emptyTill(), 500, "09:30"));
    const updated = saveDocket(dockets, 501, withLines(line(600)));
    expect(updated.find((d) => d.number === 502)?.state.lines).toHaveLength(0);
  });

  it("finds a docket by number, or nothing", () => {
    const { dockets } = openDocket([], emptyTill(), 500, "09:00");
    expect(findDocket(dockets, 501)?.number).toBe(501);
    expect(findDocket(dockets, 999)).toBeUndefined();
  });

  it("closes only the docket asked for", () => {
    let dockets: Docket[] = [];
    ({ dockets } = openDocket(dockets, emptyTill(), 500, "t"));
    ({ dockets } = openDocket(dockets, emptyTill(), 500, "t"));
    expect(closeDocket(dockets, 501).map((d) => d.number)).toEqual([502]);
  });

  it("totals a docket including quantity and discount", () => {
    const { docket } = openDocket([], withLines(line(600), line(200, 2, 50)), 500, "t");
    expect(docketTotal(docket)).toBe(600 + 200);
  });

  it("knows when a docket is still empty", () => {
    const { docket: blank } = openDocket([], emptyTill(), 500, "t");
    expect(isEmptyDocket(blank)).toBe(true);
    const { docket: used } = openDocket([], withLines(line(600)), 500, "t");
    expect(isEmptyDocket(used)).toBe(false);
  });
});
