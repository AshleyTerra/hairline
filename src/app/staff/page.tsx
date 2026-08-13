"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Sparkline, StatTile } from "@/components/charts";
import { Badge, Card, PageHeader } from "@/components/ui";
import { PeriodBar, usePeriod } from "@/components/PeriodBar";
import { staffTurnover } from "@/lib/reports";
import { salesBetween } from "@/lib/salesSource";
import { roster } from "@/lib/roster";
import { demoday, staff } from "@/lib/data";
import { initials, pct, zar0 } from "@/lib/format";
import { useStore } from "@/lib/store";

export default function StaffPage() {
  const { role, invoices, staffRecords } = useStore();
  const canSeeMoney = role === "owner";

  /**
   * The team comes from the records kept in Admin — so someone taken on today
   * shows up here, someone turned inactive drops off, and everyone is called
   * what Admin calls them. Turnover joins on by staff number.
   */
  const team = useMemo(() => roster(staffRecords, staff), [staffRecords]);
  const stylists = team.filter((m) => !m.support);
  const others = team.filter((m) => m.support);

  const period = usePeriod(["twelve", "day", "week", "month", "range"], "twelve");
  const { from, to, isToday, label } = period.period;

  /**
   * Turnover per staff member for the chosen window, from the same sales the
   * till and reports use. The twelve-month preset keeps the aggregate figures,
   * which reach back further than the line-level history.
   */
  const useAggregate = period.period.grain === "twelve";
  const periodRevenue = useMemo(() => {
    if (useAggregate) return null;
    const sales = salesBetween(from, to, invoices);
    const rows = staffTurnover(sales, team.map((m) => m.id));
    return new Map(rows.map((r) => [r.stylistId, r.inclVat.total]));
  }, [useAggregate, from, to, invoices, team]);

  const revenueOf = (id: number, fallback: number) =>
    periodRevenue ? (periodRevenue.get(id) ?? 0) : fallback;

  const ranked = [...stylists].sort(
    (a, b) => revenueOf(b.id, b.stats.totalRevenue) - revenueOf(a.id, a.stats.totalRevenue)
  );

  const teamRevenue = stylists.reduce((sum, m) => sum + revenueOf(m.id, m.stats.totalRevenue), 0);
  const teamTips = team.reduce((sum, m) => sum + m.stats.tips.total, 0);

  /**
   * Invoices over the window. Line-by-line history reaches back six months, so a
   * twelve-month count has to come from the aggregate — otherwise half a year is
   * reported as a full one.
   */
  const salesCount = useAggregate
    ? team.reduce((sum, m) => sum + m.stats.invoices, 0)
    : salesBetween(from, to, invoices).length;

  return (
    <>
      <PageHeader
        eyebrow="Team"
        title="Staff"
        subtitle={`${team.length} active on the books — ${stylists.length} stylists, ${others.length} support.`}
        actions={canSeeMoney ? <PeriodBar c={period} /> : undefined}
      />

      {canSeeMoney && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Team turnover" value={zar0(teamRevenue)} hint={label} />
          <StatTile label="Tips paid to staff" value={zar0(teamTips)} hint="All time on record" />
          <StatTile
            label={isToday ? "Booked today" : "Sales in period"}
            value={
              isToday
                ? String(demoday.bookings.length)
                : salesCount.toLocaleString("en-ZA")
            }
            hint={isToday ? "Across the diary" : label}
          />
          <StatTile
            label="Busiest stylist"
            value={ranked[0]?.name ?? "—"}
            hint={
              ranked[0]
                ? `${zar0(revenueOf(ranked[0].id, ranked[0].stats.totalRevenue))} · ${label.toLowerCase()}`
                : undefined
            }
          />
        </div>
      )}

      <h2 className="mb-2 text-sm font-semibold text-ink">Stylists</h2>
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ranked.map((m) => {
          const todays = demoday.bookings.filter((b) => b.stylistId === m.id).length;
          const revenue = revenueOf(m.id, m.stats.totalRevenue);
          return (
            <Link key={m.id} href={`/staff/${m.id}`} className="block">
              <Card className="h-full p-4 transition-colors hover:border-taupe">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-chip text-sm font-semibold text-taupe-deep">
                    {initials(m.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{m.name}</p>
                    <p className="text-xs text-mutedink">
                      {m.designation}
                      {todays > 0 && ` · ${todays} booked today`}
                    </p>
                  </div>
                </div>
                {canSeeMoney && (
                  <div className="mt-3 flex items-end justify-between gap-2">
                    <div>
                      <p className="tnum text-lg font-semibold text-ink">{zar0(revenue)}</p>
                      <p className="text-[11px] text-mutedink">
                        {m.stats.invoices === 0 && m.stats.monthly.length === 0
                          ? "Newly on the books"
                          : useAggregate
                            ? `12 months · ${pct(m.stats.retailShare, 1)} retail`
                            : label}
                      </p>
                    </div>
                    <Sparkline
                      values={m.stats.monthly.map((x) => x.revenue)}
                      width={100}
                      height={28}
                    />
                  </div>
                )}
              </Card>
            </Link>
          );
        })}
      </div>

      <h2 className="mb-2 text-sm font-semibold text-ink">Assistants and reception</h2>
      <p className="mb-3 max-w-2xl text-xs text-mutedink">
        These team members clock in every day and receive tips, but MySalon bills their work under
        the senior stylist, so no turnover is attributed to them. In the new system their
        contribution is visible.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {others.map((m) => (
          <Link key={m.id} href={`/staff/${m.id}`} className="block">
            <Card className="h-full p-4 transition-colors hover:border-taupe">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-hairline-soft text-sm font-semibold text-mutedink">
                  {initials(m.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{m.name}</p>
                  <p className="text-xs text-mutedink">{m.designation}</p>
                </div>
                {m.stats.tips.total > 0 && canSeeMoney && (
                  <Badge tone="neutral">{zar0(m.stats.tips.total)} tips</Badge>
                )}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
