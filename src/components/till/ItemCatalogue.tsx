"use client";

import { useMemo, useState } from "react";
import { products, serviceDepts, services } from "@/lib/data";
import { zar } from "@/lib/format";
import type { Product, Service } from "@/lib/types";

interface ItemCatalogueProps {
  onAddService: (service: Service) => void;
  onAddProduct: (product: Product) => void;
  /** Text typed into the top bar, which filters both tabs. */
  query?: string;
}

type Tab = "services" | "retail";

export function ItemCatalogue({ onAddService, onAddProduct, query = "" }: ItemCatalogueProps) {
  const [tab, setTab] = useState<Tab>("services");
  const [dept, setDept] = useState<string>(serviceDepts[0] ?? "");

  const q = query.trim().toLowerCase();

  const shownServices = useMemo(() => {
    if (q) return services.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 40);
    return services.filter((s) => s.dept === dept);
  }, [dept, q]);

  const shownProducts = useMemo(() => {
    if (!q) return products.till.slice(0, 40);
    return products.till
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          (p.barcode ?? "").includes(q)
      )
      .slice(0, 40);
  }, [q]);

  const empty =
    (tab === "services" && shownServices.length === 0) ||
    (tab === "retail" && shownProducts.length === 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3.5">
      {/* Departments wrap so reception sees every one — no hidden scroll */}
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="mr-1 flex gap-1">
          {(["services", "retail"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-pressed={tab === t}
              className={`rounded-full px-[18px] py-2 text-[13px] font-semibold capitalize transition-colors ${
                tab === t ? "bg-white text-ink" : "bg-canvas text-taupe-deep hover:bg-chip"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "services" &&
          !q &&
          serviceDepts.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDept(d)}
              aria-pressed={dept === d}
              className={`whitespace-nowrap rounded-full border px-3 py-[5px] text-[12.5px] font-semibold transition-colors ${
                dept === d
                  ? "border-ink bg-ink text-white"
                  : "border-edge-soft bg-white text-taupe-deep hover:border-taupe"
              }`}
            >
              {d}
            </button>
          ))}
      </div>

      {/* Tile grid */}
      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {/* Tracks the column's own width, so it reaches 4-up whenever there is room */}
        <div
          className="grid gap-[7px]"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(172px, 1fr))" }}
        >
          {tab === "services"
            ? shownServices.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onAddService(s)}
                  className="flex min-h-[72px] min-w-0 flex-col justify-between rounded-[10px] border border-edge-soft bg-white px-[11px] py-2.5 text-left shadow-[0_1px_2px_rgba(26,24,22,.03)] transition-colors hover:border-taupe active:bg-chip"
                >
                  <span className="text-[13px] leading-[1.3] text-ink">{s.name}</span>
                  <span className="mt-2 flex items-baseline justify-between gap-1.5">
                    <span className="text-[10.5px] text-faintink">{s.mins} min</span>
                    <span className="tnum text-[16px] font-semibold tracking-[-0.01em] text-ink">
                      {zar(s.price)}
                    </span>
                  </span>
                </button>
              ))
            : shownProducts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onAddProduct(p)}
                  className="flex min-h-[72px] min-w-0 flex-col justify-between rounded-[10px] border border-edge-soft bg-white px-[11px] py-2.5 text-left shadow-[0_1px_2px_rgba(26,24,22,.03)] transition-colors hover:border-taupe active:bg-chip"
                >
                  <span className="text-[13px] leading-[1.3] text-ink">{p.name}</span>
                  <span className="mt-2 flex items-baseline justify-between gap-1.5">
                    <span className="truncate text-[10.5px] text-faintink">
                      {p.brand} · {p.qty > 0 ? `${p.qty} on hand` : "not in stock"}
                    </span>
                    <span className="tnum shrink-0 text-[16px] font-semibold tracking-[-0.01em] text-ink">
                      {zar(p.price)}
                    </span>
                  </span>
                </button>
              ))}
        </div>

        {empty && (
          <p className="px-2 py-10 text-center text-[14px] text-faintink">
            Nothing matches “{query}”.
          </p>
        )}
      </div>
    </div>
  );
}
