"use client";

import { useMemo, useState } from "react";
import { clients, getStaff, meta } from "@/lib/data";
import { relativeToDemo, zar0 } from "@/lib/format";
import { Badge } from "@/components/ui";

interface ClientPickerProps {
  clientId: number | null;
  clientName: string | null;
  onPick: (client: { id: number | null; name: string }) => void;
}

export function ClientPicker({ clientId, clientName, onPick }: ClientPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const digits = q.replace(/\D/g, "");
    return clients
      .filter((c) => {
        if (c.name.toLowerCase().includes(q)) return true;
        return digits.length >= 3 && c.tel.replace(/\D/g, "").includes(digits);
      })
      .slice(0, 8);
  }, [query]);

  const selected = clientId != null ? clients.find((c) => c.id === clientId) : undefined;

  if (clientName) {
    return (
      <div className="flex items-start justify-between gap-3 rounded border border-hairline bg-card p-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-semibold text-ink">{clientName}</p>
            {selected?.vip && <Badge tone="accent">VIP</Badge>}
            {selected?.medical && <Badge tone="crit">Medical</Badge>}
            {selected?.lapsed && <Badge tone="warn">Lapsed</Badge>}
          </div>
          {selected ? (
            <p className="mt-0.5 text-xs text-mutedink">
              {selected.visitCount} visits · {zar0(selected.lifetimeSpend)} lifetime · last seen{" "}
              {relativeToDemo(selected.lastVisit, meta.demoDate)}
              {selected.prefStylistId
                ? ` · usually ${getStaff(selected.prefStylistId)?.name ?? "—"}`
                : ""}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-mutedink">Walk-in — no client file</p>
          )}
          {selected?.medical && (
            <p className="mt-1.5 rounded bg-crit-soft px-2 py-1 text-xs text-crit">
              {selected.medical}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            onPick({ id: null, name: "" });
            setQuery("");
            setOpen(false);
          }}
          className="shrink-0 text-xs text-taupe-deep underline underline-offset-2"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-mutedink">
          Client
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search name or phone…"
          className="w-full rounded border border-hairline bg-card px-3 py-2.5 text-sm text-ink placeholder:text-mutedink"
        />
      </label>

      <button
        type="button"
        onClick={() => onPick({ id: null, name: "Walk-in" })}
        className="mt-2 text-xs text-taupe-deep underline underline-offset-2"
      >
        Ring up as walk-in
      </button>

      {open && matches.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded border border-hairline bg-card shadow-lg">
          {matches.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  onPick({ id: c.id, name: c.name });
                  setQuery("");
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-hairline-soft"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm text-ink">{c.name}</span>
                  <span className="block text-xs text-mutedink">
                    {c.tel} · {c.visitCount} visits
                  </span>
                </span>
                <span className="shrink-0 text-xs text-mutedink">
                  {relativeToDemo(c.lastVisit, meta.demoDate)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
