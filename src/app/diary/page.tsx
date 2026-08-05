"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, PageHeader } from "@/components/ui";
import { demoday, diaryStaff, getStaff } from "@/lib/data";
import { longDate, zar } from "@/lib/format";
import type { Booking } from "@/lib/types";

const START_HOUR = 7;
const END_HOUR = 19;
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

function minutesFrom(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m - START_HOUR * 60;
}

interface PlacedBooking {
  booking: Booking;
  lane: number;
  lanes: number;
}

/**
 * Appointments reconstructed from invoice times often overlap. Give each
 * overlapping cluster its own set of lanes so nothing is hidden behind
 * anything else.
 */
function placeBookings(bookings: Booking[]): PlacedBooking[] {
  const sorted = [...bookings].sort((a, b) => a.start.localeCompare(b.start));
  const placed: PlacedBooking[] = [];
  let cluster: { booking: Booking; lane: number; end: number }[] = [];
  let clusterEnd = -1;

  const flush = () => {
    const lanes = cluster.reduce((max, c) => Math.max(max, c.lane + 1), 1);
    for (const c of cluster) placed.push({ booking: c.booking, lane: c.lane, lanes });
    cluster = [];
    clusterEnd = -1;
  };

  for (const booking of sorted) {
    const start = minutesFrom(booking.start);
    const end = start + booking.mins;

    if (cluster.length > 0 && start >= clusterEnd) flush();

    // Reuse the first lane whose previous appointment has already finished.
    const used = new Set(cluster.filter((c) => c.end > start).map((c) => c.lane));
    let lane = 0;
    while (used.has(lane)) lane += 1;

    cluster.push({ booking, lane, end });
    clusterEnd = Math.max(clusterEnd, end);
  }
  flush();

  return placed;
}

export default function DiaryPage() {
  const [selected, setSelected] = useState<Booking | null>(null);

  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
  const columnHeight = (END_HOUR - START_HOUR) * 60 * PX_PER_MIN;

  const staffWithBookings = diaryStaff.filter((s) =>
    demoday.bookings.some((b) => b.stylistId === s.id)
  );

  return (
    <>
      <PageHeader
        eyebrow="Appointments"
        title="Diary"
        subtitle={`${longDate(demoday.date)} · ${demoday.bookings.length} appointments, reconstructed from the day's real invoices`}
        actions={
          <span className="rounded-full bg-chip px-3 py-1 text-xs text-taupe-deep">
            Walk-ins never need a booking
          </span>
        }
      />

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
                    style={{ top: (h - START_HOUR) * 60 * PX_PER_MIN }}
                  >
                    {String(h).padStart(2, "0")}:00
                  </div>
                ))}
              </div>
            </div>

            {staffWithBookings.map((s) => {
              const bookings = demoday.bookings.filter((b) => b.stylistId === s.id);
              return (
                <div key={s.id} className="w-56 shrink-0 border-r border-hairline-soft last:border-0">
                  <div className="flex h-10 items-center justify-between gap-1 border-b border-hairline-soft px-2">
                    <span className="truncate text-xs font-semibold text-ink">{s.name}</span>
                    <span className="tnum shrink-0 text-[11px] text-mutedink">
                      {bookings.length}
                    </span>
                  </div>

                  <div className="relative bg-card" style={{ height: columnHeight }}>
                    {hours.map((h) => (
                      <div
                        key={h}
                        className="absolute inset-x-0 border-t border-hairline-soft"
                        style={{ top: (h - START_HOUR) * 60 * PX_PER_MIN }}
                      />
                    ))}

                    {placeBookings(bookings).map(({ booking: b, lane, lanes }) => {
                      const top = minutesFrom(b.start) * PX_PER_MIN;
                      const height = Math.max(24, b.mins * PX_PER_MIN);
                      const colour = DEPT_COLOUR[b.dept] ?? "#8a7f6f";
                      const laneWidth = 100 / lanes;
                      return (
                        <button
                          key={b.invoiceId}
                          type="button"
                          onClick={() => setSelected(b)}
                          title={`${b.start} ${b.clientName} — ${b.service}`}
                          className="absolute overflow-hidden rounded px-1.5 py-1 text-left text-white ring-1 ring-white transition-opacity hover:opacity-90"
                          style={{
                            top,
                            height,
                            left: `calc(${lane * laneWidth}% + 2px)`,
                            width: `calc(${laneWidth}% - 4px)`,
                            background: colour,
                          }}
                        >
                          <span className="block truncate text-[11px] font-semibold leading-tight">
                            {lanes >= 3 ? b.clientName.split(" ")[0] : b.clientName}
                          </span>
                          {height > 36 && lanes === 1 && (
                            <span className="block truncate text-[10px] leading-tight opacity-90">
                              {b.service}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        {[...new Set(demoday.bookings.map((b) => b.dept))].map((dept) => (
          <span key={dept} className="flex items-center gap-1.5 text-body">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: DEPT_COLOUR[dept] ?? "#8a7f6f" }}
              aria-hidden="true"
            />
            {dept}
          </span>
        ))}
      </div>

      <p className="mt-4 max-w-2xl text-xs text-mutedink">
        The diary in MySalon was barely used in eleven years, so this view is deliberately light. It
        exists so the team can try it without being forced onto it — invoicing never requires a
        booking. If the salon takes to it, client self-booking is the natural next step.
      </p>

      {selected && (
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
              {selected.start}–{selected.end} · {selected.mins} min
            </p>
            <h2 className="mt-1 text-lg font-semibold text-ink">{selected.clientName}</h2>
            <p className="mt-0.5 text-sm text-body">{selected.service}</p>
            <dl className="mt-4 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-mutedink">Stylist</dt>
                <dd className="text-ink">{getStaff(selected.stylistId)?.name ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-mutedink">Department</dt>
                <dd className="text-ink">{selected.dept}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-mutedink">Invoiced</dt>
                <dd className="tnum font-semibold text-ink">{zar(selected.total)}</dd>
              </div>
            </dl>
            <div className="mt-4 flex justify-between gap-2">
              <Link
                href={`/clients/${selected.clientId}`}
                className="rounded border border-taupe px-3 py-2 text-xs font-semibold text-taupe-deep hover:bg-chip"
              >
                Open client file
              </Link>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded bg-taupe-deep px-3 py-2 text-xs font-semibold text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
