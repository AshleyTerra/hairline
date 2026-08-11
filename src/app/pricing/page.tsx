"use client";

import { useMemo, useState } from "react";
import { Card, CardTitle, PageHeader, TableScroll } from "@/components/ui";
import { PrintableMenu } from "@/components/pricing/PrintableMenu";
import { ScheduleIncrease } from "@/components/pricing/ScheduleIncrease";
import { products, serviceDepts, services, tillVendors } from "@/lib/data";
import { zar } from "@/lib/format";

type Tab = "services" | "retail" | "menu";

const TABS: { key: Tab; label: string }[] = [
  { key: "services", label: "Service pricing" },
  { key: "retail", label: "Retail pricing" },
  { key: "menu", label: "Client menu" },
];

export default function PriceMenuPage() {
  const [tab, setTab] = useState<Tab>("services");
  const [dept, setDept] = useState<string>(serviceDepts[0] ?? "");
  const [vendor, setVendor] = useState<string>(tillVendors[0] ?? "");
  const [increase, setIncrease] = useState<null | "services" | "retail">(null);

  const deptServices = useMemo(() => services.filter((s) => s.dept === dept), [dept]);
  const vendorProducts = useMemo(
    () => products.retail.filter((p) => p.brand === vendor),
    [vendor]
  );

  return (
    <>
      <PageHeader
        eyebrow="Price menu"
        title={tab === "menu" ? "The client menu" : "What everything costs"}
        subtitle={
          tab === "services"
            ? "Service prices by department, with the margin on each."
            : tab === "retail"
              ? "Retail prices by supplier, with cost, margin and stock on hand."
              : "Generated from the prices above — never retyped."
        }
        actions={
          tab !== "menu" ? (
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
            {tillVendors.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVendor(v)}
                aria-pressed={vendor === v}
                className={`whitespace-nowrap rounded-full border px-3 py-[5px] text-xs font-semibold transition-colors ${
                  vendor === v
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
              {vendor}
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
      {tab === "menu" && <PrintableMenu />}

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
