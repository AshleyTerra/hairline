"use client";

import { useEffect, useRef, useState } from "react";

export interface SelectItem {
  id: number;
  label: string;
  note?: string;
}

interface StaffSelectProps {
  items: readonly SelectItem[];
  selected: number[];
  onChange: (ids: number[]) => void;
  /** Shown on the closed control when nothing is chosen. */
  emptyLabel?: string;
  allLabel?: string;
}

/**
 * A dropdown that holds the checkbox list, so the criteria row stays one line
 * tall. Closed, it summarises the choice; open, it offers Select all.
 */
export function StaffSelect({
  items,
  selected,
  onChange,
  emptyLabel = "No staff chosen",
  allLabel = "All staff",
}: StaffSelectProps) {
  const [open, setOpen] = useState(false);
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

  const all = items.length > 0 && selected.length === items.length;
  const summary = all
    ? `${allLabel} (${items.length})`
    : selected.length === 0
      ? emptyLabel
      : selected.length === 1
        ? (items.find((i) => i.id === selected[0])?.label ?? "1 selected")
        : `${selected.length} of ${items.length} selected`;

  function toggle(id: number, on: boolean) {
    onChange(on ? [...selected, id] : selected.filter((x) => x !== id));
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Staff"
        className="flex min-w-56 items-center justify-between gap-3 rounded border border-hairline bg-paper px-2.5 py-1.5 text-left text-sm text-ink hover:border-taupe"
      >
        <span className={selected.length === 0 ? "text-crit" : ""}>{summary}</span>
        <span aria-hidden="true" className="text-mutedink">
          ▾
        </span>
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-1 w-72 rounded border border-hairline bg-card shadow-lg">
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

          <ul className="max-h-64 overflow-y-auto py-1">
            {items.map((item) => (
              <li key={item.id}>
                <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-body hover:bg-paper">
                  <input
                    type="checkbox"
                    checked={selected.includes(item.id)}
                    onChange={(e) => toggle(item.id, e.target.checked)}
                    aria-label={item.label}
                    className="h-3.5 w-3.5 accent-[#6e6455]"
                  />
                  <span className="tnum w-6 shrink-0 text-mutedink">{item.id}</span>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.note && (
                    <span className="shrink-0 text-[11px] text-mutedink">{item.note}</span>
                  )}
                </label>
              </li>
            ))}
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
