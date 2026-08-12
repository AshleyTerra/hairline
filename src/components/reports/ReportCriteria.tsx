"use client";

import { staff } from "@/lib/data";
import { reportsFrom } from "@/lib/salesSource";
import { meta } from "@/lib/data";

export type ReportKind = "staffTurnover" | "dailyStaffTurnover";

export const REPORTS: { key: ReportKind; label: string; blurb: string }[] = [
  {
    key: "staffTurnover",
    label: "Staff turnover report",
    blurb: "One row per staff member — services, retail and salon stock, for checking wages.",
  },
  {
    key: "dailyStaffTurnover",
    label: "Daily staff turnover",
    blurb: "One row per trading day for a single staff member.",
  },
];

interface ReportCriteriaProps {
  kind: ReportKind;
  onKind: (kind: ReportKind) => void;
  from: string;
  to: string;
  onFrom: (date: string) => void;
  onTo: (date: string) => void;
  /** Multi-select for the staff report. */
  selected: number[];
  onSelected: (ids: number[]) => void;
  /** Single select for the daily report. */
  single: number;
  onSingle: (id: number) => void;
  error?: string | null;
}

/**
 * The criteria bar, following the Reports dialog Karin sent: report type, the
 * dates to report between, and the staff to report on.
 */
export function ReportCriteria({
  kind,
  onKind,
  from,
  to,
  onFrom,
  onTo,
  selected,
  onSelected,
  single,
  onSingle,
  error,
}: ReportCriteriaProps) {
  const reportable = staff.filter((s) => s.role !== "reception");
  const multi = kind === "staffTurnover";

  const field = "rounded border border-hairline bg-paper px-2.5 py-1.5 text-sm text-ink";

  return (
    <div className="no-print mb-4 rounded border border-hairline bg-card">
      <div className="border-b border-hairline-soft px-4 py-3">
        <p className="text-xs text-mutedink">
          Choose the report, then the dates to report between and the staff to report on.
        </p>
      </div>

      <div className="flex flex-wrap items-start gap-4 px-4 py-4">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-mutedink">
            Report
          </span>
          <select
            value={kind}
            onChange={(e) => onKind(e.target.value as ReportKind)}
            aria-label="Report type"
            className={`${field} min-w-56`}
          >
            {REPORTS.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-mutedink">
            Start date
          </span>
          <input
            type="date"
            value={from}
            min={reportsFrom}
            max={meta.demoDate}
            onChange={(e) => onFrom(e.target.value)}
            aria-label="Start date"
            className={field}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-mutedink">
            End date
          </span>
          <input
            type="date"
            value={to}
            min={reportsFrom}
            max={meta.demoDate}
            onChange={(e) => onTo(e.target.value)}
            aria-label="End date"
            className={field}
          />
        </label>

        {multi ? (
          <div className="min-w-64">
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mutedink">
                Staff
              </span>
              <span className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onSelected(reportable.map((s) => s.id))}
                  className="text-[11px] font-semibold text-taupe-deep underline underline-offset-2"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => onSelected([])}
                  className="text-[11px] font-semibold text-mutedink underline underline-offset-2"
                >
                  Deselect all
                </button>
              </span>
            </div>
            <ul className="max-h-40 overflow-y-auto rounded border border-hairline bg-paper px-2 py-1.5">
              {reportable.map((s) => (
                <li key={s.id}>
                  <label className="flex items-center gap-2 py-0.5 text-sm text-body">
                    <input
                      type="checkbox"
                      checked={selected.includes(s.id)}
                      onChange={(e) =>
                        onSelected(
                          e.target.checked
                            ? [...selected, s.id]
                            : selected.filter((id) => id !== s.id)
                        )
                      }
                      aria-label={s.name}
                      className="h-3.5 w-3.5 accent-[#6e6455]"
                    />
                    <span className="tnum text-mutedink">{s.id}</span>
                    {s.name}
                    {s.role === "assistant" && (
                      <span className="text-[11px] text-mutedink">(assistant)</span>
                    )}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-mutedink">
              Staff
            </span>
            <select
              value={single}
              onChange={(e) => onSingle(Number(e.target.value))}
              aria-label="Staff member"
              className={`${field} min-w-56`}
            >
              {reportable.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id} {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {error && (
        <p role="alert" className="border-t border-hairline-soft bg-crit-soft px-4 py-2 text-xs text-crit">
          {error}
        </p>
      )}
    </div>
  );
}
