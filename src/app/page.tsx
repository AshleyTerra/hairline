"use client";

import Link from "next/link";
import {
  ColumnChart,
  MixBars,
  MonthAreaChart,
  RankedBars,
  Meter,
  Sparkline,
  StatTile,
} from "@/components/charts";
import { Card, CardTitle, PageHeader, TableScroll } from "@/components/ui";
import { DashboardPeriod } from "@/components/DashboardPeriod";
import {
  analytics,
  demoday,
  earningStylists,
  getStaff,
  lowStockItems,
  meta,
} from "@/lib/data";
import { longDate, monthLabel, pct, zar, zar0, zarCompact } from "@/lib/format";
import { useStore } from "@/lib/store";

export default function DashboardPage() {
  const { role, stylistId, invoices } = useStore();

  if (role === "stylist") {
    return <StylistDashboard stylistId={stylistId} />;
  }

  return <OwnerDashboard playCount={invoices.length} />;
}

// ---------------------------------------------------------------- owner view

function OwnerDashboard({
  playCount,
}: {
  playCount: number;
}) {
  const years = analytics.revenueByYear.filter((y) => y.year >= 2016 && y.year <= 2025);
  const lastFullYear = years[years.length - 1];
  const priorYear = years[years.length - 2];
  const yoy = priorYear
    ? ((lastFullYear.revenue - priorYear.revenue) / priorYear.revenue) * 100
    : 0;

  const topStylists = earningStylists.slice(0, 6).map((s) => ({
    label: s.name,
    value: s.totalRevenue,
    hint: `${s.invoices} invoices · ${s.retailShare}% retail`,
  }));

  const monthly = analytics.revenueByMonth.slice(-24);
  const bestMonth = monthly.reduce((a, b) => (b.revenue > a.revenue ? b : a), monthly[0]);

  return (
    <>
      <PageHeader
        eyebrow="Owner"
        title="Dashboard"
        subtitle={`Trading day ${longDate(meta.demoDate)} · figures from Hairline's own records`}
      />

      <DashboardPeriod playCount={playCount} />

      <section className="mb-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle right={<span className="text-xs text-mutedink">Full years</span>}>
            Revenue by year
          </CardTitle>
          <div className="px-4 pb-3 pt-4">
            <ColumnChart
              data={years.map((y) => ({
                label: `'${String(y.year).slice(2)}`,
                value: y.revenue,
                emphasis: y.year === lastFullYear.year,
              }))}
            />
            <p className="mt-2 text-xs text-mutedink">
              {lastFullYear.year}:{" "}
              <strong className="text-ink">{zar0(lastFullYear.revenue)}</strong> across{" "}
              {lastFullYear.invoices.toLocaleString("en-ZA")} invoices —{" "}
              <span className={yoy >= 0 ? "text-good" : "text-crit"}>
                {yoy >= 0 ? "+" : ""}
                {yoy.toFixed(1)}%
              </span>{" "}
              on {priorYear?.year}.
            </p>
          </div>
        </Card>

        <Card>
          <CardTitle right={<span className="text-xs text-mutedink">Last 24 months</span>}>
            Monthly revenue
          </CardTitle>
          <div className="px-4 pb-3 pt-4">
            <MonthAreaChart data={monthly} />
            <p className="mt-2 text-xs text-mutedink">
              Best month: <strong className="text-ink">{monthLabel(bestMonth.ym)}</strong> at{" "}
              {zar0(bestMonth.revenue)}.
            </p>
          </div>
        </Card>
      </section>

      <section className="mb-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle
            right={
              <Link href="/staff" className="text-xs text-taupe-deep underline underline-offset-2">
                Team
              </Link>
            }
          >
            Top stylists, last 12 months
          </CardTitle>
          <div className="px-4 py-4">
            <RankedBars data={topStylists} />
          </div>
        </Card>

        <Card>
          <CardTitle right={<span className="text-xs text-mutedink">Since 2022</span>}>
            Services vs retail
          </CardTitle>
          <div className="px-4 py-4">
            <MixBars data={analytics.mixByYear} />
            <p className="mt-3 text-xs text-mutedink">
              Retail sits near {analytics.mixByYear[analytics.mixByYear.length - 1]?.retailShare}% of
              turnover. Industry guidance puts a healthy salon between 15% and 20%.
            </p>
          </div>
        </Card>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold text-ink">Worth your attention</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/clients?filter=lapsed" className="block">
            <StatTile
              label="Lapsed clients"
              value={analytics.retention.lapsed.toLocaleString("en-ZA")}
              hint="No visit in 90+ days — win-back list"
              tone="warn"
            />
          </Link>
          <Link href="/stock" className="block">
            <StatTile
              label="Stock needing a count"
              value={analytics.stockHealth.negative.toLocaleString("en-ZA")}
              hint="Lines showing negative on-hand today"
              tone="crit"
            />
          </Link>
          <StatTile
            label="Birthdays on file"
            value={pct(
              (analytics.clientHealth.withBirthday / analytics.clientHealth.activeClients) * 100,
              0
            )}
            hint={`Only ${analytics.clientHealth.withBirthday} of ${analytics.clientHealth.activeClients.toLocaleString("en-ZA")} clients`}
            tone="warn"
          />
          <StatTile
            label="Loyal clients"
            value={analytics.retention.loyal10plus.toLocaleString("en-ZA")}
            hint="10 or more visits — your core"
            tone="good"
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle right={<span className="text-xs text-mutedink">Last 12 months</span>}>
            Top services
          </CardTitle>
          <TableScroll>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline-soft text-left text-[11px] uppercase tracking-[0.08em] text-mutedink">
                  <th className="px-4 py-2 font-semibold">Service</th>
                  <th className="px-4 py-2 text-right font-semibold">Times</th>
                  <th className="px-4 py-2 text-right font-semibold">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {analytics.topServices.slice(0, 8).map((s) => (
                  <tr key={s.name} className="border-b border-hairline-soft last:border-0">
                    <td className="px-4 py-2 text-body">{s.name}</td>
                    <td className="tnum px-4 py-2 text-right text-mutedink">{s.times}</td>
                    <td className="tnum px-4 py-2 text-right font-semibold text-ink">
                      {zarCompact(s.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </Card>

        <Card>
          <CardTitle
            right={
              <Link href="/stock" className="text-xs text-taupe-deep underline underline-offset-2">
                Stock
              </Link>
            }
          >
            Top retail products
          </CardTitle>
          <TableScroll>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline-soft text-left text-[11px] uppercase tracking-[0.08em] text-mutedink">
                  <th className="px-4 py-2 font-semibold">Product</th>
                  <th className="px-4 py-2 text-right font-semibold">Sold</th>
                  <th className="px-4 py-2 text-right font-semibold">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {analytics.topProducts.slice(0, 8).map((p) => (
                  <tr key={p.name} className="border-b border-hairline-soft last:border-0">
                    <td className="px-4 py-2 text-body">{p.name}</td>
                    <td className="tnum px-4 py-2 text-right text-mutedink">{p.times}</td>
                    <td className="tnum px-4 py-2 text-right font-semibold text-ink">
                      {zarCompact(p.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </Card>
      </section>

      {lowStockItems.length > 0 && (
        <p className="mt-6 text-xs text-mutedink">
          {lowStockItems.length.toLocaleString("en-ZA")} stock lines are at or below their reorder
          level, or need a physical count.{" "}
          <Link href="/stock" className="text-taupe-deep underline underline-offset-2">
            Open the order list
          </Link>
          .
        </p>
      )}
    </>
  );
}

// -------------------------------------------------------------- stylist view

function StylistDashboard({ stylistId }: { stylistId: number }) {
  const me = getStaff(stylistId);
  const myBookings = demoday.bookings.filter((b) => b.stylistId === stylistId);

  if (!me) {
    return <PageHeader title="Stylist" subtitle="Pick a stylist in the role switcher." />;
  }

  const thisMonth = me.monthly[me.monthly.length - 1];
  const monthRevenue = thisMonth?.revenue ?? 0;
  const dayTotal = myBookings.reduce((sum, b) => sum + b.total, 0);

  return (
    <>
      <PageHeader
        eyebrow="My day"
        title={me.name}
        subtitle={`${longDate(meta.demoDate)} · ${myBookings.length} clients booked`}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Booked today" value={zar0(dayTotal)} hint={`${myBookings.length} clients`} />
        <StatTile
          label="This month"
          value={zar0(monthRevenue)}
          hint={thisMonth ? monthLabel(thisMonth.ym) : "—"}
        />
        <StatTile label="Tips earned" value={zar0(me.tips.total)} hint={`${me.tips.times} times`} />
        <StatTile label="Retail share" value={pct(me.retailShare, 1)} hint="Of your own turnover" />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle right={<span className="text-xs text-mutedink">vs {zar0(me.monthlyTarget)}</span>}>
            Month against target
          </CardTitle>
          <div className="px-4 py-4">
            <Meter
              value={monthRevenue}
              target={me.monthlyTarget}
              tone={monthRevenue >= me.monthlyTarget ? "good" : "primary"}
            />
            <p className="mt-2 text-xs text-mutedink">
              {monthRevenue >= me.monthlyTarget
                ? "Target met — nicely done."
                : `${zar0(me.monthlyTarget - monthRevenue)} to go.`}
            </p>
            <div className="mt-4">
              <p className="mb-1 text-[11px] uppercase tracking-[0.1em] text-mutedink">
                Last 12 months
              </p>
              <Sparkline values={me.monthly.map((m) => m.revenue)} width={240} height={40} />
            </div>
          </div>
        </Card>

        <Card>
          <CardTitle>My clients today</CardTitle>
          {myBookings.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-mutedink">
              Nothing booked on the demo day.
            </p>
          ) : (
            <ul className="divide-y divide-hairline-soft">
              {myBookings.map((b) => (
                <li key={b.invoiceId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0">
                    <Link
                      href={`/clients/${b.clientId}`}
                      className="block truncate text-sm text-ink underline-offset-2 hover:underline"
                    >
                      {b.clientName}
                    </Link>
                    <span className="block truncate text-xs text-mutedink">{b.service}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="tnum block text-sm font-semibold text-ink">{zar(b.total)}</span>
                    <span className="tnum block text-xs text-mutedink">{b.start}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
