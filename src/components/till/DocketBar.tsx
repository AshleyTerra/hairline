"use client";

import { docketTotal, type Docket } from "@/lib/dockets";
import { zar0 } from "@/lib/format";

interface DocketBarProps {
  dockets: Docket[];
  activeNumber: number | null;
  onOpen: (number: number) => void;
  onNew: () => void;
}

/**
 * Today's open dockets. Reception starts one per client as they arrive — often
 * before the work begins — and comes back to it at the counter.
 */
export function DocketBar({ dockets, activeNumber, onOpen, onNew }: DocketBarProps) {
  return (
    <div className="shrink-0">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[10.5px] uppercase tracking-[0.1em] text-faintink">
          Clients today {dockets.length > 0 && `· ${dockets.length} open`}
        </p>
        <button
          type="button"
          onClick={onNew}
          className="text-[11.5px] font-semibold text-taupe transition-colors hover:text-taupe-deep"
        >
          + New docket
        </button>
      </div>

      {dockets.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-edge bg-white/60 px-3 py-2 text-[12px] text-faintink">
          No dockets open. Start one per client as they arrive, or just ring up a sale directly.
        </p>
      ) : (
        <ul data-dockets className="flex flex-wrap gap-1.5">
          {dockets.map((d) => {
            const active = d.number === activeNumber;
            const total = docketTotal(d);
            return (
              <li key={d.number}>
                <button
                  type="button"
                  onClick={() => onOpen(d.number)}
                  aria-pressed={active}
                  className={`flex items-center gap-2 rounded-[10px] border px-3 py-1.5 text-left transition-colors ${
                    active
                      ? "border-ink bg-ink text-white"
                      : "border-edge-soft bg-white text-ink hover:border-taupe"
                  }`}
                >
                  <span className="text-[12.5px] font-semibold">
                    {d.state.clientName ?? "Walk-in"}
                  </span>
                  <span
                    className={`tnum text-[11px] ${active ? "text-white/70" : "text-faintink"}`}
                  >
                    #{d.number}
                    {total > 0 ? ` · ${zar0(total)}` : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
