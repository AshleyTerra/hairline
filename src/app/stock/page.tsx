"use client";

import { useMemo, useState } from "react";
import { StatTile } from "@/components/charts";
import { Badge, Card, PageHeader, TableScroll } from "@/components/ui";
import { analytics, backbarValueOnHand, products, retailValueOnHand } from "@/lib/data";
import { pct, zar, zar0 } from "@/lib/format";
import type { Product } from "@/lib/types";

type Tab = "retail" | "backbar" | "order";

const TABS: { value: Tab; label: string }[] = [
  { value: "retail", label: "Retail shelf" },
  { value: "backbar", label: "Back bar" },
  { value: "order", label: "What to order" },
];

export default function StockPage() {
  const [tab, setTab] = useState<Tab>("retail");
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("all");

  const source = tab === "backbar" ? products.backbar : products.retail;

  const brands = useMemo(
    () => ["all", ...[...new Set(source.map((p) => p.brand))].sort()],
    [source]
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base =
      tab === "order"
        ? [...products.retail, ...products.backbar].filter((p) => p.lowStock || p.needsCount)
        : source;

    return base
      .filter((p) => {
        if (brand !== "all" && p.brand !== brand) return false;
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          (p.barcode ?? "").includes(q)
        );
      })
      .slice(0, 250);
  }, [tab, source, query, brand]);

  const orderByVendor = useMemo(() => {
    if (tab !== "order") return [];
    const groups = new Map<string, Product[]>();
    for (const p of rows) {
      const list = groups.get(p.brand) ?? [];
      list.push(p);
      groups.set(p.brand, list);
    }
    return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [tab, rows]);

  return (
    <>
      <PageHeader
        eyebrow="Stock control"
        title="Stock"
        subtitle="Retail shelf and professional back bar tracked separately, as the industry recommends."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Retail value on hand"
          value={zar0(retailValueOnHand)}
          hint={`${products.retail.length} lines`}
        />
        <StatTile
          label="Back bar value"
          value={zar0(backbarValueOnHand)}
          hint={`${products.backbar.length} lines`}
        />
        <StatTile
          label="Needs a count"
          value={analytics.stockHealth.negative.toLocaleString("en-ZA")}
          hint="Showing negative on-hand"
          tone="crit"
        />
        <StatTile
          label="Never counted"
          value={analytics.stockHealth.zero.toLocaleString("en-ZA")}
          hint="Sitting at zero"
          tone="warn"
        />
      </div>

      <div className="mb-4 rounded border border-crit bg-crit-soft px-4 py-3 text-sm text-crit">
        <strong>What this screen is telling you.</strong>{" "}
        {analytics.stockHealth.negative.toLocaleString("en-ZA")} of{" "}
        {analytics.stockHealth.total.toLocaleString("en-ZA")} stock lines (
        {pct((analytics.stockHealth.negative / analytics.stockHealth.total) * 100, 0)}) currently
        show a negative quantity in MySalon, which happens when sales are rung up against stock
        that was never received. The figures below are exactly as they stand today. A receiving
        step at delivery, plus a first stock take, is what turns this into a number you can trust.
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => {
                setTab(t.value);
                setBrand("all");
              }}
              aria-pressed={tab === t.value}
              className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                tab === t.value
                  ? "bg-taupe font-semibold text-white"
                  : "bg-chip text-taupe-deep hover:bg-hairline"
              }`}
            >
              {t.label}
              {t.value === "order" && (
                <span className="ml-1.5 opacity-80">
                  {[...products.retail, ...products.backbar].filter(
                    (p) => p.lowStock || p.needsCount
                  ).length}
                </span>
              )}
            </button>
          ))}
        </div>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search or scan barcode…"
          className="w-full rounded border border-hairline bg-card px-3 py-2 text-sm text-ink placeholder:text-mutedink sm:w-64"
        />

        {tab !== "order" && (
          <select
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            aria-label="Filter by brand"
            className="rounded border border-hairline bg-card px-2 py-2 text-sm text-ink"
          >
            {brands.map((b) => (
              <option key={b} value={b}>
                {b === "all" ? "All brands" : b}
              </option>
            ))}
          </select>
        )}
      </div>

      {tab === "order" ? (
        <div className="flex flex-col gap-4">
          {orderByVendor.map(([vendor, items]) => (
            <Card key={vendor}>
              <div className="flex items-center justify-between gap-3 border-b border-hairline-soft px-4 py-3">
                <h2 className="text-sm font-semibold text-ink">
                  {vendor}{" "}
                  <span className="font-normal text-mutedink">
                    · {items.length} line{items.length === 1 ? "" : "s"}
                  </span>
                </h2>
                <button
                  type="button"
                  className="rounded border border-taupe px-2.5 py-1 text-xs font-semibold text-taupe-deep hover:bg-chip"
                >
                  Create order
                </button>
              </div>
              <TableScroll>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-hairline-soft text-left text-[11px] uppercase tracking-[0.08em] text-mutedink">
                      <th className="px-4 py-2 font-semibold">Item</th>
                      <th className="px-4 py-2 text-right font-semibold">On hand</th>
                      <th className="px-4 py-2 text-right font-semibold">Reorder at</th>
                      <th className="px-4 py-2 text-right font-semibold">Suggest</th>
                      <th className="px-4 py-2 text-right font-semibold">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.slice(0, 12).map((p) => (
                      <tr key={p.id} className="border-b border-hairline-soft last:border-0">
                        <td className="px-4 py-2 text-body">{p.name}</td>
                        <td className="tnum px-4 py-2 text-right">
                          {p.needsCount ? (
                            <Badge tone="crit">count</Badge>
                          ) : (
                            <span className="text-body">{p.qty}</span>
                          )}
                        </td>
                        <td className="tnum px-4 py-2 text-right text-mutedink">{p.reorder}</td>
                        <td className="tnum px-4 py-2 text-right font-semibold text-ink">
                          {Math.max(1, p.reorder * 2 - Math.max(0, p.qty))}
                        </td>
                        <td className="tnum px-4 py-2 text-right text-mutedink">{zar(p.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
              {items.length > 12 && (
                <p className="px-4 py-2 text-xs text-mutedink">
                  + {items.length - 12} more from this supplier
                </p>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <TableScroll>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-[0.08em] text-mutedink">
                  <th className="px-4 py-2.5 font-semibold">Item</th>
                  <th className="px-4 py-2.5 font-semibold">Brand</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Cost</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Sells for</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Margin</th>
                  <th className="px-4 py-2.5 text-right font-semibold">On hand</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr
                    key={p.id}
                    className={`border-b border-hairline-soft last:border-0 ${
                      p.needsCount ? "bg-crit-soft/40" : p.lowStock ? "bg-warn-soft/40" : ""
                    }`}
                  >
                    <td className="px-4 py-2.5 text-body">
                      {p.name}
                      {p.barcode && (
                        <span className="tnum block text-[11px] text-mutedink">{p.barcode}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-mutedink">{p.brand}</td>
                    <td className="tnum px-4 py-2.5 text-right text-mutedink">{zar(p.cost)}</td>
                    <td className="tnum px-4 py-2.5 text-right font-semibold text-ink">
                      {zar(p.price)}
                    </td>
                    <td className="tnum px-4 py-2.5 text-right text-body">
                      {p.margin !== null ? `${p.margin}%` : "—"}
                    </td>
                    <td className="tnum px-4 py-2.5 text-right">
                      {p.needsCount ? (
                        <Badge tone="crit">needs count</Badge>
                      ) : p.lowStock ? (
                        <Badge tone="warn">{p.qty} low</Badge>
                      ) : (
                        <span className="text-body">{p.qty}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
          {rows.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-mutedink">Nothing matches.</p>
          )}
        </Card>
      )}
    </>
  );
}
