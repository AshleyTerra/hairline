"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui";
import { analytics, meta } from "@/lib/data";
import { longDate, monthLabel, pct, shortDate, zar0 } from "@/lib/format";
import { periodStats, reportsFrom, yearsFrom } from "@/lib/salesSource";
import { useStore } from "@/lib/store";

type Grain = "day" | "week" | "month" | "year" | "range";

const GRAINS: { key: Grain; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
  { key: "range", label: "Range" },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (isoDate: string, days: number) => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
};
const addMonths = (ym: string, months: number) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + months, 1));
  return d.toISOString().slice(0, 7);
};
const monthEnd = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return iso(new Date(Date.UTC(y, m, 0)));
};
/** Monday-to-Sunday week containing a date. */
const weekOf = (isoDate: string) => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const start = addDays(isoDate, -((d.getUTCDay() + 6) % 7));
  return { from: start, to: addDays(start, 6) };
};

const YEARS = analytics.revenueByYear.map((y) => y.year).filter((y) => y >= yearsFrom);

/**
 * The headline strip. It defaults to the trading day, and can be pointed at any
 * day, week, month, year or custom range.
 */
export function DashboardPeriod({ playCount }: { playCount: number }) {
  const { invoices } = useStore();
  const [grain, setGrain] = useState<Grain>("day");
  const [day, setDay] = useState(meta.demoDate);
  const [month, setMonth] = useState(meta.demoDate.slice(0, 7));
  const [year, setYear] = useState(Number(meta.demoDate.slice(0, 4)));
  const [rangeFrom, setRangeFrom] = useState(meta.demoDate);
  const [rangeTo, setRangeTo] = useState(meta.demoDate);

  /** The window each grain resolves to. */
  const { from, to, label } = useMemo(() => {
    switch (grain) {
      case "week": {
        const w = weekOf(day);
        return {
          from: w.from,
          to: w.to,
          label: `${shortDate(w.from)} – ${shortDate(w.to)}`,
        };
      }
      case "month":
        return { from: `${month}-01`, to: monthEnd(month), label: monthLabel(month) };
      case "year":
        return { from: `${year}-01-01`, to: `${year}-12-31`, label: String(year) };
      case "range":
        return {
          from: rangeFrom,
          to: rangeTo,
          label:
            rangeFrom === rangeTo
              ? longDate(rangeFrom)
              : `${shortDate(rangeFrom)} – ${shortDate(rangeTo)}`,
        };
      default:
        return {
          from: day,
          to: day,
          label: day === meta.demoDate ? "Today" : longDate(day),
        };
    }
  }, [grain, day, month, year, rangeFrom, rangeTo]);

  const isToday = grain === "day" && day === meta.demoDate;
  const stats = useMemo(() => periodStats(from, to, invoices), [from, to, invoices]);
  const multiDay = from !== to;

  function step(direction: 1 | -1) {
    if (grain === "month") return setMonth(addMonths(month, direction));
    if (grain === "year") return setYear((y) => y + direction);
    if (grain === "week") return setDay(addDays(day, 7 * direction));
    if (grain === "range") {
      setRangeFrom(addDays(rangeFrom, direction));
      setRangeTo(addDays(rangeTo, direction));
      return;
    }
    setDay(addDays(day, direction));
  }

  const atLatest =
    grain === "year"
      ? year >= Number(meta.demoDate.slice(0, 4))
      : grain === "month"
        ? month >= meta.demoDate.slice(0, 7)
        : to >= meta.demoDate;

  const field = "rounded border border-hairline bg-card px-2 py-1 text-xs text-ink";

  return (
    <section className="mb-8">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-ink">{label}</h2>
        {isToday && playCount > 0 && <Badge tone="good">includes {playCount} rung up here</Badge>}
        {multiDay && stats.days > 1 && (
          <span className="text-xs text-mutedink">
            {stats.days} {stats.source === "years" ? "years" : stats.source === "months" ? "months" : "trading days"}
          </span>
        )}

        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          {/* Granularity */}
          <span className="mr-1 flex gap-0.5">
            {GRAINS.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => setGrain(g.key)}
                aria-pressed={grain === g.key}
                className={`rounded px-2 py-1 text-xs font-semibold transition-colors ${
                  grain === g.key
                    ? "bg-ink text-white"
                    : "bg-chip text-taupe-deep hover:bg-hairline"
                }`}
              >
                {g.label}
              </button>
            ))}
          </span>

          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Previous period"
            className={`${field} hover:border-taupe`}
          >
            ←
          </button>

          {(grain === "day" || grain === "week") && (
            <input
              type="date"
              value={day}
              min={reportsFrom}
              max={meta.demoDate}
              onChange={(e) => setDay(e.target.value)}
              aria-label="Date"
              className={field}
            />
          )}

          {grain === "month" && (
            <input
              type="month"
              value={month}
              max={meta.demoDate.slice(0, 7)}
              onChange={(e) => setMonth(e.target.value)}
              aria-label="Month"
              className={field}
            />
          )}

          {grain === "year" && (
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              aria-label="Year"
              className={field}
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          )}

          {grain === "range" && (
            <>
              <input
                type="date"
                value={rangeFrom}
                min={reportsFrom}
                max={meta.demoDate}
                onChange={(e) => setRangeFrom(e.target.value)}
                aria-label="From date"
                className={field}
              />
              <span className="text-xs text-mutedink">to</span>
              <input
                type="date"
                value={rangeTo}
                min={reportsFrom}
                max={meta.demoDate}
                onChange={(e) => setRangeTo(e.target.value)}
                aria-label="To date"
                className={field}
              />
            </>
          )}

          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Next period"
            disabled={atLatest}
            className={`${field} hover:border-taupe disabled:opacity-40`}
          >
            →
          </button>

          {!isToday && (
            <button
              type="button"
              onClick={() => {
                setGrain("day");
                setDay(meta.demoDate);
              }}
              className="text-xs font-semibold text-taupe hover:text-taupe-deep"
            >
              Back to today
            </button>
          )}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={isToday ? "Taken so far" : "Taken"}
          value={zar0(stats.total)}
          hint={`${stats.count.toLocaleString("en-ZA")} sales`}
        />
        <StatTile
          label="Average ticket"
          value={zar0(stats.count > 0 ? stats.total / stats.count : 0)}
          hint={isToday ? "Per client today" : "Per client in this period"}
        />
        <StatTile
          label="Paid by card"
          value={pct(stats.cardShare, 0)}
          hint={
            stats.source === "daybook"
              ? `${pct(stats.cashShare, 0)} of takings are cash`
              : "Salon average — this period predates the payment detail"
          }
        />
        {isToday ? (
          <StatTile label="Cash-up" value="Open" hint="Not yet locked for the day" tone="warn" />
        ) : (
          <StatTile
            label={multiDay ? "Average per day" : "Cash-up"}
            value={
              multiDay
                ? zar0(stats.total / Math.max(1, stats.days))
                : "Locked"
            }
            hint={
              multiDay
                ? stats.source === "years"
                  ? "Per year in this period"
                  : stats.source === "months"
                    ? "Per month in this period"
                    : "Per trading day"
                : "Day closed"
            }
          />
        )}
      </div>
    </section>
  );
}

/** Local copy of the tile used by the dashboard, kept alongside its only user. */
function StatTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "warn";
}) {
  return (
    <div className="rounded border border-hairline bg-card px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-mutedink">{label}</p>
      <p className={`tnum text-2xl font-light ${tone === "warn" ? "text-warn" : "text-ink"}`}>
        {value}
      </p>
      <p className="text-xs text-mutedink">{hint}</p>
    </div>
  );
}
