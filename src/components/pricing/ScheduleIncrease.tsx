"use client";

import { useMemo, useState } from "react";
import { products, services } from "@/lib/data";
import { zar } from "@/lib/format";

interface ScheduleIncreaseProps {
  scope: "services" | "retail";
  dept?: string;
  vendor?: string;
  onClose: () => void;
}

/** Rounds to the nearest R5, the way a salon actually prices. */
const roundTo5 = (value: number) => Math.round(value / 5) * 5;

export function ScheduleIncrease({ scope, dept, vendor, onClose }: ScheduleIncreaseProps) {
  const [percent, setPercent] = useState("8");
  const [effective, setEffective] = useState("2027-01-01");
  const [round, setRound] = useState(true);

  const pct = Number(percent) || 0;

  const rows = useMemo(() => {
    const source =
      scope === "services"
        ? services.filter((s) => !dept || s.dept === dept).map((s) => ({ name: s.name, price: s.price }))
        : products.retail
            .filter((p) => !vendor || p.brand === vendor)
            .map((p) => ({ name: p.name, price: p.price }));
    return source.slice(0, 8).map((r) => {
      const raw = r.price * (1 + pct / 100);
      return { ...r, next: round ? roundTo5(raw) : Math.round(raw * 100) / 100 };
    });
  }, [scope, dept, vendor, pct, round]);

  const scopeLabel =
    scope === "services" ? `${dept ?? "all"} services` : `${vendor ?? "all"} retail`;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-label="Schedule a price increase"
    >
      <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-lg border border-hairline bg-card">
        <div className="flex items-center justify-between border-b border-hairline px-5 py-3.5">
          <h2 className="text-base font-semibold text-ink">Schedule an increase</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-mutedink hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-wrap gap-3 border-b border-hairline-soft px-5 py-4">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-mutedink">
              Increase by
            </span>
            <span className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                max={100}
                step="0.5"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                className="tnum w-20 rounded border border-hairline bg-paper px-2 py-1.5 text-sm text-ink"
              />
              <span className="text-sm text-body">%</span>
            </span>
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-mutedink">
              Effective from
            </span>
            <input
              type="date"
              value={effective}
              onChange={(e) => setEffective(e.target.value)}
              className="rounded border border-hairline bg-paper px-2 py-1.5 text-sm text-ink"
            />
          </label>

          <label className="flex items-end gap-2 pb-1.5 text-sm text-body">
            <input
              type="checkbox"
              checked={round}
              onChange={(e) => setRound(e.target.checked)}
              className="h-4 w-4 accent-[#6e6455]"
            />
            Round to the nearest R5
          </label>
        </div>

        <p className="px-5 pt-3 text-xs text-mutedink">
          Applies to <strong className="text-ink">{scopeLabel}</strong>. Here is how the first few
          would change:
        </p>

        <table className="w-full px-5 text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-b border-hairline-soft last:border-0">
                <td className="py-2 pl-5 pr-2 text-ink">{r.name}</td>
                <td className="tnum py-2 pr-2 text-right text-mutedink">{zar(r.price)}</td>
                <td className="py-2 pr-2 text-center text-taupe">→</td>
                <td className="tnum py-2 pr-5 text-right font-semibold text-ink">{zar(r.next)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex items-center justify-between gap-3 border-t border-hairline px-5 py-4">
          <p className="text-[11px] text-mutedink">
            Nothing changes in the prototype — this shows the flow.
          </p>
          <span className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-3 py-2 text-sm text-mutedink hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled
              title="Not available in the prototype"
              className="cursor-not-allowed rounded bg-hairline px-4 py-2 text-sm font-semibold text-mutedink"
            >
              Schedule for {effective}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
