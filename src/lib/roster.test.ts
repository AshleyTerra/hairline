import { describe, expect, it } from "vitest";
import { blankStats, creditable, isSupport, member, roster } from "./roster";
import type { StaffRecord } from "./staffAdmin";
import type { Staff } from "./types";

const record = (over: Partial<StaffRecord> & { id: number; name: string }): StaffRecord => ({
  designation: "Stylist",
  email: "",
  tel: "",
  active: true,
  ...over,
});

const history = (over: Partial<Staff> & { id: number; name: string }): Staff => ({
  ...blankStats(over.id, over.name),
  ...over,
});

const RECORDS: StaffRecord[] = [
  record({ id: 1, name: "Karin M.", designation: "Senior stylist" }),
  record({ id: 11, name: "Cynthia Z.", designation: "Assistant" }),
  record({ id: 68, name: "Ann K.", designation: "Reception" }),
];

const HISTORY: Staff[] = [
  history({ id: 1, name: "Karin M.", totalRevenue: 2473435, invoices: 1798 }),
  history({ id: 11, name: "Cynthia Z.", role: "assistant" }),
  history({ id: 68, name: "Ann K.", role: "reception" }),
];

describe("who counts as support", () => {
  it("treats operators, assistants, apprentices and reception as support", () => {
    expect(isSupport("Operator")).toBe(true);
    expect(isSupport("Assistant")).toBe(true);
    expect(isSupport("Apprentice")).toBe(true);
    expect(isSupport("Reception")).toBe(true);
  });

  it("treats anyone billed for their own work as a stylist", () => {
    expect(isSupport("Senior stylist")).toBe(false);
    expect(isSupport("Stylist")).toBe(false);
    expect(isSupport("Junior stylist")).toBe(false);
    expect(isSupport("Colour technician")).toBe(false);
  });
});

describe("the roster", () => {
  it("takes names and designations from the records, not the history", () => {
    const renamed = [record({ id: 1, name: "Karin McGorian", designation: "Operator" })];
    const [only] = roster(renamed, HISTORY);
    expect(only.name).toBe("Karin McGorian");
    expect(only.designation).toBe("Operator");
  });

  it("carries the history across on the staff number", () => {
    const [karin] = roster(RECORDS, HISTORY);
    expect(karin.stats.totalRevenue).toBe(2473435);
    expect(karin.stats.invoices).toBe(1798);
  });

  it("includes someone taken on today, with nothing on the clock yet", () => {
    const withNew = [...RECORDS, record({ id: 82, name: "Nomsa Dlamini" })];
    const nomsa = roster(withNew, HISTORY).find((m) => m.id === 82);
    expect(nomsa).toBeTruthy();
    expect(nomsa!.stats.totalRevenue).toBe(0);
    expect(nomsa!.stats.monthly).toEqual([]);
    expect(nomsa!.support).toBe(false);
  });

  it("drops anyone turned inactive", () => {
    const off = RECORDS.map((r) => (r.id === 11 ? { ...r, active: false } : r));
    expect(roster(off, HISTORY).map((m) => m.id)).toEqual([1, 68]);
  });

  it("splits stylists from support by designation", () => {
    const team = roster(RECORDS, HISTORY);
    expect(team.filter((m) => !m.support).map((m) => m.id)).toEqual([1]);
    expect(team.filter((m) => m.support).map((m) => m.id)).toEqual([11, 68]);
  });

  it("moves someone across when their designation changes", () => {
    const promoted = RECORDS.map((r) => (r.id === 11 ? { ...r, designation: "Stylist" } : r));
    const cynthia = roster(promoted, HISTORY).find((m) => m.id === 11);
    expect(cynthia!.support).toBe(false);
  });

  it("keeps an operator with the support staff, not the stylists", () => {
    const asOperator = RECORDS.map((r) => (r.id === 1 ? { ...r, designation: "Operator" } : r));
    const karin = roster(asOperator, HISTORY).find((m) => m.id === 1);
    expect(karin!.support).toBe(true);
  });

  it("does not invent people who have history but no record", () => {
    const orphan = [...HISTORY, history({ id: 99, name: "Gone A." })];
    expect(roster(RECORDS, orphan).map((m) => m.id)).toEqual([1, 11, 68]);
  });
});

describe("who can be credited or tipped", () => {
  it("offers everyone but reception", () => {
    expect(creditable(roster(RECORDS, HISTORY)).map((m) => m.id)).toEqual([1, 11]);
  });

  it("offers a new stylist straight away", () => {
    const withNew = [...RECORDS, record({ id: 82, name: "Nomsa Dlamini" })];
    expect(creditable(roster(withNew, HISTORY)).map((m) => m.id)).toContain(82);
  });
});

describe("one member by number", () => {
  it("finds someone with history", () => {
    expect(member(RECORDS, HISTORY, 1)?.stats.invoices).toBe(1798);
  });

  it("finds someone who only exists as a record", () => {
    const withNew = [...RECORDS, record({ id: 82, name: "Nomsa Dlamini" })];
    const found = member(withNew, HISTORY, 82);
    expect(found?.name).toBe("Nomsa Dlamini");
    expect(found?.stats.totalRevenue).toBe(0);
  });

  it("still finds someone turned inactive, so old links keep working", () => {
    const off = RECORDS.map((r) => (r.id === 11 ? { ...r, active: false } : r));
    expect(member(off, HISTORY, 11)?.name).toBe("Cynthia Z.");
  });

  it("returns nothing for a number nobody has", () => {
    expect(member(RECORDS, HISTORY, 404)).toBeNull();
  });
});
