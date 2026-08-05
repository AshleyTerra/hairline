"use client";

import Link from "next/link";
import { Sparkline, StatTile } from "@/components/charts";
import { Badge, Card, PageHeader } from "@/components/ui";
import { demoday, staff } from "@/lib/data";
import { initials, pct, zar0 } from "@/lib/format";
import { useStore } from "@/lib/store";

const ROLE_LABEL: Record<string, string> = {
  stylist: "Stylist",
  assistant: "Assistant",
  reception: "Reception",
};

export default function StaffPage() {
  const { role } = useStore();
  const canSeeMoney = role === "owner";

  const stylists = staff.filter((s) => s.role === "stylist").sort((a, b) => b.totalRevenue - a.totalRevenue);
  const others = staff.filter((s) => s.role !== "stylist");

  const teamRevenue = stylists.reduce((sum, s) => sum + s.totalRevenue, 0);
  const teamTips = staff.reduce((sum, s) => sum + s.tips.total, 0);

  return (
    <>
      <PageHeader
        eyebrow="Team"
        title="Staff"
        subtitle={`${staff.length} people on the books — ${stylists.length} stylists, ${others.length} support.`}
      />

      {canSeeMoney && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Team turnover" value={zar0(teamRevenue)} hint="Last 12 months" />
          <StatTile label="Tips paid to staff" value={zar0(teamTips)} hint="All time on record" />
          <StatTile
            label="Booked today"
            value={String(demoday.bookings.length)}
            hint="Across the diary"
          />
          <StatTile
            label="Busiest stylist"
            value={stylists[0]?.name ?? "—"}
            hint={stylists[0] ? `${zar0(stylists[0].totalRevenue)} in 12 months` : undefined}
          />
        </div>
      )}

      <h2 className="mb-2 text-sm font-semibold text-ink">Stylists</h2>
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stylists.map((s) => {
          const todays = demoday.bookings.filter((b) => b.stylistId === s.id).length;
          return (
            <Link key={s.id} href={`/staff/${s.id}`} className="block">
              <Card className="h-full p-4 transition-colors hover:border-taupe">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-chip text-sm font-semibold text-taupe-deep">
                    {initials(s.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{s.name}</p>
                    <p className="text-xs text-mutedink">
                      {ROLE_LABEL[s.role]}
                      {todays > 0 && ` · ${todays} booked today`}
                    </p>
                  </div>
                </div>
                {canSeeMoney && (
                  <>
                    <div className="mt-3 flex items-end justify-between gap-2">
                      <div>
                        <p className="tnum text-lg font-semibold text-ink">
                          {zar0(s.totalRevenue)}
                        </p>
                        <p className="text-[11px] text-mutedink">
                          12 months · {pct(s.retailShare, 1)} retail
                        </p>
                      </div>
                      <Sparkline values={s.monthly.map((m) => m.revenue)} width={100} height={28} />
                    </div>
                  </>
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
        {others.map((s) => (
          <Link key={s.id} href={`/staff/${s.id}`} className="block">
            <Card className="h-full p-4 transition-colors hover:border-taupe">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-hairline-soft text-sm font-semibold text-mutedink">
                  {initials(s.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{s.name}</p>
                  <p className="text-xs text-mutedink">{ROLE_LABEL[s.role]}</p>
                </div>
                {s.tips.total > 0 && canSeeMoney && (
                  <Badge tone="neutral">{zar0(s.tips.total)} tips</Badge>
                )}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
