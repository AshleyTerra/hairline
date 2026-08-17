"use client";

import { useMemo, useState } from "react";
import { Card, CardTitle, PageHeader, TableScroll } from "@/components/ui";
import { MenuBuilder } from "@/components/pricing/MenuBuilder";
import { ScheduleIncrease } from "@/components/pricing/ScheduleIncrease";
import { products, serviceDepts, services } from "@/lib/data";
import { ServiceCostSheet } from "@/components/pricing/ServiceCostSheet";
import { stockBook } from "@/lib/stockBook";
import { useStore } from "@/lib/store";
import { zar } from "@/lib/format";

type Tab = "services" | "retail" | "menu" | "costs";

const TABS: { key: Tab; label: string }[] = [
  { key: "services", label: "Service pricing" },
  { key: "retail", label: "Retail pricing" },
  { key: "menu", label: "Client menu" },
  { key: "costs", label: "Service cost list" },
];

export default function PriceMenuPage() {
  const [tab, setTab] = useState<Tab>("services");
  const [dept, setDept] = useState<string>(serviceDepts[0] ?? "");
  const [vendor, setVendor] = useState<string>("");
  const [increase, setIncrease] = useState<null | "services" | "retail">(null);

  /* Retail as the salon maintains it, so a price corrected on the Stock screen
     is the price this menu quotes — the two must never disagree. */
  const { newStock, stockEdits, archivedStock } = useStore();
  const retail = useMemo(
    () => stockBook(products.retail, newStock, stockEdits, archivedStock, "retail"),
    [newStock, stockEdits, archivedStock]
  );
  const vendors = useMemo(() => {
    const seen: string[] = [];
    for (const p of retail) if (!seen.includes(p.brand)) seen.push(p.brand);
    return seen.sort((a, b) => a.localeCompare(b));
  }, [retail]);
  const activeVendor = vendor || vendors[0] || "";

  const deptServices = useMemo(() => services.filter((s) => s.dept === dept), [dept]);
  const vendorProducts = useMemo(
    () => retail.filter((p) => p.brand === activeVendor),
    [retail, activeVendor]
  );

  return (
    <>
      <PageHeader
        eyebrow="Price menu"
        title={
          tab === "menu"
            ? "The client menu"
            : tab === "costs"
              ? "What each service costs us"
              : "What everything costs"
        }
        subtitle={
          tab === "services"
            ? "Service prices by department, with the margin on each."
            : tab === "retail"
              ? "Retail prices by supplier, with cost, margin and stock on hand."
              : tab === "costs"
                ? "Every service at cost price, on one printable sheet. Internal — not for the counter."
                : "Generated from the prices above — never retyped."
        }
        actions={
          tab === "services" || tab === "retail" ? (
            <button
              type="button"
              onClick={() => setIncrease(tab === "services" ? "services" : "retail")}
              className="no-print rounded border border-taupe px-3 py-1.5 text-xs font-semibold text-taupe-deep hover:bg-chip"
            >
              Schedule an increase
            </button>
          ) : undefined
        }
      />

      <div className="no-print mb-4 flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            className={`rounded-full px-3.5 py-1.5 text-xs transition-colors ${
              tab === t.key
                ? "bg-taupe font-semibold text-white"
                : "bg-chip text-taupe-deep hover:bg-hairline"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* -------------------------------------------------- service pricing */}
      {tab === "services" && (
        <>
          <div className="no-print mb-3 flex flex-wrap gap-1.5">
            {serviceDepts.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDept(d)}
                aria-pressed={dept === d}
                className={`whitespace-nowrap rounded-full border px-3 py-[5px] text-xs font-semibold transition-colors ${
                  dept === d
                    ? "border-ink bg-ink text-white"
                    : "border-hairline bg-card text-taupe-deep hover:border-taupe"
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          <Card>
            <CardTitle right={<span className="text-xs text-mutedink">{deptServices.length} services</span>}>
              {dept}
            </CardTitle>
            <TableScroll>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-[0.08em] text-mutedink">
                    <th className="px-4 py-2.5 font-semibold">Service</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Rung up</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Cost</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Price</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {deptServices.map((s) => (
                    <tr key={s.id} className="border-b border-hairline-soft last:border-0">
                      <td className="px-4 py-2.5 text-ink">{s.name}</td>
                      <td className="tnum px-4 py-2.5 text-right text-mutedink">
                        {s.timesSold > 0 ? `${s.timesSold}×` : "—"}
                      </td>
                      <td className="tnum px-4 py-2.5 text-right text-mutedink">
                        {s.cost > 0 ? zar(s.cost) : "—"}
                      </td>
                      <td className="tnum px-4 py-2.5 text-right font-medium text-ink">
                        {zar(s.price)}
                      </td>
                      <td className="tnum px-4 py-2.5 text-right text-mutedink">
                        {s.cost > 0 ? `${Math.round(((s.price - s.cost) / s.price) * 100)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </Card>
        </>
      )}

      {/* --------------------------------------------------- retail pricing */}
      {tab === "retail" && (
        <>
          <div className="no-print mb-3 flex flex-wrap gap-1.5">
            {vendors.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVendor(v)}
                aria-pressed={activeVendor === v}
                className={`whitespace-nowrap rounded-full border px-3 py-[5px] text-xs font-semibold transition-colors ${
                  activeVendor === v
                    ? "border-ink bg-ink text-white"
                    : "border-hairline bg-card text-taupe-deep hover:border-taupe"
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          <Card>
            <CardTitle
              right={<span className="text-xs text-mutedink">{vendorProducts.length} products</span>}
            >
              {activeVendor}
            </CardTitle>
            <TableScroll>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-[0.08em] text-mutedink">
                    <th className="px-4 py-2.5 font-semibold">Product</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Sold</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Cost</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Price</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Margin</th>
                    <th className="px-4 py-2.5 text-right font-semibold">On hand</th>
                  </tr>
                </thead>
                <tbody>
                  {vendorProducts.map((p) => (
                    <tr key={p.id} className="border-b border-hairline-soft last:border-0">
                      <td className="px-4 py-2.5 text-ink">{p.name}</td>
                      <td className="tnum px-4 py-2.5 text-right text-mutedink">
                        {p.timesSold > 0 ? `${p.timesSold}×` : "—"}
                      </td>
                      <td className="tnum px-4 py-2.5 text-right text-mutedink">{zar(p.cost)}</td>
                      <td className="tnum px-4 py-2.5 text-right font-medium text-ink">
                        {zar(p.price)}
                      </td>
                      <td className="tnum px-4 py-2.5 text-right text-mutedink">
                        {p.margin != null ? `${p.margin}%` : "—"}
                      </td>
                      <td
                        className={`tnum px-4 py-2.5 text-right ${
                          p.needsCount ? "text-crit" : p.lowStock ? "text-warn" : "text-mutedink"
                        }`}
                      >
                        {p.qty}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </Card>
        </>
      )}

      {/* ------------------------------------------------------ client menu */}
      {tab === "menu" && <MenuBuilder />}

      {/* Cost prices, printable — an internal sheet, kept apart from the
          client menu so the two are never picked up for one another. */}
      {tab === "costs" && <ServiceCostSheet />}

      {increase && (
        <ScheduleIncrease
          scope={increase}
          vendor={increase === "retail" ? vendor : undefined}
          dept={increase === "services" ? dept : undefined}
          onClose={() => setIncrease(null)}
        />
      )}
    </>
  );
}
