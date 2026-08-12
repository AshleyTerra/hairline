"use client";

import { useMemo, useState } from "react";
import { PageHeader, Card, TableScroll } from "@/components/ui";
import { REPORTS, ReportCriteria, type ReportKind } from "@/components/reports/ReportCriteria";
import { earningStylists, getStaff, meta, staff } from "@/lib/data";
import { longDate, zar } from "@/lib/format";
import {
  downloadTableCsv,
  downloadXlsx,
  printReport,
  reportFilename,
} from "@/lib/exportFile";
import { staffTurnover, sumRows, turnoverByDate } from "@/lib/reports";
import { salesBetween } from "@/lib/salesSource";
import { useStore } from "@/lib/store";

/** A fortnight back from the demo day is a sensible default period. */
const defaultFrom = (() => {
  const d = new Date(`${meta.demoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 13);
  return d.toISOString().slice(0, 10);
})();

const CATEGORIES = [
  { key: "services", label: "Services" },
  { key: "retail", label: "Retail" },
  { key: "stock", label: "Salon stock" },
  { key: "total", label: "Total" },
] as const;

export default function ReportsPage() {
  const { invoices } = useStore();
  const [kind, setKind] = useState<ReportKind>("staffTurnover");
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(meta.demoDate);
  const [selected, setSelected] = useState<number[]>(() =>
    staff.filter((s) => s.role !== "reception").map((s) => s.id)
  );
  const [single, setSingle] = useState<number>(earningStylists[0]?.id ?? 1);

  const badDates = from > to;
  const noStaff = kind === "staffTurnover" && selected.length === 0;
  const error = badDates
    ? "The start date is after the end date."
    : noStaff
      ? "Choose at least one staff member."
      : null;

  const sales = useMemo(
    () => (error ? [] : salesBetween(from, to, invoices)),
    [from, to, invoices, error]
  );

  const staffRows = useMemo(
    () => (kind === "staffTurnover" ? staffTurnover(sales, selected) : []),
    [kind, sales, selected]
  );
  const dailyRows = useMemo(
    () => (kind === "dailyStaffTurnover" ? turnoverByDate(sales, single) : []),
    [kind, sales, single]
  );

  const rows = kind === "staffTurnover" ? staffRows : dailyRows;
  const totals = useMemo(() => sumRows(rows), [rows]);

  const report = REPORTS.find((r) => r.key === kind);
  const period = from === to ? longDate(from) : `${longDate(from)} to ${longDate(to)}`;
  const subject =
    kind === "dailyStaffTurnover" ? (getStaff(single)?.name ?? "Staff member") : "All selected staff";

  /** Flat rows for exporting, with the same numbers as the table. */
  const exportRows = useMemo(
    () =>
      kind === "staffTurnover"
        ? staffRows.map((r) => ({
            label: `${r.stylistId} ${getStaff(r.stylistId)?.name ?? ""}`.trim(),
            servicesEx: r.exVat.services,
            servicesIncl: r.inclVat.services,
            retailEx: r.exVat.retail,
            retailIncl: r.inclVat.retail,
            stockEx: r.exVat.stock,
            stockIncl: r.inclVat.stock,
            totalEx: r.exVat.total,
            totalIncl: r.inclVat.total,
          }))
        : dailyRows.map((r) => ({
            label: r.date,
            servicesEx: r.exVat.services,
            servicesIncl: r.inclVat.services,
            retailEx: r.exVat.retail,
            retailIncl: r.inclVat.retail,
            stockEx: r.exVat.stock,
            stockIncl: r.inclVat.stock,
            totalEx: r.exVat.total,
            totalIncl: r.inclVat.total,
          })),
    [kind, staffRows, dailyRows]
  );

  const exportColumns = [
    { key: "label" as const, label: kind === "staffTurnover" ? "Staff" : "Date" },
    { key: "servicesEx" as const, label: "Services (excl VAT)" },
    { key: "servicesIncl" as const, label: "Services (incl VAT)" },
    { key: "retailEx" as const, label: "Retail (excl VAT)" },
    { key: "retailIncl" as const, label: "Retail (incl VAT)" },
    { key: "stockEx" as const, label: "Salon stock (excl VAT)" },
    { key: "stockIncl" as const, label: "Salon stock (incl VAT)" },
    { key: "totalEx" as const, label: "Total (excl VAT)" },
    { key: "totalIncl" as const, label: "Total (incl VAT)" },
  ];

  const slug = kind === "staffTurnover" ? "staff-turnover" : "daily-staff-turnover";

  return (
    <>
      <PageHeader
        eyebrow="Reports"
        title="Reports"
        subtitle="Built from the same sales the till and cash-up use."
      />

      <ReportCriteria
        kind={kind}
        onKind={setKind}
        from={from}
        to={to}
        onFrom={setFrom}
        onTo={setTo}
        selected={selected}
        onSelected={setSelected}
        single={single}
        onSingle={setSingle}
        error={error}
      />

      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={printReport}
          disabled={!!error}
          className="rounded bg-taupe-deep px-4 py-2 text-sm font-semibold text-white hover:bg-ink disabled:opacity-40"
        >
          Print / save as PDF
        </button>
        <button
          type="button"
          disabled={!!error}
          onClick={() =>
            downloadXlsx(reportFilename(slug, from, to, "xlsx"), [
              {
                name: report?.label ?? "Report",
                rows: exportRows,
                columns: exportColumns,
                heading: [
                  `${report?.label ?? "Report"} — Hairline`,
                  `${period}${kind === "dailyStaffTurnover" ? ` · ${subject}` : ""}`,
                  `Created ${longDate(meta.demoDate)}`,
                ],
              },
            ])
          }
          className="rounded border border-taupe px-4 py-2 text-sm font-semibold text-taupe-deep hover:bg-chip disabled:opacity-40"
        >
          Excel
        </button>
        <button
          type="button"
          disabled={!!error}
          onClick={() =>
            downloadTableCsv(reportFilename(slug, from, to, "csv"), exportRows, exportColumns)
          }
          className="rounded border border-hairline px-4 py-2 text-sm font-semibold text-mutedink hover:text-ink disabled:opacity-40"
        >
          CSV
        </button>
        <p className="ml-auto text-xs text-mutedink">
          {sales.length.toLocaleString("en-ZA")} sales in this period
        </p>
      </div>

      {/* The printed report starts here */}
      <Card className="print:border-0">
        <header className="border-b border-hairline px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.06em] text-ink">
            {report?.label}
            {kind === "dailyStaffTurnover" ? ` — ${subject}` : ""}
          </h2>
          <p className="text-xs text-mutedink">
            Hairline · {period} · created {longDate(meta.demoDate)}
          </p>
        </header>

        <TableScroll>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline text-[11px] uppercase tracking-[0.06em] text-mutedink">
                <th className="px-4 py-2.5 text-left font-semibold">
                  {kind === "staffTurnover" ? "Staff" : "Date"}
                </th>
                {CATEGORIES.map((c) => (
                  <th key={c.key} colSpan={2} className="px-4 py-2.5 text-center font-semibold">
                    {c.label}
                  </th>
                ))}
              </tr>
              <tr className="border-b border-hairline text-[10px] uppercase tracking-[0.06em] text-mutedink">
                <th />
                {CATEGORIES.flatMap((c) => [
                  <th key={`${c.key}-ex`} className="px-4 py-1.5 text-right font-normal">
                    excl VAT
                  </th>,
                  <th key={`${c.key}-in`} className="px-4 py-1.5 text-right font-normal">
                    incl VAT
                  </th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-mutedink">
                    {error ?? "No sales in this period."}
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const label =
                    "stylistId" in r
                      ? `${r.stylistId} ${getStaff(r.stylistId)?.name ?? ""}`.trim()
                      : longDate(r.date);
                  return (
                    <tr
                      key={"stylistId" in r ? r.stylistId : r.date}
                      className="border-b border-hairline-soft last:border-0"
                    >
                      <td className="px-4 py-2 text-ink">{label}</td>
                      {CATEGORIES.flatMap((c) => [
                        <td key={`${c.key}-ex`} className="tnum px-4 py-2 text-right text-mutedink">
                          {zar(r.exVat[c.key])}
                        </td>,
                        <td
                          key={`${c.key}-in`}
                          className={`tnum px-4 py-2 text-right ${
                            c.key === "total" ? "font-semibold text-ink" : "text-ink"
                          }`}
                        >
                          {zar(r.inclVat[c.key])}
                        </td>,
                      ])}
                    </tr>
                  );
                })
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-hairline font-semibold text-ink">
                  <td className="px-4 py-2.5">Total</td>
                  {CATEGORIES.flatMap((c) => [
                    <td key={`${c.key}-ex`} className="tnum px-4 py-2.5 text-right">
                      {zar(totals.exVat[c.key])}
                    </td>,
                    <td key={`${c.key}-in`} className="tnum px-4 py-2.5 text-right">
                      {zar(totals.inclVat[c.key])}
                    </td>,
                  ])}
                </tr>
              </tfoot>
            )}
          </table>
        </TableScroll>
      </Card>
    </>
  );
}
