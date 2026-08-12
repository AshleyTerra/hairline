"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface PickItem {
  /** Stable key: a staff id, a department name, an item description. */
  id: string | number;
  label: string;
  note?: string;
}

interface MultiSelectProps {
  items: readonly PickItem[];
  selected: (string | number)[];
  onChange: (ids: (string | number)[]) => void;
  /** Accessible name, also used on the closed control. */
  name: string;
  allLabel?: string;
  emptyLabel?: string;
  /** Long lists get a search box. */
  searchable?: boolean;
  /** Treat an empty selection as "everything", which some filters prefer. */
  emptyMeansAll?: boolean;
}

/**
 * A dropdown holding a checkbox list, so a criteria row stays one line tall.
 * Closed it summarises the choice; open it offers Select all and Deselect all.
 */
export function MultiSelect({
  items,
  selected,
  onChange,
  name,
  allLabel = "All",
  emptyLabel = "None chosen",
  searchable = false,
  emptyMeansAll = false,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.label.toLowerCase().includes(q));
  }, [items, query]);

  const all = items.length > 0 && selected.length === items.length;
  const none = selected.length === 0;
  const summary = all
    ? `${allLabel} (${items.length})`
    : none
      ? emptyMeansAll
        ? `${allLabel} (${items.length})`
        : emptyLabel
      : selected.length === 1
        ? (items.find((i) => i.id === selected[0])?.label ?? "1 selected")
        : `${selected.length} of ${items.length} selected`;

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={name}
        className="flex min-w-52 max-w-64 items-center justify-between gap-3 rounded border border-hairline bg-paper px-2.5 py-1.5 text-left text-sm text-ink hover:border-taupe"
      >
        <span className={`truncate ${none && !emptyMeansAll ? "text-crit" : ""}`}>{summary}</span>
        <span aria-hidden="true" className="shrink-0 text-mutedink">
          ▾
        </span>
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-1 w-80 rounded border border-hairline bg-card shadow-lg">
          <div className="flex items-center justify-between gap-2 border-b border-hairline-soft px-3 py-2">
            <button
              type="button"
              onClick={() => onChange(items.map((i) => i.id))}
              className="text-[11px] font-semibold uppercase tracking-[0.08em] text-taupe-deep underline underline-offset-2"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-[11px] font-semibold uppercase tracking-[0.08em] text-mutedink underline underline-offset-2"
            >
              Deselect all
            </button>
          </div>

          {searchable && (
            <div className="border-b border-hairline-soft px-3 py-2">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${name.toLowerCase()}…`}
                aria-label={`Search ${name}`}
                className="w-full rounded border border-hairline bg-paper px-2 py-1 text-xs text-ink placeholder:text-mutedink"
              />
            </div>
          )}

          <ul className="max-h-64 overflow-y-auto py-1">
            {shown.length === 0 ? (
              <li className="px-3 py-4 text-center text-xs text-mutedink">Nothing matches.</li>
            ) : (
              shown.map((item) => (
                <li key={item.id}>
                  <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-body hover:bg-paper">
                    <input
                      type="checkbox"
                      checked={selected.includes(item.id)}
                      onChange={(e) =>
                        onChange(
                          e.target.checked
                            ? [...selected, item.id]
                            : selected.filter((x) => x !== item.id)
                        )
                      }
                      aria-label={item.label}
                      className="h-3.5 w-3.5 shrink-0 accent-[#6e6455]"
                    />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.note && (
                      <span className="shrink-0 text-[11px] text-mutedink">{item.note}</span>
                    )}
                  </label>
                </li>
              ))
            )}
          </ul>

          <div className="border-t border-hairline-soft px-3 py-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full rounded bg-chip px-3 py-1.5 text-xs font-semibold text-taupe-deep hover:bg-hairline"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
