import { describe, expect, it } from "vitest";
import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  SLOT_MINUTES,
  book,
  cancellationLine,
  clash,
  countByStylist,
  durationFor,
  endTime,
  firstFreeSlot,
  overlaps,
  place,
  slotAt,
  slots,
  suggestedFee,
  toMinutes,
  toTime,
  type Appointment,
} from "./diary";

const appt = (over: Partial<Appointment> & { id: string; start: string; mins: number }): Appointment => ({
  date: "2026-07-25",
  clientId: 1,
  clientName: "A client",
  stylistId: 1,
  service: "Cut - ladies",
  dept: "Cutting & Styling",
  source: "booked",
  ...over,
});

describe("times", () => {
  it("reads and writes the clock", () => {
    expect(toMinutes("09:45")).toBe(585);
    expect(toTime(585)).toBe("09:45");
  });

  it("pads the hour, so times sort as text", () => {
    expect(toTime(7 * 60 + 5)).toBe("07:05");
  });

  it("works out when an appointment finishes", () => {
    expect(endTime("14:30", 90)).toBe("16:00");
  });
});

describe("slots", () => {
  it("runs from opening to the last bookable quarter", () => {
    const all = slots();
    expect(all[0]).toBe("07:00");
    expect(all.at(-1)).toBe("18:45");
    expect(all).toHaveLength(((DAY_END_HOUR - DAY_START_HOUR) * 60) / SLOT_MINUTES);
  });

  it("snaps a click to the slot it landed in", () => {
    expect(slotAt(0)).toBe("07:00");
    expect(slotAt(20)).toBe("07:15");
    expect(slotAt(59)).toBe("07:45");
  });

  it("never snaps past the last slot of the day", () => {
    expect(slotAt(10_000)).toBe("18:45");
  });
});

describe("overlapping", () => {
  it("sees an overlap", () => {
    expect(overlaps({ start: "09:00", mins: 60 }, { start: "09:30", mins: 30 })).toBe(true);
  });

  it("lets appointments sit back to back", () => {
    expect(overlaps({ start: "09:00", mins: 30 }, { start: "09:30", mins: 30 })).toBe(false);
  });

  it("does not care which order it is asked in", () => {
    expect(overlaps({ start: "09:30", mins: 30 }, { start: "09:00", mins: 60 })).toBe(true);
  });
});

describe("clashes", () => {
  const day = [appt({ id: "a", start: "10:00", mins: 60 })];

  it("names the appointment in the way", () => {
    const hit = clash(day, { date: "2026-07-25", start: "10:30", mins: 30, stylistId: 1 });
    expect(hit?.id).toBe("a");
  });

  it("allows the same time for a different stylist", () => {
    expect(clash(day, { date: "2026-07-25", start: "10:30", mins: 30, stylistId: 4 })).toBeNull();
  });

  it("allows the same time on a different day", () => {
    expect(clash(day, { date: "2026-07-26", start: "10:30", mins: 30, stylistId: 1 })).toBeNull();
  });

  it("does not count an appointment against itself when it is moved", () => {
    expect(
      clash(day, { date: "2026-07-25", start: "10:15", mins: 30, stylistId: 1, id: "a" })
    ).toBeNull();
  });
});

describe("making a booking", () => {
  const day = [appt({ id: "a", start: "10:00", mins: 60, clientName: "Karin's 10 o'clock" })];
  const draft = {
    date: "2026-07-25",
    start: "11:00",
    mins: 45,
    clientId: 7,
    clientName: "Nomsa Dlamini",
    stylistId: 1,
    service: "Cut - ladies",
    dept: "Cutting & Styling",
  };

  it("takes a booking in a free slot", () => {
    const r = book(day, draft, "b1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.booking.start).toBe("11:00");
      expect(r.booking.mins).toBe(45);
      expect(r.booking.id).toBe("b1");
    }
  });

  it("refuses one that runs into another, and says whose", () => {
    const r = book(day, { ...draft, start: "10:30" }, "b1");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/already booked/i);
      expect(r.error).toContain("Karin's 10 o'clock");
      expect(r.error).toContain("10:00–11:00");
    }
  });

  it("refuses a booking with nobody's name on it", () => {
    expect(book(day, { ...draft, clientName: "  " }, "b1").ok).toBe(false);
  });

  it("refuses one with no service", () => {
    expect(book(day, { ...draft, service: "" }, "b1").ok).toBe(false);
  });

  it("refuses one with nobody to do it", () => {
    expect(book(day, { ...draft, stylistId: null }, "b1").ok).toBe(false);
  });

  it("refuses one that runs past closing", () => {
    const r = book(day, { ...draft, start: "18:30", mins: 60 }, "b1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/past closing/i);
  });

  it("refuses one before the doors open", () => {
    const r = book(day, { ...draft, start: "06:00" }, "b1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/opens at 07:00/i);
  });

  it("trims the name and drops an empty note", () => {
    const r = book(day, { ...draft, clientName: "  Nomsa  ", note: "   " }, "b1");
    expect(r.ok && r.booking.clientName).toBe("Nomsa");
    expect(r.ok && r.booking.note).toBeUndefined();
  });

  it("keeps a note that says something", () => {
    const r = book(day, { ...draft, note: "Allergic to ammonia" }, "b1");
    expect(r.ok && r.booking.note).toBe("Allergic to ammonia");
  });
});

describe("charging for a cancellation", () => {
  it("suggests half the service, to the nearest ten rand", () => {
    expect(suggestedFee(600)).toBe(300);
    expect(suggestedFee(270)).toBe(140);
  });

  it("suggests nothing when the service has no price", () => {
    expect(suggestedFee(undefined)).toBe(0);
    expect(suggestedFee(0)).toBe(0);
  });

  it("takes another share when the salon charges differently", () => {
    expect(suggestedFee(600, 1)).toBe(600);
    expect(suggestedFee(600, 0)).toBe(0);
  });

  it("puts the charge on a docket line that names what was missed", () => {
    const line = cancellationLine({ service: "Cut - ladies", stylistId: 4 }, 300, "k1");
    expect(line.descr).toBe("Cancellation fee — Cut - ladies");
    expect(line.price).toBe(300);
    expect(line.qty).toBe(1);
    expect(line.stylistId).toBe(4);
    expect(line.kind).toBe("service");
  });
});

describe("how long to hold the chair", () => {
  it("rounds a service up to the next quarter", () => {
    expect(durationFor({ mins: 50 })).toBe(60);
    expect(durationFor({ mins: 45 })).toBe(45);
  });

  it("falls back when the service has no time on it", () => {
    expect(durationFor({ mins: 0 })).toBe(30);
    expect(durationFor(undefined)).toBe(30);
  });

  it("never holds less than one slot", () => {
    expect(durationFor({ mins: 5 })).toBe(SLOT_MINUTES);
  });
});

describe("laying the day out", () => {
  it("gives overlapping appointments their own lanes", () => {
    const placed = place([
      appt({ id: "a", start: "10:00", mins: 60 }),
      appt({ id: "b", start: "10:30", mins: 60 }),
    ]);
    expect(placed.map((p) => p.lane)).toEqual([0, 1]);
    expect(placed.every((p) => p.lanes === 2)).toBe(true);
  });

  it("puts appointments that do not overlap full width", () => {
    const placed = place([
      appt({ id: "a", start: "09:00", mins: 30 }),
      appt({ id: "b", start: "11:00", mins: 30 }),
    ]);
    expect(placed.every((p) => p.lanes === 1 && p.lane === 0)).toBe(true);
  });

  it("reuses a lane once its appointment has finished", () => {
    const placed = place([
      appt({ id: "a", start: "09:00", mins: 60 }),
      appt({ id: "b", start: "09:30", mins: 60 }),
      appt({ id: "c", start: "10:00", mins: 30 }),
    ]);
    expect(placed.find((p) => p.appointment.id === "c")?.lane).toBe(0);
  });

  it("keeps every appointment it was given", () => {
    const day = [
      appt({ id: "a", start: "09:00", mins: 60 }),
      appt({ id: "b", start: "09:30", mins: 60 }),
      appt({ id: "c", start: "14:00", mins: 30 }),
    ];
    expect(place(day)).toHaveLength(3);
  });
});

describe("the day at a glance", () => {
  it("counts appointments per stylist", () => {
    const counts = countByStylist([
      appt({ id: "a", start: "09:00", mins: 30, stylistId: 1 }),
      appt({ id: "b", start: "10:00", mins: 30, stylistId: 1 }),
      appt({ id: "c", start: "10:00", mins: 30, stylistId: 4 }),
    ]);
    expect(counts.get(1)).toBe(2);
    expect(counts.get(4)).toBe(1);
  });

  it("offers the first slot that is actually free", () => {
    const day = [
      appt({ id: "a", start: "07:00", mins: 60 }),
      appt({ id: "b", start: "08:00", mins: 30 }),
    ];
    expect(firstFreeSlot(day, "2026-07-25", 1, 30)).toBe("08:30");
  });

  it("opens with the doors when the day is empty", () => {
    expect(firstFreeSlot([], "2026-07-25", 1, 60)).toBe("07:00");
  });
});
