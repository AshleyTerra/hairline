"use client";

import { useMemo, useState } from "react";
import { daybook, demoday, getStaff, meta } from "@/lib/data";
import { docketTotal, type Docket } from "@/lib/dockets";
import { shortDate, zar, zar0 } from "@/lib/format";
import { useStore } from "@/lib/store";

interface DayBookProps {
  dockets: Docket[];
  activeNumber: number | null;
  onOpenDocket: (number: number) => void;
  onNewDocket: () => void;
}

/**
 * Who is in today — the dockets still open, then everyone already rung up.
 * A date or a date range can be chosen, so reception is not stuck on today.
 */
export function DayBook({ dockets, activeNumber, onOpenDocket, onNewDocket }: DayBookProps) {
  const { invoices } = useStore();
  const [from, setFrom] = useState(meta.demoDate);
  const [to, setTo] = useState(meta.demoDate);
  const [ranged, setRanged] = useState(false);

  const start = from;
  const end = ranged ? to : from;
  const isToday = start === meta.demoDate && end === meta.demoDate;

  const rows = useMemo(() => {
    const lo = start <= end ? start : end;
    const hi = start <= end ? end : start;
    const out = Object.entries(daybook.days)
      // The demo day comes from demoday.json instead, so this tab always agrees
      // with the takings in the top bar and on the cash-up.
      .filter(([day]) => day >= lo && day <= hi && day !== meta.demoDate)
      .flatMap(([, list]) => list);

    if (lo <= meta.demoDate && meta.demoDate <= hi) {
      out.push(
        ...demoday.invoices.map((inv) => ({
          n: inv.id,
          d: meta.demoDate,
          t: inv.date.slice(11, 16),
          c: inv.clientName,
          s: inv.lines[0]?.stylistId ?? 0,
          v: inv.total,
          i: inv.lines.length,
        }))
      );
      out.push(
        ...invoices.map((inv) => ({
          n: inv.id,
          d: meta.demoDate,
          t: new Date(inv.date).toTimeString().slice(0, 5),
          c: inv.clientName,
          s: inv.lines[0]?.stylistId ?? 0,
          v: inv.total,
          i: inv.lines.length,
          fresh: true as const,
        }))
      );
    }
    return out.sort((a, b) => (a.d + a.t).localeCompare(b.d + b.t));
  }, [start, end, invoices]);

  const takings = rows.reduce((sum, r) => sum + r.v, 0);
  const spanDays = new Set(rows.map((r) => r.d)).size;

  function shift(days: number) {
    const move = (iso: string) => {
      const d = new Date(`${iso}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString().slice(0, 10);
    };
    setFrom(move(from));
    if (ranged) setTo(move(to));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Date controls */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => shift(-1)}
          aria-label="Previous day"
          className="rounded-lg border border-edge-soft bg-white px-2.5 py-1.5 text-[13px] text-taupe-deep hover:border-taupe"
        >
          ←
        </button>

        <input
          type="date"
          value={from}
          max={meta.demoDate}
          min={daybook.from}
          onChange={(e) => setFrom(e.target.value)}
          aria-label={ranged ? "From date" : "Date"}
          className="rounded-lg border border-edge-soft bg-white px-2.5 py-1.5 text-[13px] text-ink"
        />

        {ranged && (
          <>
            <span className="text-[12px] text-faintink">to</span>
            <input
              type="date"
              value={to}
              max={meta.demoDate}
              min={daybook.from}
              onChange={(e) => setTo(e.target.value)}
              aria-label="To date"
              className="rounded-lg border border-edge-soft bg-white px-2.5 py-1.5 text-[13px] text-ink"
            />
          </>
        )}

        <button
          type="button"
          onClick={() => shift(1)}
          aria-label="Next day"
          disabled={end >= meta.demoDate}
          className="rounded-lg border border-edge-soft bg-white px-2.5 py-1.5 text-[13px] text-taupe-deep hover:border-taupe disabled:opacity-40"
        >
          →
        </button>

        <button
          type="button"
          onClick={() => setRanged((r) => !r)}
          aria-pressed={ranged}
          className={`rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
            ranged ? "bg-ink text-white" : "bg-white text-taupe-deep hover:bg-chip"
          }`}
        >
          Date range
        </button>

        {!isToday && (
          <button
            type="button"
            onClick={() => {
              setFrom(meta.demoDate);
              setTo(meta.demoDate);
            }}
            className="text-[12px] font-semibold text-taupe hover:text-taupe-deep"
          >
            Back to today
          </button>
        )}

        <span className="ml-auto flex items-center gap-3">
          <span className="text-[12px] text-faintink">
            {rows.length} client{rows.length === 1 ? "" : "s"}
            {ranged && spanDays > 1 ? ` over ${spanDays} days` : ""} ·{" "}
            <span className="tnum text-ink">{zar0(takings)}</span>
          </span>
          {isToday && (
            <button
              type="button"
              onClick={onNewDocket}
              className="rounded-lg bg-taupe-deep px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-ink"
            >
              + New docket
            </button>
          )}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-[10px] border border-edge-soft bg-white">
        {/* Open dockets first — these still need settling */}
        {isToday && dockets.length > 0 && (
          <div className="border-b border-edge">
            <p className="bg-warn-soft px-4 py-1.5 text-[10.5px] uppercase tracking-[0.1em] text-warn">
              Still open · {dockets.length}
            </p>
            <ul data-open-dockets>
              {dockets.map((d) => (
                <li key={d.number} className="border-b border-edge-faint last:border-0">
                  <button
                    type="button"
                    onClick={() => onOpenDocket(d.number)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-canvas ${
                      d.number === activeNumber ? "bg-chip" : ""
                    }`}
                  >
                    <span className="tnum w-12 shrink-0 text-[11.5px] text-faintink">
                      #{d.number}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">
                      {d.state.clientName ?? "Walk-in"}
                    </span>
                    <span className="shrink-0 text-[11.5px] text-faintink">
                      {d.state.lines.length} item{d.state.lines.length === 1 ? "" : "s"}
                    </span>
                    <span className="tnum w-20 shrink-0 text-right text-[13.5px] font-semibold text-ink">
                      {docketTotal(d) > 0 ? zar(docketTotal(d)) : "—"}
                    </span>
                    <span className="w-16 shrink-0 text-right text-[11px] font-semibold text-warn">
                      {d.number === activeNumber ? "on screen" : "open"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Already paid */}
        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13.5px] text-faintink">
            Nothing rung up on {shortDate(start)}
            {ranged && end !== start ? ` – ${shortDate(end)}` : ""}.
          </p>
        ) : (
          <ul data-daybook>
            {rows.map((r, i) => (
              <li
                key={`${r.n}-${i}`}
                className="flex items-center gap-3 border-b border-edge-faint px-4 py-2.5 last:border-0"
              >
                <span className="tnum w-12 shrink-0 text-[11.5px] text-faintink">
                  {ranged && spanDays > 1 ? shortDate(r.d) : r.t}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">{r.c}</span>
                <span className="hidden shrink-0 text-[11.5px] text-faintink sm:block">
                  {getStaff(r.s)?.name ?? "—"}
                </span>
                <span className="shrink-0 text-[11.5px] text-faintink">
                  {r.i} item{r.i === 1 ? "" : "s"}
                </span>
                <span className="tnum w-20 shrink-0 text-right text-[13.5px] font-semibold text-ink">
                  {zar(r.v)}
                </span>
                <span className="tnum w-16 shrink-0 text-right text-[11px] text-faintink">
                  #{r.n}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
