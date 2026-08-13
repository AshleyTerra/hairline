"use client";

import { useMemo } from "react";
import { meta, staff } from "@/lib/data";
import { catalogueDepts, catalogueItems, reportsFrom } from "@/lib/salesSource";
import { useStore } from "@/lib/store";
import { MultiSelect } from "./MultiSelect";

export type ReportKind = "staffTurnover" | "dailyStaffTurnover" | "itemTracking";

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
  {
    key: "itemTracking",
    label: "Item tracking (product & vendor sales)",
    blurb: "Every sale of an item: invoice, date, client, staff, department and quantity.",
  },
];

export interface CriteriaState {
  kind: ReportKind;
  from: string;
  to: string;
  /** Staff turnover: who to report on. */
  selected: number[];
  /** Daily turnover: which staff member. */
  single: number;
  /** Item tracking. */
  depts: string[];
  items: string[];
  stylist: number | null;
  onlyRetail: boolean;
}

interface ReportCriteriaProps {
  state: CriteriaState;
  onChange: (patch: Partial<CriteriaState>) => void;
  error?: string | null;
}

/**
 * The criteria bar, following the Reports and Item Tracking dialogs Karin sent:
 * report type, the dates to report between, and what to report on.
 */
export function ReportCriteria({ state, onChange, error }: ReportCriteriaProps) {
  /**
   * Everyone a report could turn up: the staff records, plus anyone in the
   * migrated history who has no record. The inactive stay on the list and are
   * marked as such — they have left, but their past work is still on the books,
   * which is exactly what a report over last year has to account for.
   */
  const { staffRecords } = useStore();
  const reportable = useMemo(() => {
    const known = new Set(staffRecords.map((r) => r.id));
    const fromRecords = staffRecords.map((r) => ({
      id: r.id,
      name: r.name,
      designation: r.designation,
      active: r.active,
    }));
    const historyOnly = staff
      .filter((s) => !known.has(s.id))
      .map((s) => ({
        id: s.id,
        name: s.name,
        designation: s.role === "assistant" ? "Assistant" : "Stylist",
        active: false,
      }));
    return [...fromRecords, ...historyOnly].filter((s) => !/reception/i.test(s.designation));
  }, [staffRecords]);
  const field = "rounded border border-hairline bg-paper px-2.5 py-1.5 text-sm text-ink";
  const legend =
    "mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-mutedink";

  return (
    <div className="no-print mb-4 rounded border border-hairline bg-card">
      <div className="border-b border-hairline-soft px-4 py-3">
        <p className="text-xs text-mutedink">
          Choose the report, then the dates to report between and what to report on.
        </p>
      </div>

      <div className="flex flex-wrap items-start gap-4 px-4 py-4">
        <label className="block">
          <span className={legend}>Report</span>
          <select
            value={state.kind}
            onChange={(e) => onChange({ kind: e.target.value as ReportKind })}
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
          <span className={legend}>Start date</span>
          <input
            type="date"
            value={state.from}
            min={reportsFrom}
            max={meta.demoDate}
            onChange={(e) => onChange({ from: e.target.value })}
            aria-label="Start date"
            className={field}
          />
        </label>

        <label className="block">
          <span className={legend}>End date</span>
          <input
            type="date"
            value={state.to}
            min={reportsFrom}
            max={meta.demoDate}
            onChange={(e) => onChange({ to: e.target.value })}
            aria-label="End date"
            className={field}
          />
        </label>

        {state.kind === "staffTurnover" && (
          <div className="block">
            <span className={legend}>Staff</span>
            <MultiSelect
              name="Staff"
              allLabel="All staff"
              emptyLabel="No staff chosen"
              items={reportable.map((s) => ({
                id: s.id,
                label: s.name,
                note: s.active
                  ? s.designation.toLowerCase()
                  : `${s.designation.toLowerCase()} · inactive`,
              }))}
              selected={state.selected}
              onChange={(ids) => onChange({ selected: ids.map(Number) })}
            />
          </div>
        )}

        {state.kind === "dailyStaffTurnover" && (
          <label className="block">
            <span className={legend}>Staff</span>
            <select
              value={state.single}
              onChange={(e) => onChange({ single: Number(e.target.value) })}
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

        {state.kind === "itemTracking" && (
          <>
            <div className="block">
              <span className={legend}>Departments</span>
              <MultiSelect
                name="Departments"
                allLabel="All departments"
                emptyMeansAll
                searchable
                items={catalogueDepts.map((d) => ({ id: d, label: d }))}
                selected={state.depts}
                onChange={(ids) => onChange({ depts: ids.map(String) })}
              />
            </div>

            <div className="block">
              <span className={legend}>Items</span>
              <MultiSelect
                name="Items"
                allLabel="All items"
                emptyMeansAll
                searchable
                items={catalogueItems.map((i) => ({ id: i.name, label: i.name, note: i.dept }))}
                selected={state.items}
                onChange={(ids) => onChange({ items: ids.map(String) })}
              />
            </div>

            <label className="block">
              <span className={legend}>Stylist</span>
              <select
                value={state.stylist ?? ""}
                onChange={(e) =>
                  onChange({ stylist: e.target.value === "" ? null : Number(e.target.value) })
                }
                aria-label="Stylist"
                className={field}
              >
                <option value="">All stylists</option>
                {reportable.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id} {s.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-end gap-2 pb-1.5 text-sm text-body">
              <input
                type="checkbox"
                checked={state.onlyRetail}
                onChange={(e) => onChange({ onlyRetail: e.target.checked })}
                aria-label="Products only"
                className="h-4 w-4 accent-[#6e6455]"
              />
              Products only
            </label>
          </>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="border-t border-hairline-soft bg-crit-soft px-4 py-2 text-xs text-crit"
        >
          {error}
        </p>
      )}
    </div>
  );
}
