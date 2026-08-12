"use client";

import { useMemo, useState } from "react";
import { PageHeader, Card, TableScroll } from "@/components/ui";
import {
  REPORTS,
  ReportCriteria,
  type CriteriaState,
} from "@/components/reports/ReportCriteria";
import { earningStylists, getStaff, meta, staff } from "@/lib/data";
import { longDate, shortDate, zar } from "@/lib/format";
import { PrintArea } from "@/components/PrintArea";
import { downloadTableCsv, downloadXlsx, printReport, reportFilename } from "@/lib/exportFile";
import {
  itemTracking,
  itemTrackingTotals,
  staffTurnover,
  sumRows,
  turnoverByDate,
  type LineKind,
} from "@/lib/reports";
import { catalogue, salesBetween } from "@/lib/salesSource";
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

const RETAIL_KINDS: LineKind[] = ["product", "stock"];

export default function ReportsPage() {
  const { invoices } = useStore();
  const [state, setState] = useState<CriteriaState>({
    kind: "staffTurnover",
    from: defaultFrom,
    to: meta.demoDate,
    selected: staff.filter((s) => s.role !== "reception").map((s) => s.id),
    single: earningStylists[0]?.id ?? 1,
    depts: [],
    items: [],
    stylist: null,
    onlyRetail: true,
  });
  const patch = (p: Partial<CriteriaState>) => setState((s) => ({ ...s, ...p }));

  const { kind, from, to } = state;
  const badDates = from > to;
  const noStaff = kind === "staffTurnover" && state.selected.length === 0;
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
    () => (kind === "staffTurnover" ? staffTurnover(sales, state.selected) : []),
    [kind, sales, state.selected]
  );
  const dailyRows = useMemo(
    () => (kind === "dailyStaffTurnover" ? turnoverByDate(sales, state.single) : []),
    [kind, sales, state.single]
  );
  const itemRows = useMemo(
    () =>
      kind === "itemTracking"
        ? itemTracking(sales, catalogue, {
            depts: state.depts,
            descrs: state.items,
            stylistId: state.stylist,
            kinds: state.onlyRetail ? RETAIL_KINDS : [],
          })
        : [],
    [kind, sales, state.depts, state.items, state.stylist, state.onlyRetail]
  );

  const turnoverRows = kind === "staffTurnover" ? staffRows : dailyRows;
  const totals = useMemo(() => sumRows(turnoverRows), [turnoverRows]);
  const itemTotals = useMemo(() => itemTrackingTotals(itemRows), [itemRows]);

  const report = REPORTS.find((r) => r.key === kind);
  const period = from === to ? longDate(from) : `${longDate(from)} to ${longDate(to)}`;
  const subject =
    kind === "dailyStaffTurnover" ? (getStaff(state.single)?.name ?? "Staff member") : "";

  // ------------------------------------------------------------- exporting
  const turnoverExport = useMemo(
    () =>
      (kind === "staffTurnover" ? staffRows : dailyRows).map((r) => ({
        label:
          "stylistId" in r
            ? `${r.stylistId} ${getStaff(r.stylistId)?.name ?? ""}`.trim()
            : r.date,
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

  const turnoverColumns = [
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

  const itemExport = useMemo(
    () =>
      itemRows.map((r) => ({
        invoice: r.invoice,
        date: r.date,
        client: r.client,
        staff: getStaff(r.stylistId)?.name ?? "",
        deptNo: r.deptNo,
        dept: r.dept,
        itemNo: r.itemNo,
        descr: r.descr,
        qty: r.qty,
        price: r.price,
        value: r.value,
      })),
    [itemRows]
  );

  const itemColumns = [
    { key: "invoice" as const, label: "Invoice No." },
    { key: "date" as const, label: "Date" },
    { key: "client" as const, label: "Client" },
    { key: "staff" as const, label: "Staff" },
    { key: "deptNo" as const, label: "Dept" },
    { key: "dept" as const, label: "Department" },
    { key: "itemNo" as const, label: "Item" },
    { key: "descr" as const, label: "Description" },
    { key: "qty" as const, label: "Qty" },
    { key: "price" as const, label: "Price" },
    { key: "value" as const, label: "Line value" },
  ];

  const isItems = kind === "itemTracking";
  const slug =
    kind === "staffTurnover"
      ? "staff-turnover"
      : kind === "dailyStaffTurnover"
        ? "daily-staff-turnover"
        : "item-tracking";
  const heading = [
    `${report?.label ?? "Report"} — Hairline`,
    `${period}${subject ? ` · ${subject}` : ""}`,
    `Created ${longDate(meta.demoDate)}`,
  ];

  const rowCount = isItems ? itemRows.length : turnoverRows.length;

  return (
    <>
      <PageHeader
        eyebrow="Reports"
        title="Reports"
        subtitle="Built from the same sales the till and cash-up use."
      />

      <ReportCriteria state={state} onChange={patch} error={error} />

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
            isItems
              ? downloadXlsx(reportFilename(slug, from, to, "xlsx"), [
                  { name: "Item tracking", rows: itemExport, columns: itemColumns, heading },
                ])
              : downloadXlsx(reportFilename(slug, from, to, "xlsx"), [
                  {
                    name: report?.label ?? "Report",
                    rows: turnoverExport,
                    columns: turnoverColumns,
                    heading,
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
            isItems
              ? downloadTableCsv(reportFilename(slug, from, to, "csv"), itemExport, itemColumns)
              : downloadTableCsv(
                  reportFilename(slug, from, to, "csv"),
                  turnoverExport,
                  turnoverColumns
                )
          }
          className="rounded border border-hairline px-4 py-2 text-sm font-semibold text-mutedink hover:text-ink disabled:opacity-40"
        >
          CSV
        </button>
        <p className="ml-auto text-xs text-mutedink">
          {rowCount.toLocaleString("en-ZA")} {isItems ? "lines" : "rows"} ·{" "}
          {sales.length.toLocaleString("en-ZA")} sales in this period
        </p>
      </div>

      {/* The printed report starts here — and, on paper, nothing else does */}
      <PrintArea landscape>
        <Card className="print:border-0">
        <header className="border-b border-hairline px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.06em] text-ink">
            {report?.label}
            {subject ? ` — ${subject}` : ""}
          </h2>
          <p className="text-xs text-mutedink">
            Hairline · {period} · created {longDate(meta.demoDate)}
          </p>
        </header>

        <TableScroll>
          {isItems ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-[0.06em] text-mutedink">
                  <th className="px-3 py-2.5 font-semibold">Invoice</th>
                  <th className="px-3 py-2.5 font-semibold">Date</th>
                  <th className="px-3 py-2.5 font-semibold">Client</th>
                  <th className="px-3 py-2.5 font-semibold">Staff</th>
                  <th className="px-3 py-2.5 font-semibold">Dept</th>
                  <th className="px-3 py-2.5 font-semibold">Department</th>
                  <th className="px-3 py-2.5 font-semibold">Item</th>
                  <th className="px-3 py-2.5 font-semibold">Description</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Qty</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Price</th>
                </tr>
              </thead>
              <tbody>
                {itemRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-mutedink">
                      {error ?? "Nothing sold matches these criteria."}
                    </td>
                  </tr>
                ) : (
                  itemRows.slice(0, 400).map((r, i) => (
                    <tr
                      key={`${r.invoice}-${r.itemNo}-${i}`}
                      className="border-b border-hairline-soft last:border-0"
                    >
                      <td className="tnum px-3 py-2 text-mutedink">{r.invoice}</td>
                      <td className="px-3 py-2 text-mutedink">{shortDate(r.date)}</td>
                      <td className="px-3 py-2 text-ink">{r.client}</td>
                      <td className="px-3 py-2 text-mutedink">
                        {getStaff(r.stylistId)?.name ?? "—"}
                      </td>
                      <td className="tnum px-3 py-2 text-mutedink">{r.deptNo}</td>
                      <td className="px-3 py-2 text-mutedink">{r.dept}</td>
                      <td className="tnum px-3 py-2 text-mutedink">{r.itemNo}</td>
                      <td className="px-3 py-2 text-ink">{r.descr}</td>
                      <td className="tnum px-3 py-2 text-right text-ink">{r.qty}</td>
                      <td className="tnum px-3 py-2 text-right font-semibold text-ink">
                        {zar(r.value)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {itemRows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-hairline font-semibold text-ink">
                    <td className="px-3 py-2.5" colSpan={8}>
                      Total · {itemRows.length.toLocaleString("en-ZA")} lines
                    </td>
                    <td className="tnum px-3 py-2.5 text-right">{itemTotals.qty}</td>
                    <td className="tnum px-3 py-2.5 text-right">{zar(itemTotals.value)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          ) : (
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
                {turnoverRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-mutedink">
                      {error ?? "No sales in this period."}
                    </td>
                  </tr>
                ) : (
                  turnoverRows.map((r) => {
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
                          <td
                            key={`${c.key}-ex`}
                            className="tnum px-4 py-2 text-right text-mutedink"
                          >
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
              {turnoverRows.length > 0 && (
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
          )}
        </TableScroll>

        {isItems && itemRows.length > 400 && (
          <p className="no-print border-t border-hairline-soft px-4 py-2 text-xs text-mutedink">
            Showing the first 400 of {itemRows.length.toLocaleString("en-ZA")} lines on screen. The
            Excel and CSV exports contain every line.
          </p>
        )}
        </Card>
      </PrintArea>
    </>
  );
}
