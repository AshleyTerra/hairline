/**
 * The team as the salon administers it.
 *
 * Who is on the books, what they are called and whether they are still working
 * comes from the editable staff records in Admin. Turnover, tips and clock
 * history come from the migrated MySalon file, joined on the staff number.
 * Someone taken on today has no history yet, so they arrive with zeros rather
 * than being left off the screen — and someone turned inactive drops off it.
 */
import type { Staff } from "./types";
import type { StaffRecord } from "./staffAdmin";

/**
 * Designations whose work MySalon bills under a senior stylist. Operators,
 * assistants and apprentices earn tips daily but never carry turnover of their
 * own, and reception carries none either, which is why the team screen shows
 * them apart from the stylists.
 */
const SUPPORT = /operator|assistant|apprentice|reception/i;

export const isSupport = (designation: string): boolean => SUPPORT.test(designation);

/** No history yet: everything at zero, so the screens need no special case. */
export function blankStats(id: number, name: string): Staff {
  return {
    id,
    name,
    firstName: name.split(" ")[0] ?? name,
    role: "stylist",
    onDiary: true,
    startDate: null,
    serviceRevenue: 0,
    retailRevenue: 0,
    totalRevenue: 0,
    invoices: 0,
    retailShare: 0,
    monthly: [],
    monthlyTarget: 0,
    tips: { total: 0, times: 0, lastTip: null },
    subs: { total: 0, times: 0 },
    clock: [],
  };
}

export interface RosterMember {
  id: number;
  /** From the record, so a rename in Admin shows everywhere. */
  name: string;
  designation: string;
  /** True when their work is billed under a senior stylist. */
  support: boolean;
  stats: Staff;
}

/** Active staff, in record order, each carrying whatever history they have. */
export function roster(
  records: readonly StaffRecord[],
  history: readonly Staff[]
): RosterMember[] {
  const byId = new Map(history.map((s) => [s.id, s]));
  return records
    .filter((r) => r.active)
    .map((r) => ({
      id: r.id,
      name: r.name,
      designation: r.designation,
      support: isSupport(r.designation),
      stats: byId.get(r.id) ?? blankStats(r.id, r.name),
    }));
}

/**
 * Anyone who can be credited with work or handed a tip: the whole team bar
 * reception, newest last, so the till's pickers agree with each other. Fed an
 * active roster, it offers only people who are still working.
 */
export const creditable = (members: readonly RosterMember[]): RosterMember[] =>
  members.filter((m) => !/reception/i.test(m.designation));

/** One member by staff number, whether they have history or only a record. */
export function member(
  records: readonly StaffRecord[],
  history: readonly Staff[],
  id: number
): RosterMember | null {
  const record = records.find((r) => r.id === id);
  const stats = history.find((s) => s.id === id);
  if (!record && !stats) return null;
  const name = record?.name ?? stats!.name;
  return {
    id,
    name,
    designation:
      record?.designation ??
      (stats!.role === "assistant"
        ? "Assistant"
        : stats!.role === "reception"
          ? "Reception"
          : "Stylist"),
    support: isSupport(record?.designation ?? stats!.role),
    stats: stats ?? blankStats(id, name),
  };
}
