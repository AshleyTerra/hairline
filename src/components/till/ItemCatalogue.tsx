"use client";

import { useMemo, useState } from "react";
import { products, serviceDepts, services } from "@/lib/data";
import { zar } from "@/lib/format";
import type { Product, Service } from "@/lib/types";

interface ItemCatalogueProps {
  onAddService: (service: Service) => void;
  onAddProduct: (product: Product) => void;
}

type Tab = "services" | "retail";

export function ItemCatalogue({ onAddService, onAddProduct }: ItemCatalogueProps) {
  const [tab, setTab] = useState<Tab>("services");
  const [dept, setDept] = useState<string>(serviceDepts[0] ?? "");
  const [query, setQuery] = useState("");

  const shownServices = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) return services.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 40);
    return services.filter((s) => s.dept === dept);
  }, [dept, query]);

  const shownProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.till.slice(0, 40);
    return products.till
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          (p.barcode ?? "").includes(q)
      )
      .slice(0, 40);
  }, [query]);

  return (
    <div className="rounded border border-hairline bg-card">
      <div className="flex items-center gap-1 border-b border-hairline-soft p-2">
        {(["services", "retail"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              setQuery("");
            }}
            aria-pressed={tab === t}
            className={`rounded px-3 py-1.5 text-sm font-semibold capitalize transition-colors ${
              tab === t ? "bg-taupe text-white" : "text-body hover:bg-hairline-soft"
            }`}
          >
            {t}
          </button>
        ))}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tab === "services" ? "Search services…" : "Search or scan barcode…"}
          className="ml-auto w-40 rounded border border-hairline bg-paper px-2.5 py-1.5 text-sm text-ink placeholder:text-mutedink sm:w-56"
        />
      </div>

      {tab === "services" && !query && (
        <div className="flex gap-1 overflow-x-auto border-b border-hairline-soft px-2 py-2 no-scrollbar">
          {serviceDepts.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDept(d)}
              aria-pressed={dept === d}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-xs transition-colors ${
                dept === d
                  ? "bg-chip font-semibold text-taupe-deep"
                  : "text-mutedink hover:bg-hairline-soft"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      )}

      <div className="max-h-[26rem] overflow-y-auto p-2">
        <div className="grid gap-1.5 sm:grid-cols-2">
          {tab === "services"
            ? shownServices.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onAddService(s)}
                  className="flex items-center justify-between gap-3 rounded border border-hairline-soft px-3 py-2 text-left transition-colors hover:border-taupe hover:bg-chip"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-ink">{s.name}</span>
                    <span className="block text-[11px] text-mutedink">{s.dept}</span>
                  </span>
                  <span className="tnum shrink-0 text-sm font-semibold text-ink">
                    {zar(s.price)}
                  </span>
                </button>
              ))
            : shownProducts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onAddProduct(p)}
                  className="flex items-center justify-between gap-3 rounded border border-hairline-soft px-3 py-2 text-left transition-colors hover:border-taupe hover:bg-chip"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-ink">{p.name}</span>
                    <span className="block text-[11px] text-mutedink">
                      {p.brand}
                      {p.qty > 0 ? ` · ${p.qty} on hand` : " · not in stock"}
                    </span>
                  </span>
                  <span className="tnum shrink-0 text-sm font-semibold text-ink">
                    {zar(p.price)}
                  </span>
                </button>
              ))}
        </div>

        {((tab === "services" && shownServices.length === 0) ||
          (tab === "retail" && shownProducts.length === 0)) && (
          <p className="px-2 py-8 text-center text-sm text-mutedink">
            Nothing matches “{query}”.
          </p>
        )}
      </div>
    </div>
  );
}
