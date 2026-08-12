"use client";

import { useMemo, useState } from "react";
import { products, serviceDepts, services, tillVendors } from "@/lib/data";
import { zar } from "@/lib/format";
import type { Product, Service } from "@/lib/types";

interface ItemCatalogueProps {
  onAddService: (service: Service) => void;
  onAddProduct: (product: Product) => void;
  /** Text typed into the top bar, which filters both tabs. */
  query?: string;
  /** The clients-for-the-day tab, rendered by the parent. */
  clientsTab?: React.ReactNode;
  /** How many dockets are still open, shown on the tab. */
  openDockets?: number;
}

type Tab = "services" | "retail" | "clients";

/**
 * Services and retail as scannable lists, ordered by how often each item is
 * actually rung up. Reception asked for lists rather than tiles: roughly twice
 * as many items fit on screen, and the ones they reach for are at the top.
 */
export function ItemCatalogue({
  onAddService,
  onAddProduct,
  query = "",
  clientsTab,
  openDockets = 0,
}: ItemCatalogueProps) {
  // The till opens on the day's clients — that is where reception starts.
  const [tab, setTab] = useState<Tab>("clients");
  const [dept, setDept] = useState<string>(serviceDepts[0] ?? "");
  const [vendor, setVendor] = useState<string>(tillVendors[0] ?? "");

  const q = query.trim().toLowerCase();

  const shownServices = useMemo(() => {
    if (q) {
      return services
        .filter((s) => s.name.toLowerCase().includes(q))
        .sort((a, b) => b.timesSold - a.timesSold)
        .slice(0, 60);
    }
    return services.filter((s) => s.dept === dept);
  }, [dept, q]);

  const shownProducts = useMemo(() => {
    if (q) {
      return products.till
        .filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.brand.toLowerCase().includes(q) ||
            (p.barcode ?? "").includes(q)
        )
        .slice(0, 60);
    }
    return products.till.filter((p) => p.brand === vendor);
  }, [vendor, q]);

  const empty =
    (tab === "services" && shownServices.length === 0) ||
    (tab === "retail" && shownProducts.length === 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Services / Retail, then the tabs that belong to whichever is showing */}
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        <div className="mr-1 flex gap-1">
          {(["services", "retail", "clients"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-pressed={tab === t}
              className={`rounded-full px-[18px] py-2 text-[13px] font-semibold capitalize transition-colors ${
                tab === t ? "bg-white text-ink shadow-sm" : "bg-canvas text-taupe-deep hover:bg-chip"
              }`}
            >
              {t === "clients" ? "Clients today" : t}
              {t === "clients" && openDockets > 0 && (
                <span className="tnum ml-1.5 rounded-full bg-warn-soft px-1.5 py-0.5 text-[10.5px] text-warn">
                  {openDockets}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab !== "clients" &&
          !q &&
          (tab === "services" ? serviceDepts : tillVendors).map((name) => {
            const active = tab === "services" ? dept === name : vendor === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => (tab === "services" ? setDept(name) : setVendor(name))}
                aria-pressed={active}
                className={`whitespace-nowrap rounded-full border px-3 py-[5px] text-[12.5px] font-semibold transition-colors ${
                  active
                    ? "border-ink bg-ink text-white"
                    : "border-edge-soft bg-white text-taupe-deep hover:border-taupe"
                }`}
              >
                {name}
              </button>
            );
          })}
      </div>

      {tab === "clients" ? (
        clientsTab
      ) : (
      /* The list. Two columns where there is room, so more of it is visible. */
      <div className="min-h-0 flex-1 overflow-y-auto rounded-[10px] border border-edge-soft bg-white">
        {empty ? (
          <p className="px-4 py-10 text-center text-[14px] text-faintink">
            Nothing matches “{query}”.
          </p>
        ) : (
          <ul
            data-catalogue={tab}
            className="grid"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))" }}
          >
            {tab === "services"
              ? shownServices.map((s) => (
                  <li key={s.id} className="border-b border-edge-faint">
                    <button
                      type="button"
                      onClick={() => onAddService(s)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-canvas active:bg-chip"
                    >
                      <span className="min-w-0 text-[13.5px] leading-snug text-ink">{s.name}</span>
                      <span className="tnum shrink-0 text-[14.5px] font-semibold text-ink">
                        {zar(s.price)}
                      </span>
                    </button>
                  </li>
                ))
              : shownProducts.map((p) => (
                  <li key={p.id} className="border-b border-edge-faint">
                    <button
                      type="button"
                      onClick={() => onAddProduct(p)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-canvas active:bg-chip"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] leading-snug text-ink">
                          {p.name}
                        </span>
                        <span className="block text-[11px] text-faintink">
                          {q ? `${p.brand} · ` : ""}
                          {p.qty > 0 ? `${p.qty} on hand` : "not in stock"}
                        </span>
                      </span>
                      <span className="tnum shrink-0 text-[14.5px] font-semibold text-ink">
                        {zar(p.price)}
                      </span>
                    </button>
                  </li>
                ))}
          </ul>
        )}
      </div>
      )}
    </div>
  );
}
