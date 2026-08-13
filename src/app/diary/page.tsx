"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge, Card, PageHeader } from "@/components/ui";
import { BookingDialog } from "@/components/diary/BookingDialog";
import { CancelDialog } from "@/components/diary/CancelDialog";
import { getStaff, meta, services, staff } from "@/lib/data";
import { longDate, shortDate, zar, zar0 } from "@/lib/format";
import { creditable, roster } from "@/lib/roster";
import { closeDocket, openDocket } from "@/lib/dockets";
import { demoNow } from "@/lib/clock";
import { emptyTill } from "@/lib/till";
import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  SLOT_MINUTES,
  book,
  cancellationLine,
  countByStylist,
  endTime,
  firstFreeSlot,
  place,
  slotAt,
  suggestedFee,
  toMinutes,
  type Appointment,
  type BookingDraft,
} from "@/lib/diary";
import { appointmentsOn, diaryFrom } from "@/lib/diarySource";
import { useStore } from "@/lib/store";

const PX_PER_MIN = 1.15;

/** Department colours, drawn from the brand's warm range plus the validated accent. */
const DEPT_COLOUR: Record<string, string> = {
  Colour: "#c08428",
  "Cutting & Styling": "#8a7f6f",
  Treatments: "#0a86a8",
  "Brazilian & Keratin": "#5d5449",
  Extensions: "#a0433a",
  Perms: "#4c7a5a",
  "Mycro Keratin": "#8c6f9c",
  "Wella Straightening": "#b3a898",
};

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export default function DiaryPage() {
  const router = useRouter();
  const {
    appointments,
    addAppointment,
    cancelAppointment,
    updateAppointment,
    staffRecords,
    dockets,
    setDockets,
  } = useStore();

  const [date, setDate] = useState(meta.demoDate);
  const [only, setOnly] = useState<number | "">("");
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [cancelling, setCancelling] = useState<Appointment | null>(null);
  const [booking, setBooking] = useState<{ start: string; stylistId: number } | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const team = useMemo(() => creditable(roster(staffRecords, staff)), [staffRecords]);
  const day = useMemo(() => appointmentsOn(date, appointments), [date, appointments]);

  /**
   * A column per stylist on the books, plus anyone else the day already has
   * appointments for — an operator's reconstructed work still has to show.
   */
  const columns = useMemo(() => {
    const withWork = new Set(day.map((a) => a.stylistId));
    const shown = team.filter((m) => !m.support || withWork.has(m.id));
    const extras = [...withWork]
      .filter((id) => !shown.some((m) => m.id === id))
      .map((id) => ({
        id,
        name: getStaff(id)?.name ?? `Staff ${id}`,
        designation: "No longer on the books",
        support: true,
      }));
    const all = [...shown, ...extras];
    return only === "" ? all : all.filter((m) => m.id === only);
  }, [team, day, only]);

  const counts = countByStylist(day);
  const hours = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => DAY_START_HOUR + i);
  const columnHeight = (DAY_END_HOUR - DAY_START_HOUR) * 60 * PX_PER_MIN;
  const isDemoDay = date === meta.demoDate;
  const isFuture = date > meta.demoDate;
  const bookedCount = day.filter((a) => a.source === "booked").length;

  /** A click in a column lands on the quarter hour it fell in. */
  function clickColumn(event: React.MouseEvent<HTMLDivElement>, stylistId: number) {
    const box = event.currentTarget.getBoundingClientRect();
    const start = slotAt((event.clientY - box.top) / PX_PER_MIN);
    setBookingError(null);
    setBooking({ start, stylistId });
  }

  function saveBooking(draft: BookingDraft) {
    const result = book(day, draft, `bk-${draft.date}-${draft.start}-${draft.stylistId}`);
    if (!result.ok) {
      setBookingError(result.error);
      return;
    }
    addAppointment(result.booking);
    setBooking(null);
    setBookingError(null);
    setNote(
      `${result.booking.clientName} booked with ${getStaff(result.booking.stylistId)?.name ?? "the salon"} at ${result.booking.start}.`
    );
  }

  /**
   * Opens a docket for the appointment, with the booked service already on it, so
   * reception only has to take the money. The docket number goes back onto the
   * booking, which is how cancelling later knows what to close.
   */
  function takeToTill(appointment: Appointment) {
    const priced = services.find(
      (s) => s.name.trim().toLowerCase() === appointment.service.trim().toLowerCase()
    );
    const state = {
      ...emptyTill(),
      clientId: appointment.clientId,
      clientName: appointment.clientName,
      lines: priced
        ? [
            {
              key: `booked-${appointment.id}`,
              descr: priced.name,
              price: priced.price,
              qty: 1,
              disc: 0,
              stylistId: appointment.stylistId,
              kind: "service" as const,
              mins: priced.mins,
            },
          ]
        : [],
    };
    const { docket, dockets: next } = openDocket(
      dockets,
      state,
      meta.lastInvoiceNumber,
      demoNow(),
      appointment.date
    );
    setDockets(next);
    if (appointment.source === "booked") {
      updateAppointment(appointment.id, { docketNumber: docket.number });
    }
    setSelected(null);
    /* The number goes with them, so the till opens their docket, not a blank one. */
    router.push(`/till?docket=${docket.number}`);
  }

  /**
   * Cancelling. The docket the booking opened goes with it — a client who never
   * came must not leave a sale sitting at the counter — and a late cancellation
   * can carry a charge, which lands on its own docket awaiting payment.
   */
  function confirmCancel(appointment: Appointment, fee: number) {
    const booked = appointments.find((a) => a.id === appointment.id);
    let next = dockets;

    /*
     * The fee takes its number before the cancelled docket gives one up, so the
     * two never share a number — a docket number becomes an invoice number.
     */
    if (fee > 0) {
      const state = {
        ...emptyTill(),
        clientId: appointment.clientId,
        clientName: appointment.clientName,
        lines: [
          cancellationLine(
            { service: appointment.service, stylistId: appointment.stylistId },
            fee,
            `cancel-${appointment.id}`
          ),
        ],
      };
      next = openDocket(next, state, meta.lastInvoiceNumber, demoNow(), appointment.date).dockets;
    }
    if (booked?.docketNumber != null) next = closeDocket(next, booked.docketNumber);

    setDockets(next);
    cancelAppointment(appointment.id);
    setCancelling(null);
    setSelected(null);
    setNote(
      fee > 0
        ? `${appointment.clientName}'s ${appointment.start} booking cancelled — ${zar0(fee)} fee awaiting payment under Clients today.`
        : `${appointment.clientName}'s ${appointment.start} booking cancelled, no charge.${
            booked?.docketNumber != null ? " Their docket was closed too." : ""
          }`
    );
  }

  const field = "rounded border border-hairline bg-card px-2 py-1 text-xs text-ink";

  return (
    <>
      <PageHeader
        eyebrow="Appointments"
        title="Diary"
        subtitle={
          isDemoDay
            ? `${longDate(date)} · ${day.length} appointments, the day's own invoices plus anything booked here`
            : `${longDate(date)} · ${day.length} appointment${day.length === 1 ? "" : "s"}${
                isFuture ? " booked" : ", reconstructed from the day's invoices"
              }`
        }
        actions={
          <span className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setDate(addDays(date, -1))}
              aria-label="Previous day"
              className={`${field} hover:border-taupe`}
            >
              ←
            </button>
            <input
              type="date"
              value={date}
              min={diaryFrom}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              aria-label="Date"
              className={field}
            />
            <button
              type="button"
              onClick={() => setDate(addDays(date, 1))}
              aria-label="Next day"
              className={`${field} hover:border-taupe`}
            >
              →
            </button>
            {!isDemoDay && (
              <button
                type="button"
                onClick={() => setDate(meta.demoDate)}
                className="text-xs font-semibold text-taupe hover:text-taupe-deep"
              >
                Today
              </button>
            )}
            <select
              value={only}
              onChange={(e) => setOnly(e.target.value === "" ? "" : Number(e.target.value))}
              aria-label="Stylist"
              className={`${field} ml-1`}
            >
              <option value="">All stylists</option>
              {team.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                const who = only === "" ? (columns[0]?.id ?? team[0]?.id) : only;
                if (who == null) return;
                setBookingError(null);
                setBooking({ start: firstFreeSlot(day, date, who, 30), stylistId: who });
              }}
              className="rounded bg-taupe-deep px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink"
            >
              + New booking
            </button>
          </span>
        }
      />

      {note && (
        <p role="status" className="mb-3 rounded bg-good-soft px-3 py-2 text-xs text-good">
          {note}{" "}
          <button
            type="button"
            onClick={() => setNote(null)}
            className="font-semibold underline underline-offset-2"
          >
            Dismiss
          </button>
        </p>
      )}

      <p className="mb-3 flex flex-wrap items-center gap-2 text-xs text-mutedink">
        <span>Click any free time to book it.</span>
        {bookedCount > 0 && <Badge tone="good">{bookedCount} booked here</Badge>}
        {isFuture && <Badge tone="neutral">Ahead of the demo day — nothing invoiced yet</Badge>}
        <span className="ml-auto">Walk-ins never need a booking</span>
      </p>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <div className="flex min-w-max">
            {/* Hour gutter */}
            <div className="w-14 shrink-0 border-r border-hairline-soft bg-paper">
              <div className="h-10 border-b border-hairline-soft" />
              <div className="relative" style={{ height: columnHeight }}>
                {hours.map((h) => (
                  <div
                    key={h}
                    className="tnum absolute right-2 -translate-y-1/2 text-[11px] text-mutedink"
                    style={{ top: (h - DAY_START_HOUR) * 60 * PX_PER_MIN }}
                  >
                    {String(h).padStart(2, "0")}:00
                  </div>
                ))}
              </div>
            </div>

            {columns.length === 0 ? (
              <p className="px-6 py-10 text-sm text-mutedink">
                Nobody on the books to show. Add staff under Admin.
              </p>
            ) : (
              columns.map((m) => {
                const mine = day.filter((a) => a.stylistId === m.id);
                return (
                  <div
                    key={m.id}
                    className={`shrink-0 border-r border-hairline-soft last:border-0 ${
                      only === "" ? "w-56" : "w-[28rem]"
                    }`}
                  >
                    <div className="flex h-10 items-center justify-between gap-1 border-b border-hairline-soft px-2">
                      <span className="truncate text-xs font-semibold text-ink">{m.name}</span>
                      <span className="tnum shrink-0 text-[11px] text-mutedink">
                        {counts.get(m.id) ?? 0}
                      </span>
                    </div>

                    <div
                      className="relative cursor-copy bg-card"
                      style={{ height: columnHeight }}
                      onClick={(e) => clickColumn(e, m.id)}
                      title={`Click to book with ${m.name}`}
                    >
                      {/* Quarter-hour lines, with the hour picked out */}
                      {Array.from(
                        { length: ((DAY_END_HOUR - DAY_START_HOUR) * 60) / SLOT_MINUTES + 1 },
                        (_, i) => i * SLOT_MINUTES
                      ).map((offset) => (
                        <div
                          key={offset}
                          className={`absolute inset-x-0 border-t ${
                            offset % 60 === 0 ? "border-hairline-soft" : "border-hairline-soft/40"
                          }`}
                          style={{ top: offset * PX_PER_MIN }}
                        />
                      ))}

                      {place(mine).map(({ appointment: a, lane, lanes }) => {
                        const top = (toMinutes(a.start) - DAY_START_HOUR * 60) * PX_PER_MIN;
                        const height = Math.max(24, a.mins * PX_PER_MIN);
                        const colour = DEPT_COLOUR[a.dept] ?? "#8a7f6f";
                        const laneWidth = 100 / lanes;
                        const isBooked = a.source === "booked";
                        return (
                          <button
                            key={a.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelected(a);
                            }}
                            title={`${a.start} ${a.clientName} — ${a.service}`}
                            className={`absolute overflow-hidden rounded px-1.5 py-1 text-left transition-opacity hover:opacity-90 ${
                              isBooked
                                ? "border-2 border-dashed bg-card text-ink"
                                : "text-white ring-1 ring-white"
                            }`}
                            style={{
                              top,
                              height,
                              left: `calc(${lane * laneWidth}% + 2px)`,
                              width: `calc(${laneWidth}% - 4px)`,
                              background: isBooked ? undefined : colour,
                              borderColor: isBooked ? colour : undefined,
                            }}
                          >
                            <span className="block truncate text-[11px] font-semibold leading-tight">
                              {lanes >= 3 ? a.clientName.split(" ")[0] : a.clientName}
                            </span>
                            {height > 34 && lanes <= 2 && (
                              <span className="block truncate text-[10px] leading-tight opacity-90">
                                {isBooked ? `${a.start} · ${a.service}` : a.service}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Card>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
        {[...new Set(day.map((a) => a.dept))].map((dept) => (
          <span key={dept} className="flex items-center gap-1.5 text-body">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: DEPT_COLOUR[dept] ?? "#8a7f6f" }}
              aria-hidden="true"
            />
            {dept}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-body">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm border-2 border-dashed border-taupe"
            aria-hidden="true"
          />
          Booked here
        </span>
      </div>

      <p className="mt-4 max-w-2xl text-xs text-mutedink">
        Past days are rebuilt from the invoices, because MySalon&apos;s diary went unused for eleven
        years — the till is the only record of who was in the chair. From here on the diary is the
        salon&apos;s own: book a client, and reception can open their docket the moment they arrive.
        Invoicing never requires a booking.
      </p>

      {booking && (
        <BookingDialog
          date={date}
          dateLabel={longDate(date)}
          start={booking.start}
          stylistId={booking.stylistId}
          team={team}
          error={bookingError}
          onSave={saveBooking}
          onClose={() => {
            setBooking(null);
            setBookingError(null);
          }}
        />
      )}

      {cancelling && (
        <CancelDialog
          appointment={cancelling}
          suggested={suggestedFee(
            services.find(
              (s) => s.name.trim().toLowerCase() === cancelling.service.trim().toLowerCase()
            )?.price
          )}
          hasDocket={
            appointments.find((a) => a.id === cancelling.id)?.docketNumber != null
          }
          onConfirm={(fee) => confirmCancel(cancelling, fee)}
          onClose={() => setCancelling(null)}
        />
      )}

      {selected && !cancelling && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Appointment details"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-sm rounded border border-hairline bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[11px] uppercase tracking-[0.12em] text-mutedink">
              {selected.start}–{endTime(selected.start, selected.mins)} · {selected.mins} min ·{" "}
              {shortDate(selected.date)}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-ink">{selected.clientName}</h2>
            <p className="mt-0.5 text-sm text-body">{selected.service}</p>

            <dl className="mt-4 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-mutedink">Stylist</dt>
                <dd className="text-ink">
                  {staffRecords.find((r) => r.id === selected.stylistId)?.name ??
                    getStaff(selected.stylistId)?.name ??
                    "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-mutedink">Department</dt>
                <dd className="text-ink">{selected.dept}</dd>
              </div>
              {selected.source === "invoiced" ? (
                <div className="flex justify-between">
                  <dt className="text-mutedink">Invoiced</dt>
                  <dd className="tnum font-semibold text-ink">{zar(selected.total ?? 0)}</dd>
                </div>
              ) : (
                <div className="flex justify-between">
                  <dt className="text-mutedink">Status</dt>
                  <dd className="text-ink">Booked, not yet rung up</dd>
                </div>
              )}
            </dl>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              {selected.clientId != null && selected.clientId > 0 ? (
                <Link
                  href={`/clients/${selected.clientId}`}
                  className="rounded border border-taupe px-3 py-2 text-xs font-semibold text-taupe-deep hover:bg-chip"
                >
                  Open client file
                </Link>
              ) : (
                <span className="text-xs text-mutedink">Not on file</span>
              )}

              <span className="flex gap-2">
                {selected.source === "booked" && (
                  <>
                    <button
                      type="button"
                      onClick={() => setCancelling(selected)}
                      className="rounded border border-hairline px-3 py-2 text-xs font-semibold text-mutedink hover:text-crit"
                    >
                      Cancel booking
                    </button>
                    <button
                      type="button"
                      onClick={() => takeToTill(selected)}
                      className="rounded bg-taupe-deep px-3 py-2 text-xs font-semibold text-white hover:bg-ink"
                    >
                      Arrived — open docket
                    </button>
                  </>
                )}
                {selected.source === "invoiced" && (
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="rounded bg-taupe-deep px-3 py-2 text-xs font-semibold text-white"
                  >
                    Close
                  </button>
                )}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
