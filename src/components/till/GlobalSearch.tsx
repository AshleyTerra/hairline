"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { clients, meta, products, services } from "@/lib/data";
import { relativeToDemo, zar } from "@/lib/format";
import type { Client, Product, Service } from "@/lib/types";

interface GlobalSearchProps {
  onPickClient: (client: Client) => void;
  onPickService: (service: Service) => void;
  onPickProduct: (product: Product) => void;
  /** Mirrors the query out so the catalogue can filter alongside the dropdown. */
  onQueryChange?: (query: string) => void;
}

const LIMIT = 4;

/** One field for clients, services, products and barcodes. */
export function GlobalSearch({
  onPickClient,
  onPickService,
  onPickProduct,
  onQueryChange,
}: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const q = query.trim().toLowerCase();

  const matches = useMemo(() => {
    if (!q) return { clients: [], services: [], products: [] };
    const digits = q.replace(/\D/g, "");
    return {
      clients: clients
        .filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (digits.length >= 3 && c.tel.replace(/\D/g, "").includes(digits))
        )
        .slice(0, LIMIT),
      services: services.filter((s) => s.name.toLowerCase().includes(q)).slice(0, LIMIT),
      products: products.till
        .filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.brand.toLowerCase().includes(q) ||
            (p.barcode ?? "").includes(q)
        )
        .slice(0, LIMIT),
    };
  }, [q]);

  const total = matches.clients.length + matches.services.length + matches.products.length;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function update(value: string) {
    // A scanned barcode resolves to exactly one product: add it and clear.
    const scanned = value.trim();
    if (scanned.length >= 8 && /^\d+$/.test(scanned)) {
      const hit = products.till.filter((p) => p.barcode === scanned);
      if (hit.length === 1) {
        onPickProduct(hit[0]);
        clear();
        return;
      }
    }
    setQuery(value);
    onQueryChange?.(value);
    setOpen(true);
  }

  function clear() {
    setQuery("");
    onQueryChange?.("");
    setOpen(false);
  }

  /** Enter takes the first result, whichever group it is in. */
  function takeFirst() {
    if (matches.clients[0]) return onPickClient(matches.clients[0]), clear();
    if (matches.services[0]) return onPickService(matches.services[0]), clear();
    if (matches.products[0]) return onPickProduct(matches.products[0]), clear();
  }

  /** Called from the parent to focus the field, e.g. from "Change" on the receipt. */
  useEffect(() => {
    function focusSearch() {
      inputRef.current?.focus();
      setOpen(true);
    }
    window.addEventListener("hairline:focus-search", focusSearch);
    return () => window.removeEventListener("hairline:focus-search", focusSearch);
  }, []);

  return (
    <div ref={boxRef} className="relative w-full max-w-[440px] flex-1">
      <div className="flex items-center gap-2.5 rounded-[11px] bg-canvas px-3.5 py-[11px]">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          className="h-4 w-4 shrink-0 text-faintink"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => update(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              takeFirst();
            }
            if (e.key === "Escape") clear();
          }}
          placeholder="Search client, service or scan a barcode"
          aria-label="Search clients, services and products"
          className="w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-faintink"
        />
      </div>

      {open && q && (
        <div className="absolute z-30 mt-1.5 max-h-[26rem] w-full overflow-y-auto rounded-[11px] border border-edge bg-white shadow-lg">
          {total === 0 && (
            <p className="px-4 py-6 text-center text-[13px] text-faintink">
              Nothing matches “{query}”.
            </p>
          )}

          {matches.clients.length > 0 && (
            <Group label="Clients">
              {matches.clients.map((c) => (
                <Row
                  key={`c${c.id}`}
                  onClick={() => {
                    onPickClient(c);
                    clear();
                  }}
                  title={c.name}
                  meta={`${c.tel} · ${c.visitCount} visits`}
                  right={relativeToDemo(c.lastVisit, meta.demoDate)}
                />
              ))}
            </Group>
          )}

          {matches.services.length > 0 && (
            <Group label="Services">
              {matches.services.map((s) => (
                <Row
                  key={`s${s.id}`}
                  onClick={() => {
                    onPickService(s);
                    clear();
                  }}
                  title={s.name}
                  meta={`${s.dept} · ${s.mins} min`}
                  right={zar(s.price)}
                />
              ))}
            </Group>
          )}

          {matches.products.length > 0 && (
            <Group label="Retail">
              {matches.products.map((p) => (
                <Row
                  key={`p${p.id}`}
                  onClick={() => {
                    onPickProduct(p);
                    clear();
                  }}
                  title={p.name}
                  meta={p.brand}
                  right={zar(p.price)}
                />
              ))}
            </Group>
          )}
        </div>
      )}
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-edge-faint last:border-0">
      <p className="px-4 pb-1 pt-2.5 text-[10.5px] uppercase tracking-[0.1em] text-faintink">
        {label}
      </p>
      {children}
    </div>
  );
}

function Row({
  onClick,
  title,
  meta: metaText,
  right,
}: {
  onClick: () => void;
  title: string;
  meta: string;
  right: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left transition-colors hover:bg-canvas"
    >
      <span className="min-w-0">
        <span className="block truncate text-[13.5px] text-ink">{title}</span>
        <span className="block truncate text-[11.5px] text-faintink">{metaText}</span>
      </span>
      <span className="tnum shrink-0 text-[12px] text-faintink">{right}</span>
    </button>
  );
}
