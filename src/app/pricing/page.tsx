"use client";

import { useMemo, useState } from "react";
import { StatTile } from "@/components/charts";
import { Badge, Card, PageHeader, TableScroll } from "@/components/ui";
import { meta, serviceDepts, services } from "@/lib/data";
import { zar } from "@/lib/format";

export default function PricingPage() {
  const [increaseOpen, setIncreaseOpen] = useState(false);
  const [printView, setPrintView] = useState(false);
  const [percent, setPercent] = useState(8);

  const stats = useMemo(() => {
    const withCost = services.filter((s) => s.cost > 0);
    const avgMargin =
      withCost.length > 0
        ? withCost.reduce((sum, s) => sum + ((s.price - s.cost) / s.price) * 100, 0) /
          withCost.length
        : 0;
    return {
      count: services.length,
      depts: serviceDepts.length,
      avgPrice: services.reduce((sum, s) => sum + s.price, 0) / (services.length || 1),
      avgMargin,
      costed: withCost.length,
    };
  }, []);

  if (printView) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="no-print mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setPrintView(false)}
            className="text-xs text-taupe-deep underline underline-offset-2"
          >
            ← Back to the price manager
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded bg-taupe-deep px-3 py-1.5 text-xs font-semibold text-white"
          >
            Print or save as PDF
          </button>
        </div>

        <header className="mb-8 border-b border-hairline pb-4 text-center">
          <p className="text-3xl font-light tracking-wide">
            <span className="text-taupe">HAIR</span>
            <span className="font-extralight text-ink">|</span>
            <span className="text-ink">line</span>
          </p>
          <p className="mt-2 text-sm uppercase tracking-[0.2em] text-mutedink">Price menu</p>
          <p className="mt-1 text-xs text-mutedink">
            Shop 30, Stoneridge Centre, Greenstone Park · Valid from{" "}
            {new Date(meta.demoDate).getFullYear()}
          </p>
        </header>

        {serviceDepts.map((dept) => {
          const items = services.filter((s) => s.dept === dept);
          if (items.length === 0) return null;
          return (
            <section key={dept} className="mb-6 break-inside-avoid">
              <h2 className="mb-2 border-b border-hairline-soft pb-1 text-sm font-semibold uppercase tracking-[0.1em] text-taupe-deep">
                {dept}
              </h2>
              <ul className="columns-1 gap-8 sm:columns-2">
                {items.map((s) => (
                  <li
                    key={s.id}
                    className="mb-1 flex break-inside-avoid items-baseline justify-between gap-2 text-sm"
                  >
                    <span className="min-w-0 text-body">{s.name}</span>
                    <span className="flex-1 border-b border-dotted border-hairline" />
                    <span className="tnum shrink-0 font-semibold text-ink">{zar(s.price)}</span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        <p className="mt-8 border-t border-hairline pt-3 text-center text-[11px] text-mutedink">
          Prices include VAT. Generated from the salon system on{" "}
          {new Date().toLocaleDateString("en-ZA")} — never retyped.
        </p>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Menu and prices"
        title="Pricing"
        subtitle={`${stats.count} services across ${stats.depts} departments, as priced in the salon today.`}
        actions={
          <>
            <button
              type="button"
              onClick={() => setIncreaseOpen(true)}
              className="rounded border border-taupe px-3 py-1.5 text-xs font-semibold text-taupe-deep hover:bg-chip"
            >
              Schedule an increase
            </button>
            <button
              type="button"
              onClick={() => setPrintView(true)}
              className="rounded bg-taupe-deep px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink"
            >
              Print client menu
            </button>
          </>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Services on the menu" value={String(stats.count)} />
        <StatTile label="Average price" value={zar(stats.avgPrice)} />
        <StatTile
          label="Services with a cost"
          value={`${stats.costed} of ${stats.count}`}
          hint="Needed to see true margin"
          tone={stats.costed < stats.count / 2 ? "warn" : "neutral"}
        />
        <StatTile
          label="Average margin"
          value={stats.costed > 0 ? `${stats.avgMargin.toFixed(0)}%` : "—"}
          hint="Where costs are captured"
        />
      </div>

      <div className="mb-4 rounded border border-hairline bg-chip px-4 py-3 text-sm text-taupe-deep">
        <strong>Why this screen matters.</strong> Hairline currently maintains the client price menu
        as a separate Word document every year — we found five years of them. Here the menu is
        generated from the same prices the till charges, so the printed menu can never drift from
        what clients are actually billed.
      </div>

      <div className="flex flex-col gap-4">
        {serviceDepts.map((dept) => {
          const items = services.filter((s) => s.dept === dept);
          if (items.length === 0) return null;
          return (
            <Card key={dept}>
              <div className="flex items-center justify-between border-b border-hairline-soft px-4 py-3">
                <h2 className="text-sm font-semibold text-ink">{dept}</h2>
                <span className="text-xs text-mutedink">{items.length} services</span>
              </div>
              <TableScroll>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-hairline-soft text-left text-[11px] uppercase tracking-[0.08em] text-mutedink">
                      <th className="px-4 py-2 font-semibold">Service</th>
                      <th className="px-4 py-2 text-right font-semibold">Minutes</th>
                      <th className="px-4 py-2 text-right font-semibold">Cost</th>
                      <th className="px-4 py-2 text-right font-semibold">Price</th>
                      <th className="px-4 py-2 text-right font-semibold">Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((s) => {
                      const margin = s.cost > 0 ? ((s.price - s.cost) / s.price) * 100 : null;
                      return (
                        <tr key={s.id} className="border-b border-hairline-soft last:border-0">
                          <td className="px-4 py-2 text-body">{s.name}</td>
                          <td className="tnum px-4 py-2 text-right text-mutedink">{s.mins}</td>
                          <td className="tnum px-4 py-2 text-right text-mutedink">
                            {s.cost > 0 ? zar(s.cost) : "—"}
                          </td>
                          <td className="tnum px-4 py-2 text-right font-semibold text-ink">
                            {zar(s.price)}
                          </td>
                          <td className="tnum px-4 py-2 text-right">
                            {margin === null ? (
                              <span className="text-mutedink">—</span>
                            ) : (
                              <span className={margin < 50 ? "text-warn" : "text-body"}>
                                {margin.toFixed(0)}%
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableScroll>
            </Card>
          );
        })}
      </div>

      {increaseOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Schedule a price increase"
          onClick={() => setIncreaseOpen(false)}
        >
          <div
            className="w-full max-w-md rounded border border-hairline bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-1 text-lg font-semibold text-ink">Schedule a price increase</h2>
            <p className="mb-4 text-xs text-mutedink">
              Prototype preview — nothing is changed. In the live system the increase applies
              automatically on its effective date, and the printed menu regenerates itself.
            </p>

            <label className="mb-3 block text-xs">
              <span className="mb-1 block font-semibold uppercase tracking-[0.1em] text-mutedink">
                Increase by
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={percent}
                  onChange={(e) => setPercent(Number(e.target.value) || 0)}
                  className="tnum w-20 rounded border border-hairline bg-paper px-2 py-2 text-sm text-ink"
                />
                <span className="text-sm text-body">percent</span>
              </div>
            </label>

            <label className="mb-4 block text-xs">
              <span className="mb-1 block font-semibold uppercase tracking-[0.1em] text-mutedink">
                Applies to
              </span>
              <select className="w-full rounded border border-hairline bg-paper px-2 py-2 text-sm text-ink">
                <option>Every service</option>
                {serviceDepts.map((d) => (
                  <option key={d}>{d} only</option>
                ))}
              </select>
            </label>

            <div className="mb-4 rounded bg-paper px-3 py-2 text-xs">
              <p className="text-mutedink">For example:</p>
              <ul className="mt-1 space-y-0.5">
                {services.slice(0, 3).map((s) => (
                  <li key={s.id} className="flex justify-between">
                    <span className="min-w-0 truncate text-body">{s.name}</span>
                    <span className="tnum shrink-0 text-ink">
                      {zar(s.price)} → <strong>{zar(Math.round(s.price * (1 + percent / 100)))}</strong>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-between gap-2">
              <Badge tone="neutral">Clients can be notified by SMS</Badge>
              <button
                type="button"
                onClick={() => setIncreaseOpen(false)}
                className="rounded bg-taupe-deep px-3 py-2 text-sm font-semibold text-white"
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
