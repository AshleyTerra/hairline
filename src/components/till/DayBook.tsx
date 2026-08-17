"use client";

import { useMemo, useState } from "react";
import { daybook, demoday, getStaff, meta, staff } from "@/lib/data";
import { docketDate, docketTotal, type Docket } from "@/lib/dockets";
import { shortDate, zar, zar0 } from "@/lib/format";
import { useStore } from "@/lib/store";
import { amendedOrOriginal } from "@/lib/salesBook";
import { VAT_RATE } from "@/lib/till";
import { InvoiceSlip, type InvoiceSlipData } from "./InvoiceSlip";
import type { DayBookEntry, PaymentMethod, TillLine } from "@/lib/types";

interface DayBookProps {
  dockets: Docket[];
  activeNumber: number | null;
  onOpenDocket: (number: number) => void;
  /** Starts a docket; a date means it is being prepared for a future day. */
  onNewDocket: (forDate?: string) => void;
  /** Offered per row when the signed-in user may correct a closed docket. */
  onAmend?: (invoiceId: number) => void;
}

/** Monday-to-Sunday week containing a date. */
function weekOf(iso: string): { from: string; to: string } {
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  const start = new Date(d);
  start.setUTCDate(d.getUTCDate() - dow);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

/** A day-book row, flattened so the demo day and history look the same. */
interface Row {
  n: number;
  d: string;
  t: string;
  c: string;
  s: number;
  v: number;
  i: number;
  lines: TillLine[];
  payments: { method: PaymentMethod; amount: number }[];
}

const asLines = (entry: DayBookEntry, dict: string[]): TillLine[] =>
  entry.L.map((line, i) => {
    const [descrIndex = 0, qty = 1, price = 0, disc = 0, stylistId = 0] = line;
    return {
      key: `h${i}`,
      descr: dict[descrIndex] ?? "Item",
      price,
      qty,
      disc,
      stylistId,
      kind: "service" as const,
    };
  });

/**
 * Who is in today — the dockets still open, then everyone already rung up.
 * A date or range can be chosen, and filtered by client or stylist; any row
 * opens its docket.
 */
export function DayBook({
  dockets,
  activeNumber,
  onOpenDocket,
  onNewDocket,
  onAmend,
}: DayBookProps) {
  const { invoices, amendedSales } = useStore();
  const [from, setFrom] = useState(meta.demoDate);
  const [to, setTo] = useState(meta.demoDate);
  const [ranged, setRanged] = useState(false);
  const [client, setClient] = useState("");
  const [stylistId, setStylistId] = useState<number | "">("");
  const [slip, setSlip] = useState<InvoiceSlipData | null>(null);

  const [span, setSpan] = useState<"day" | "week">("day");

  const week = weekOf(from);
  const start = span === "week" ? week.from : from;
  const end = span === "week" ? week.to : ranged ? to : from;
  const isToday = start <= meta.demoDate && meta.demoDate <= end;
  /** Dockets for whatever day is on screen, so future ones show on their day. */
  const dayDockets = useMemo(
    () => dockets.filter((d) => docketDate(d) >= start && docketDate(d) <= end),
    [dockets, start, end]
  );
  const isFuture = from > meta.demoDate;

  const allRows = useMemo<Row[]>(() => {
    const lo = start <= end ? start : end;
    const hi = start <= end ? end : start;

    const out: Row[] = Object.entries(daybook.days)
      // The demo day comes from demoday.json instead, so this tab always agrees
      // with the takings in the top bar and on the cash-up.
      .filter(([day]) => day >= lo && day <= hi && day !== meta.demoDate)
      .flatMap(([, list]) =>
        list.map((e) => ({
          n: e.n,
          d: e.d,
          t: e.t,
          c: e.c,
          s: e.s,
          v: e.v,
          i: e.i,
          lines: asLines(e, daybook.dict),
          payments: e.p.map((pair) => ({
            method: String(pair[0]) as PaymentMethod,
            amount: Number(pair[1]) || 0,
          })),
        }))
      );

    if (lo <= meta.demoDate && meta.demoDate <= hi) {
      out.push(
        /* The day's own sales, with any correction swapped in. These are the
           dockets on screen, so they have to be correctable too. */
        ...amendedOrOriginal(demoday.invoices, amendedSales).map((inv) => ({
          n: inv.id,
          d: meta.demoDate,
          t: inv.date.slice(11, 16),
          c: inv.clientName,
          s: inv.lines[0]?.stylistId ?? 0,
          v: inv.total,
          i: inv.lines.length,
          lines: inv.lines,
          payments: inv.payments,
          amendable: inv.id,
          amended: inv.wasAmended,
        })),
        ...invoices.map((inv) => ({
          n: inv.id,
          d: meta.demoDate,
          t: new Date(inv.date).toTimeString().slice(0, 5),
          c: inv.clientName,
          s: inv.lines[0]?.stylistId ?? 0,
          v: inv.total,
          i: inv.lines.length,
          lines: inv.lines,
          payments: inv.payments,
          /* Only a sale rung up here can be corrected; the migrated day book is
             a record of what happened, not a working document. */
          amendable: inv.id,
          amended: (inv.amendments?.length ?? 0) > 0,
        }))
      );
    }
    return out.sort((a, b) => (a.d + a.t).localeCompare(b.d + b.t));
  }, [start, end, invoices, amendedSales]);

  /** Stylists who actually appear in the chosen period, for the filter. */
  const stylistsPresent = useMemo(() => {
    const ids = new Set(allRows.map((r) => r.s));
    return staff.filter((s) => ids.has(s.id));
  }, [allRows]);

  const rows = useMemo(() => {
    const needle = client.trim().toLowerCase();
    return allRows.filter(
      (r) =>
        (!needle || r.c.toLowerCase().includes(needle)) &&
        (stylistId === "" || r.s === stylistId)
    );
  }, [allRows, client, stylistId]);

  const takings = rows.reduce((sum, r) => sum + r.v, 0);
  /** Money sitting on unsettled dockets, kept apart from the day's takings. */
  const pending = dayDockets.reduce((sum, d) => sum + docketTotal(d), 0);
  const spanDays = new Set(rows.map((r) => r.d)).size;
  const filtered = rows.length !== allRows.length;

  function shift(days: number) {
    const move = (iso: string) => {
      const d = new Date(`${iso}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString().slice(0, 10);
    };
    setFrom(move(from));
    if (ranged) setTo(move(to));
  }

  /** Opens a finished sale as its docket. */
  function view(row: Row) {
    const subtotal = row.lines.reduce(
      (sum, l) => sum + l.price * l.qty * (1 - l.disc / 100),
      0
    );
    setSlip({
      number: row.n,
      date: `${row.d}T${row.t}:00`,
      clientName: row.c,
      lines: row.lines,
      payments: row.payments,
      tips: [],
      subtotal,
      vat: (subtotal * VAT_RATE) / (1 + VAT_RATE),
      tipTotal: 0,
      dueTotal: subtotal,
    });
  }

  const inputClass =
    "rounded-lg border border-edge-soft bg-white px-2.5 py-1.5 text-[13px] text-ink";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5">
      {/* Dates */}
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
          min={daybook.from}
          onChange={(e) => setFrom(e.target.value)}
          aria-label={ranged ? "From date" : "Date"}
          className={inputClass}
        />

        {/* Day or the whole week containing that date */}
        <span className="flex gap-1">
          {(["day", "week"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setSpan(v)}
              aria-pressed={span === v}
              className={`rounded-full px-3 py-1.5 text-[12.5px] font-semibold capitalize transition-colors ${
                span === v ? "bg-ink text-white" : "bg-white text-taupe-deep hover:bg-chip"
              }`}
            >
              {v}
            </button>
          ))}
        </span>

        {ranged && span === "day" && (
          <>
            <span className="text-[12px] text-faintink">to</span>
            <input
              type="date"
              value={to}
              max={meta.demoDate}
              min={daybook.from}
              onChange={(e) => setTo(e.target.value)}
              aria-label="To date"
              className={inputClass}
            />
          </>
        )}

        <button
          type="button"
          onClick={() => shift(span === "week" ? 7 : 1)}
          aria-label="Next day"
          className="rounded-lg border border-edge-soft bg-white px-2.5 py-1.5 text-[13px] text-taupe-deep hover:border-taupe"
        >
          →
        </button>

        {span === "day" && (
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
        )}

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

        {/* A docket can be started for today, or prepared for a future day */}
        {/*
          Today's "+ New docket" was removed at the salon's request. Preparing a
          docket for a future day stays, because that is a different job — it is
          how tomorrow's booking is set up in advance — and reception opens
          today's dockets from the Clients today strip instead.
        */}
        {isFuture && (
          <button
            type="button"
            onClick={() => onNewDocket(from)}
            className="ml-auto rounded-lg bg-taupe-deep px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-ink"
          >
            + Docket for {shortDate(from)}
          </button>
        )}
      </div>

      {isFuture && (
        <p className="shrink-0 rounded-[10px] bg-chip px-3 py-2 text-[11.5px] text-taupe-deep">
          {shortDate(from)} is in the future. Dockets prepared here wait until that day.
        </p>
      )}

      {/* Filters */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <input
          type="search"
          value={client}
          onChange={(e) => setClient(e.target.value)}
          placeholder="Filter by client…"
          aria-label="Filter by client"
          className={`${inputClass} w-48 placeholder:text-faintink`}
        />

        <select
          value={stylistId}
          onChange={(e) => setStylistId(e.target.value === "" ? "" : Number(e.target.value))}
          aria-label="Filter by stylist"
          className={inputClass}
        >
          <option value="">All stylists</option>
          {stylistsPresent.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        {filtered && (
          <button
            type="button"
            onClick={() => {
              setClient("");
              setStylistId("");
            }}
            className="text-[12px] font-semibold text-taupe hover:text-taupe-deep"
          >
            Clear filters
          </button>
        )}

        <span className="ml-auto text-[12px] text-faintink">
          {rows.length} client{rows.length === 1 ? "" : "s"}
          {filtered ? ` of ${allRows.length}` : ""}
          {/* Say the span whenever more than one day is on screen, week view included */}
          {spanDays > 1 ? ` over ${spanDays} days` : ""} ·{" "}
          <span className="tnum text-ink">{zar0(takings)}</span>
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-[10px] border border-edge-soft bg-white">
        {/* Open dockets first — these still need settling */}
        {dayDockets.length > 0 && (
          <div className="border-b border-edge">
            <p className="flex items-center justify-between bg-warn-soft px-4 py-1.5 text-[10.5px] uppercase tracking-[0.1em] text-warn">
              <span>Awaiting payment · {dockets.length}</span>
              {pending > 0 && <span className="tnum">{zar0(pending)}</span>}
            </p>
            <ul data-open-dockets>
              {dayDockets.map((d) => (
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
                    <span className="w-20 shrink-0 text-right text-[11px] font-semibold text-warn">
                      {d.number === activeNumber
                        ? "on screen"
                        : d.state.lines.length > 0
                          ? "to pay"
                          : "empty"}
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
            {filtered
              ? "No clients match those filters."
              : `Nothing rung up on ${shortDate(start)}${
                  ranged && end !== start ? ` – ${shortDate(end)}` : ""
                }.`}
          </p>
        ) : (
          <ul data-daybook>
            {rows.map((r, i) => (
              <li key={`${r.n}-${i}`} className="border-b border-edge-faint last:border-0">
                <button
                  type="button"
                  onClick={() => view(r)}
                  title={`View docket #${r.n}`}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-canvas"
                >
                  <span className="tnum w-12 shrink-0 text-[11.5px] text-faintink">
                    {spanDays > 1 ? shortDate(r.d) : r.t}
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
                    {"amended" in r && Boolean(r.amended) && (
                      <span className="block text-[10px] text-warn">amended</span>
                    )}
                  </span>
                </button>

                {/* Correcting a closed docket: only a sale rung up here, only
                    for whoever is allowed it, and only behind a password. */}
                {onAmend && "amendable" in r && (
                  <div className="flex justify-end px-4 pb-2">
                    <button
                      type="button"
                      onClick={() => onAmend(r.amendable as number)}
                      className="text-[11px] font-semibold text-taupe transition-colors hover:text-taupe-deep"
                    >
                      Amend #{r.n}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {slip && <InvoiceSlip data={slip} onClose={() => setSlip(null)} />}
    </div>
  );
}
