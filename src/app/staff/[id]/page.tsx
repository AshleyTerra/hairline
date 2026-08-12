"use client";

import Link from "next/link";
import { use } from "react";
import { notFound } from "next/navigation";
import { useMemo } from "react";
import { ColumnChart, Meter, StatTile } from "@/components/charts";
import { Card, CardTitle, PageHeader } from "@/components/ui";
import { PeriodBar, usePeriod } from "@/components/PeriodBar";
import { staffTurnover } from "@/lib/reports";
import { salesBetween } from "@/lib/salesSource";
import { useStore } from "@/lib/store";
import { demoday, getStaff, meta } from "@/lib/data";
import { longDate, monthLabel, pct, shortDate, zar, zar0 } from "@/lib/format";

export default function StaffMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const person = getStaff(Number(id));

  if (!person) notFound();

  const bookings = demoday.bookings.filter((b) => b.stylistId === person.id);
  const dayTotal = bookings.reduce((sum, b) => sum + b.total, 0);
  const period = usePeriod(["day", "week", "month", "range", "twelve"], "day");
  const { from, to, isToday, label, grain } = period.period;
  const { invoices } = useStore();

  /**
   * Their turnover and clients for the chosen window. The twelve-month preset
   * uses the aggregate, which reaches further back than the line-level history.
   */
  const useAggregate = grain === "twelve";
  const windowSales = useMemo(
    () => (useAggregate ? [] : salesBetween(from, to, invoices)),
    [useAggregate, from, to, invoices]
  );
  const windowTurnover = useMemo(() => {
    if (useAggregate) return person.totalRevenue;
    return staffTurnover(windowSales, [person.id])[0]?.inclVat.total ?? 0;
  }, [useAggregate, windowSales, person.id, person.totalRevenue]);

  /** Their clients in the window, most recent first. */
  const windowClients = useMemo(() => {
    if (isToday) return [];
    return windowSales
      .filter((sale) => sale.lines.some((l) => l.stylistId === person.id))
      .map((sale) => ({
        number: sale.number,
        date: sale.date,
        client: sale.client,
        value: sale.lines
          .filter((l) => l.stylistId === person.id)
          .reduce((n, l) => n + l.price * l.qty * (1 - l.disc / 100), 0),
        what: sale.lines.find((l) => l.stylistId === person.id)?.descr ?? "",
      }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 60);
  }, [isToday, windowSales, person]);

  const thisMonth = person.monthly[person.monthly.length - 1];
  const monthRevenue = thisMonth?.revenue ?? 0;

  const hoursThisWeek = person.clock.reduce((sum, c) => {
    if (!c.in || !c.out) return sum;
    const [ih, im] = c.in.split(":").map(Number);
    const [oh, om] = c.out.split(":").map(Number);
    return sum + Math.max(0, oh * 60 + om - (ih * 60 + im)) / 60;
  }, 0);

  return (
    <>
      <p className="mb-3 text-xs">
        <Link href="/staff" className="text-taupe-deep underline underline-offset-2">
          ← Team
        </Link>
      </p>

      <PageHeader
        eyebrow={
          person.role === "stylist"
            ? "Stylist portfolio"
            : person.role === "assistant"
              ? "Assistant"
              : "Reception"
        }
        title={person.name}
        subtitle={
          person.startDate
            ? `With Hairline since ${shortDate(person.startDate)}`
            : "Team member"
        }
        actions={<PeriodBar c={period} />}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={isToday ? "Booked today" : "Clients in period"}
          value={isToday ? zar0(dayTotal) : String(windowClients.length)}
          hint={
            isToday
              ? `${bookings.length} client${bookings.length === 1 ? "" : "s"}`
              : label
          }
        />
        <StatTile
          label={useAggregate ? "Turnover, 12 months" : `Turnover, ${label.toLowerCase()}`}
          value={zar0(windowTurnover)}
          hint={
            useAggregate
              ? person.invoices > 0
                ? `${person.invoices} invoices`
                : "Billed under a senior stylist"
              : windowTurnover > 0
                ? "From the sales in this window"
                : "Nothing billed to them in this window"
          }
        />
        <StatTile label="Tips" value={zar0(person.tips.total)} hint={`${person.tips.times} times`} />
        <StatTile
          label="Hours this week"
          value={hoursThisWeek > 0 ? `${hoursThisWeek.toFixed(1)}h` : "—"}
          hint={person.clock.length > 0 ? `${person.clock.length} days clocked` : "No clock records"}
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {person.totalRevenue > 0 && (
          <Card>
            <CardTitle right={<span className="text-xs text-mutedink">Last 12 months</span>}>
              Monthly turnover
            </CardTitle>
            <div className="px-4 pb-3 pt-4">
              <ColumnChart
                data={person.monthly.map((m) => ({
                  label: monthLabel(m.ym).slice(0, 3),
                  value: m.revenue,
                }))}
                height={160}
              />
              <div className="mt-4">
                <div className="mb-1 flex items-baseline justify-between text-xs">
                  <span className="text-mutedink">
                    {thisMonth ? monthLabel(thisMonth.ym) : "This month"} against target
                  </span>
                  <span className="tnum text-ink">
                    {zar0(monthRevenue)} / {zar0(person.monthlyTarget)}
                  </span>
                </div>
                <Meter
                  value={monthRevenue}
                  target={person.monthlyTarget}
                  tone={monthRevenue >= person.monthlyTarget ? "good" : "primary"}
                />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-mutedink">Services</dt>
                  <dd className="tnum font-semibold text-ink">{zar0(person.serviceRevenue)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-mutedink">Retail ({pct(person.retailShare, 1)})</dt>
                  <dd className="tnum font-semibold text-ink">{zar0(person.retailRevenue)}</dd>
                </div>
              </dl>
            </div>
          </Card>
        )}

        <Card>
          <CardTitle right={<span className="text-xs text-mutedink">{longDate(meta.demoDate)}</span>}>
            Today&apos;s clients
          </CardTitle>
          {bookings.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-mutedink">
              Nothing booked on the demo day.
            </p>
          ) : (
            <ul className="divide-y divide-hairline-soft">
              {bookings.map((b) => (
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
                    <span className="tnum block text-xs text-mutedink">
                      {b.start}–{b.end}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {person.clock.length > 0 && (
          <Card>
            <CardTitle>Time clock, demo week</CardTitle>
            <ul className="divide-y divide-hairline-soft text-sm">
              {person.clock.map((c) => (
                <li key={c.day} className="flex items-center justify-between px-4 py-2">
                  <span className="text-body">{shortDate(c.day)}</span>
                  <span className="tnum text-mutedink">
                    {c.in ?? "—"} → {c.out ?? "still in"}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {person.subs.total > 0 && (
          <Card>
            <CardTitle>Staff advances</CardTitle>
            <div className="px-4 py-4 text-sm">
              <p className="tnum text-lg font-semibold text-ink">{zar0(person.subs.total)}</p>
              <p className="text-xs text-mutedink">
                Across {person.subs.times} advance{person.subs.times === 1 ? "" : "s"} on record.
              </p>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
