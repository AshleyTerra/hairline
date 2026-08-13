/**
 * The diary: a day of appointments per stylist.
 *
 * Two kinds sit side by side. Past days are *reconstructed* from the invoices
 * that were actually rung up — the salon barely used MySalon's diary, so the
 * only honest record of who was in the chair is the till. Days from here on are
 * *booked*: reception puts them in, and they are the salon's own.
 */
import type { Service, TillLine } from "./types";

export const DAY_START_HOUR = 7;
export const DAY_END_HOUR = 19;
/** Bookings land on the quarter hour, as the salon quotes its times. */
export const SLOT_MINUTES = 15;

export type AppointmentSource = "invoiced" | "booked";

export interface Appointment {
  /** Stable per day: an invoice number for history, a booking id for the rest. */
  id: string;
  date: string;
  /** HH:MM, 24-hour. */
  start: string;
  mins: number;
  clientId: number | null;
  clientName: string;
  stylistId: number;
  service: string;
  dept: string;
  source: AppointmentSource;
  /** What the visit came to, where it has already been invoiced. */
  total?: number;
}

/** A booking reception has made, as stored. */
export interface BookedAppointment {
  id: string;
  date: string;
  start: string;
  mins: number;
  clientId: number | null;
  clientName: string;
  stylistId: number;
  service: string;
  dept: string;
  note?: string;
  /**
   * The docket opened for them on arrival. Cancelling the booking closes it too,
   * so a client who never came does not leave a sale sitting at the counter.
   */
  docketNumber?: number;
}

export const toMinutes = (time: string): number => {
  const [h = 0, m = 0] = time.split(":").map(Number);
  return h * 60 + m;
};

export const toTime = (minutes: number): string => {
  const wrapped = Math.max(0, minutes);
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

export const endTime = (start: string, mins: number): string => toTime(toMinutes(start) + mins);

/** Every bookable time in the salon's trading day. */
export function slots(
  step = SLOT_MINUTES,
  startHour = DAY_START_HOUR,
  endHour = DAY_END_HOUR
): string[] {
  const out: string[] = [];
  for (let m = startHour * 60; m < endHour * 60; m += step) out.push(toTime(m));
  return out;
}

/** The slot a click at some offset down the column lands on. */
export function slotAt(minutesFromOpen: number, step = SLOT_MINUTES): string {
  const clamped = Math.max(0, Math.min(minutesFromOpen, (DAY_END_HOUR - DAY_START_HOUR) * 60 - step));
  const snapped = Math.floor(clamped / step) * step;
  return toTime(DAY_START_HOUR * 60 + snapped);
}

/** True when two spans share any time. Back-to-back appointments do not. */
export function overlaps(
  a: { start: string; mins: number },
  b: { start: string; mins: number }
): boolean {
  const aStart = toMinutes(a.start);
  const bStart = toMinutes(b.start);
  return aStart < bStart + b.mins && bStart < aStart + a.mins;
}

/**
 * The appointment a proposed booking would run into, if any. Double-booking is
 * refused rather than drawn in overlapping lanes: a stylist has one pair of
 * hands, and the reconstructed history is allowed to overlap only because it
 * records what was invoiced, not what was promised.
 */
export function clash(
  existing: readonly Appointment[],
  candidate: { date: string; start: string; mins: number; stylistId: number; id?: string }
): Appointment | null {
  return (
    existing.find(
      (a) =>
        a.id !== candidate.id &&
        a.date === candidate.date &&
        a.stylistId === candidate.stylistId &&
        overlaps(a, candidate)
    ) ?? null
  );
}

export type BookingResult =
  | { ok: true; booking: BookedAppointment }
  | { ok: false; error: string };

export interface BookingDraft {
  date: string;
  start: string;
  mins: number;
  clientId: number | null;
  clientName: string;
  stylistId: number | null;
  service: string;
  dept: string;
  note?: string;
}

/** Validates a booking against the day, then stamps it with an id. */
export function book(
  existing: readonly Appointment[],
  draft: BookingDraft,
  id: string
): BookingResult {
  const clientName = draft.clientName.trim();
  if (!clientName) return { ok: false, error: "Whose appointment is it? Add a name." };
  if (!draft.service.trim()) return { ok: false, error: "Choose what they are booked for." };
  if (draft.stylistId == null) return { ok: false, error: "Choose who is doing it." };
  if (!Number.isFinite(draft.mins) || draft.mins < SLOT_MINUTES) {
    return { ok: false, error: `An appointment runs at least ${SLOT_MINUTES} minutes.` };
  }

  const start = toMinutes(draft.start);
  if (start < DAY_START_HOUR * 60) {
    return { ok: false, error: `The salon opens at ${toTime(DAY_START_HOUR * 60)}.` };
  }
  if (start + draft.mins > DAY_END_HOUR * 60) {
    return {
      ok: false,
      error: `That runs past closing at ${toTime(DAY_END_HOUR * 60)}. Shorten it or start earlier.`,
    };
  }

  const hit = clash(existing, { ...draft, stylistId: draft.stylistId });
  if (hit) {
    return {
      ok: false,
      error: `Already booked: ${hit.clientName} at ${hit.start}–${endTime(hit.start, hit.mins)}.`,
    };
  }

  return {
    ok: true,
    booking: {
      id,
      date: draft.date,
      start: draft.start,
      mins: draft.mins,
      clientId: draft.clientId,
      clientName,
      stylistId: draft.stylistId,
      service: draft.service.trim(),
      dept: draft.dept,
      note: draft.note?.trim() || undefined,
    },
  };
}

/**
 * What to charge for a cancellation, suggested rather than imposed: half the
 * service, to the nearest ten rand, which is what the salon quotes for a late
 * cancellation. Reception can charge nothing, or type their own figure.
 */
export function suggestedFee(price: number | undefined, share = 0.5): number {
  if (!price || price <= 0 || share <= 0) return 0;
  return Math.round((price * share) / 10) * 10;
}

/** The line a cancellation charge puts on a docket, so it can be settled. */
export function cancellationLine(
  appointment: { service: string; stylistId: number },
  fee: number,
  key: string
): TillLine {
  return {
    key,
    descr: `Cancellation fee — ${appointment.service}`,
    price: fee,
    qty: 1,
    disc: 0,
    stylistId: appointment.stylistId,
    kind: "service",
  };
}

/** How long to hold the chair for a service, rounded up to a bookable slot. */
export function durationFor(service: Pick<Service, "mins"> | undefined, fallback = 30): number {
  const mins = service?.mins && service.mins > 0 ? service.mins : fallback;
  return Math.max(SLOT_MINUTES, Math.ceil(mins / SLOT_MINUTES) * SLOT_MINUTES);
}

export interface PlacedAppointment {
  appointment: Appointment;
  lane: number;
  lanes: number;
}

/**
 * Reconstructed appointments often overlap, because invoice times cluster round
 * the counter. Each overlapping run gets its own lanes so nothing hides behind
 * anything else.
 */
export function place(appointments: readonly Appointment[]): PlacedAppointment[] {
  const sorted = [...appointments].sort(
    (a, b) => toMinutes(a.start) - toMinutes(b.start) || a.id.localeCompare(b.id)
  );
  const placed: PlacedAppointment[] = [];
  let cluster: { appointment: Appointment; lane: number; end: number }[] = [];
  let clusterEnd = -1;

  const flush = () => {
    const lanes = cluster.reduce((max, c) => Math.max(max, c.lane + 1), 1);
    for (const c of cluster) placed.push({ appointment: c.appointment, lane: c.lane, lanes });
    cluster = [];
    clusterEnd = -1;
  };

  for (const appointment of sorted) {
    const start = toMinutes(appointment.start);
    const end = start + appointment.mins;
    if (cluster.length > 0 && start >= clusterEnd) flush();

    const used = new Set(cluster.filter((c) => c.end > start).map((c) => c.lane));
    let lane = 0;
    while (used.has(lane)) lane += 1;

    cluster.push({ appointment, lane, end });
    clusterEnd = Math.max(clusterEnd, end);
  }
  flush();
  return placed;
}

/** How busy each stylist is on the day, for the column headings. */
export function countByStylist(appointments: readonly Appointment[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const a of appointments) counts.set(a.stylistId, (counts.get(a.stylistId) ?? 0) + 1);
  return counts;
}

/** The first free slot for a stylist, for the New booking button. */
export function firstFreeSlot(
  existing: readonly Appointment[],
  date: string,
  stylistId: number,
  mins: number
): string {
  for (const start of slots()) {
    if (toMinutes(start) + mins > DAY_END_HOUR * 60) break;
    if (!clash(existing, { date, start, mins, stylistId })) return start;
  }
  return toTime(DAY_START_HOUR * 60);
}
