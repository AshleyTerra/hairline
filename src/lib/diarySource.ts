/**
 * Where the diary's appointments come from.
 *
 * The salon barely used MySalon's diary in eleven years, so for any past day the
 * only honest record of who sat in which chair is the till: the invoices, with
 * their times, reconstructed into a day. Bookings reception makes here are kept
 * separately and shown alongside.
 */
import { daybook, demoday, meta, services } from "./data";
import { catalogue } from "./salesSource";
import { durationFor, type Appointment, type BookedAppointment } from "./diary";

const byName = new Map(services.map((s) => [s.name.trim().toLowerCase(), s]));

/** The earliest day the reconstruction can reach. */
export const diaryFrom = daybook.from;

/** True for a day the invoices can still describe. */
export const isHistoric = (date: string): boolean => date <= meta.demoDate;

function fromDemoDay(): Appointment[] {
  return demoday.bookings
    .filter((b) => b.stylistId != null)
    .map((b) => ({
      id: `inv-${b.invoiceId}`,
      date: demoday.date,
      start: b.start,
      mins: b.mins,
      clientId: b.clientId,
      clientName: b.clientName,
      stylistId: b.stylistId as number,
      service: b.service,
      dept: b.dept,
      source: "invoiced" as const,
      total: b.total,
    }));
}

/** One invoice becomes one appointment, led by the first service on it. */
function fromDayBook(date: string): Appointment[] {
  const day = daybook.days[date];
  if (!day) return [];

  return day.map((entry) => {
    const lines = entry.L.map((line) => {
      const [descrIndex = 0, , , , stylistId = 0, kind = 0] = line;
      return { descr: daybook.dict[descrIndex] ?? "Item", stylistId, kind };
    });
    const headline = lines.find((l) => l.kind === 0) ?? lines[0];
    const descr = headline?.descr ?? "Salon visit";
    const service = byName.get(descr.trim().toLowerCase());

    return {
      id: `inv-${entry.n}`,
      date,
      start: entry.t,
      mins: durationFor(service),
      clientId: null,
      clientName: entry.c,
      stylistId: headline?.stylistId || entry.s,
      service: descr,
      dept: catalogue.get(descr.trim().toLowerCase())?.dept ?? "Cutting & Styling",
      source: "invoiced" as const,
      total: entry.v,
    };
  });
}

/** Everything in the diary for one day, bookings first. */
export function appointmentsOn(
  date: string,
  booked: readonly BookedAppointment[]
): Appointment[] {
  const mine: Appointment[] = booked
    .filter((b) => b.date === date)
    .map((b) => ({ ...b, source: "booked" as const, clientId: b.clientId ?? null }));

  const history = date === meta.demoDate ? fromDemoDay() : fromDayBook(date);
  return [...mine, ...history];
}
