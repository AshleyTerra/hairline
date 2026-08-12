"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui";
import { meta } from "@/lib/data";
import { longDate, pct, shortDate, zar0 } from "@/lib/format";
import { periodStats, reportsFrom } from "@/lib/salesSource";
import { useStore } from "@/lib/store";

/**
 * The headline strip. It defaults to the trading day but any date or range can
 * be chosen, so the owner can look back without opening a report.
 */
export function DashboardPeriod({ playCount }: { playCount: number }) {
  const { invoices } = useStore();
  const [from, setFrom] = useState(meta.demoDate);
  const [to, setTo] = useState(meta.demoDate);
  const [ranged, setRanged] = useState(false);

  const end = ranged ? to : from;
  const isToday = from === meta.demoDate && end === meta.demoDate;
  const stats = useMemo(() => periodStats(from, end, invoices), [from, end, invoices]);

  function shift(days: number) {
    const move = (iso: string) => {
      const d = new Date(`${iso}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString().slice(0, 10);
    };
    setFrom(move(from));
    if (ranged) setTo(move(to));
  }

  const field = "rounded border border-hairline bg-card px-2 py-1 text-xs text-ink";
  const label = isToday
    ? "Today"
    : ranged && from !== end
      ? `${shortDate(from)} – ${shortDate(end)}`
      : longDate(from);

  return (
    <section className="mb-8">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-ink">{label}</h2>
        {isToday && playCount > 0 && (
          <Badge tone="good">includes {playCount} rung up here</Badge>
        )}
        {stats.days > 1 && (
          <span className="text-xs text-mutedink">{stats.days} trading days</span>
        )}

        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label="Previous day"
            className={`${field} hover:border-taupe`}
          >
            ←
          </button>
          <input
            type="date"
            value={from}
            min={reportsFrom}
            max={meta.demoDate}
            onChange={(e) => setFrom(e.target.value)}
            aria-label={ranged ? "From date" : "Date"}
            className={field}
          />
          {ranged && (
            <>
              <span className="text-xs text-mutedink">to</span>
              <input
                type="date"
                value={to}
                min={reportsFrom}
                max={meta.demoDate}
                onChange={(e) => setTo(e.target.value)}
                aria-label="To date"
                className={field}
              />
            </>
          )}
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label="Next day"
            disabled={end >= meta.demoDate}
            className={`${field} hover:border-taupe disabled:opacity-40`}
          >
            →
          </button>
          <button
            type="button"
            onClick={() => setRanged((r) => !r)}
            aria-pressed={ranged}
            className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
              ranged ? "bg-ink text-white" : "bg-chip text-taupe-deep hover:bg-hairline"
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
          hint={`${pct(stats.cashShare, 0)} of takings are cash`}
        />
        {isToday ? (
          <StatTile label="Cash-up" value="Open" hint="Not yet locked for the day" tone="warn" />
        ) : (
          <StatTile
            label={stats.days > 1 ? "Busiest measure" : "Cash-up"}
            value={stats.days > 1 ? zar0(stats.total / Math.max(1, stats.days)) : "Locked"}
            hint={stats.days > 1 ? "Average per trading day" : "Day closed"}
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
      <p
        className={`tnum text-2xl font-light ${tone === "warn" ? "text-warn" : "text-ink"}`}
      >
        {value}
      </p>
      <p className="text-xs text-mutedink">{hint}</p>
    </div>
  );
}
