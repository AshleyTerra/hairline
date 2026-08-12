"use client";

import { useMemo, useState } from "react";
import { analytics, meta } from "@/lib/data";
import { longDate, monthLabel, shortDate } from "@/lib/format";
import { reportsFrom, yearsFrom } from "@/lib/salesSource";

export type Grain = "day" | "week" | "month" | "year" | "range" | "twelve";

export interface Period {
  from: string;
  to: string;
  label: string;
  grain: Grain;
  /** True when the window is exactly the demo trading day. */
  isToday: boolean;
  /** True when more than one day is covered. */
  multiDay: boolean;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (isoDate: string, days: number) => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
};
const addMonths = (ym: string, months: number) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + months, 1)).toISOString().slice(0, 7);
};
const monthEnd = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return iso(new Date(Date.UTC(y, m, 0)));
};
const weekOf = (isoDate: string) => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const start = addDays(isoDate, -((d.getUTCDay() + 6) % 7));
  return { from: start, to: addDays(start, 6) };
};

const YEARS = analytics.revenueByYear.map((y) => y.year).filter((y) => y >= yearsFrom);

/**
 * Shared period control. `grains` lets a screen offer only what its data can
 * answer — the team screens can split per staff for the last six months, so
 * they offer a twelve-month preset instead of a year picker.
 */
export function usePeriod(grains: readonly Grain[], initial: Grain = "day") {
  const [grain, setGrain] = useState<Grain>(initial);
  const [day, setDay] = useState(meta.demoDate);
  const [month, setMonth] = useState(meta.demoDate.slice(0, 7));
  const [year, setYear] = useState(Number(meta.demoDate.slice(0, 4)));
  const [rangeFrom, setRangeFrom] = useState(meta.demoDate);
  const [rangeTo, setRangeTo] = useState(meta.demoDate);

  const period = useMemo<Period>(() => {
    const done = (from: string, to: string, label: string): Period => ({
      from,
      to,
      label,
      grain,
      isToday: from === meta.demoDate && to === meta.demoDate,
      multiDay: from !== to,
    });

    switch (grain) {
      case "week": {
        const w = weekOf(day);
        return done(w.from, w.to, `${shortDate(w.from)} – ${shortDate(w.to)}`);
      }
      case "month":
        return done(`${month}-01`, monthEnd(month), monthLabel(month));
      case "year":
        return done(`${year}-01-01`, `${year}-12-31`, String(year));
      case "range":
        return done(
          rangeFrom,
          rangeTo,
          rangeFrom === rangeTo
            ? longDate(rangeFrom)
            : `${shortDate(rangeFrom)} – ${shortDate(rangeTo)}`
        );
      case "twelve":
        return done(addDays(meta.demoDate, -364), meta.demoDate, "Last 12 months");
      default:
        return done(day, day, day === meta.demoDate ? "Today" : longDate(day));
    }
  }, [grain, day, month, year, rangeFrom, rangeTo]);

  function step(direction: 1 | -1) {
    if (grain === "month") return setMonth(addMonths(month, direction));
    if (grain === "year") return setYear((y) => y + direction);
    if (grain === "week") return setDay(addDays(day, 7 * direction));
    if (grain === "range") {
      setRangeFrom(addDays(rangeFrom, direction));
      setRangeTo(addDays(rangeTo, direction));
      return;
    }
    if (grain === "twelve") return;
    setDay(addDays(day, direction));
  }

  function reset() {
    setGrain(initial);
    setDay(meta.demoDate);
    setMonth(meta.demoDate.slice(0, 7));
    setYear(Number(meta.demoDate.slice(0, 4)));
    setRangeFrom(meta.demoDate);
    setRangeTo(meta.demoDate);
  }

  const controls = {
    grains,
    grain,
    setGrain,
    day,
    setDay,
    month,
    setMonth,
    year,
    setYear,
    rangeFrom,
    setRangeFrom,
    rangeTo,
    setRangeTo,
    step,
    reset,
    period,
  };

  return controls;
}

export type PeriodControls = ReturnType<typeof usePeriod>;

const GRAIN_LABEL: Record<Grain, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
  year: "Year",
  range: "Range",
  twelve: "12 months",
};

export function PeriodBar({ c }: { c: PeriodControls }) {
  const { grain, period } = c;
  const field = "rounded border border-hairline bg-card px-2 py-1 text-xs text-ink";

  const atLatest =
    grain === "year"
      ? c.year >= Number(meta.demoDate.slice(0, 4))
      : grain === "month"
        ? c.month >= meta.demoDate.slice(0, 7)
        : period.to >= meta.demoDate;

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 flex gap-0.5">
        {c.grains.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => c.setGrain(g)}
            aria-pressed={grain === g}
            className={`rounded px-2 py-1 text-xs font-semibold transition-colors ${
              grain === g ? "bg-ink text-white" : "bg-chip text-taupe-deep hover:bg-hairline"
            }`}
          >
            {GRAIN_LABEL[g]}
          </button>
        ))}
      </span>

      {grain !== "twelve" && (
        <button
          type="button"
          onClick={() => c.step(-1)}
          aria-label="Previous period"
          className={`${field} hover:border-taupe`}
        >
          ←
        </button>
      )}

      {(grain === "day" || grain === "week") && (
        <input
          type="date"
          value={c.day}
          min={reportsFrom}
          max={meta.demoDate}
          onChange={(e) => c.setDay(e.target.value)}
          aria-label="Date"
          className={field}
        />
      )}

      {grain === "month" && (
        <input
          type="month"
          value={c.month}
          max={meta.demoDate.slice(0, 7)}
          onChange={(e) => c.setMonth(e.target.value)}
          aria-label="Month"
          className={field}
        />
      )}

      {grain === "year" && (
        <select
          value={c.year}
          onChange={(e) => c.setYear(Number(e.target.value))}
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
            value={c.rangeFrom}
            min={reportsFrom}
            max={meta.demoDate}
            onChange={(e) => c.setRangeFrom(e.target.value)}
            aria-label="From date"
            className={field}
          />
          <span className="text-xs text-mutedink">to</span>
          <input
            type="date"
            value={c.rangeTo}
            min={reportsFrom}
            max={meta.demoDate}
            onChange={(e) => c.setRangeTo(e.target.value)}
            aria-label="To date"
            className={field}
          />
        </>
      )}

      {grain !== "twelve" && (
        <button
          type="button"
          onClick={() => c.step(1)}
          aria-label="Next period"
          disabled={atLatest}
          className={`${field} hover:border-taupe disabled:opacity-40`}
        >
          →
        </button>
      )}

      {!period.isToday && grain !== c.grains[0] && (
        <button
          type="button"
          onClick={c.reset}
          className="text-xs font-semibold text-taupe hover:text-taupe-deep"
        >
          Reset
        </button>
      )}
    </span>
  );
}
