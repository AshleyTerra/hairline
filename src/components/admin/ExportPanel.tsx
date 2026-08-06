"use client";

import { useState } from "react";
import { Card, CardTitle } from "@/components/ui";
import { downloadCsv, toCsv } from "@/lib/csv";
import {
  analytics,
  clients,
  demoday,
  getStaff,
  meta,
  products,
  services,
  staff,
} from "@/lib/data";
import { useStore } from "@/lib/store";

interface ExportDef {
  key: string;
  label: string;
  description: string;
  rows: () => number;
  build: () => { filename: string; csv: string };
}

const stamp = () => meta.demoDate;

export function ExportPanel() {
  const { invoices } = useStore();
  const [done, setDone] = useState<string | null>(null);

  const EXPORTS: ExportDef[] = [
    {
      key: "clients",
      label: "Clients",
      description: "Every client with contact details, visit count and lifetime spend",
      rows: () => clients.length,
      build: () => ({
        filename: `hairline-clients-${stamp()}.csv`,
        csv: toCsv(clients, [
          { key: "id", label: "Client ID" },
          { key: "name", label: "Name" },
          { key: "tel", label: "Phone" },
          { key: "email", label: "Email" },
          { key: "birthday", label: "Birthday" },
          { key: "firstVisit", label: "First visit" },
          { key: "lastVisit", label: "Last visit" },
          { key: "visitCount", label: "Visits" },
          { key: "lifetimeSpend", label: "Lifetime spend" },
          { key: "avgTicket", label: "Average visit" },
          {
            key: "prefStylistId",
            label: "Usual stylist",
            value: (c) => getStaff(c.prefStylistId)?.name ?? "",
          },
          { key: "lapsed", label: "Lapsed", value: (c) => (c.lapsed ? "Yes" : "No") },
          { key: "vip", label: "Top spender", value: (c) => (c.vip ? "Yes" : "No") },
          { key: "notes", label: "Notes" },
        ]),
      }),
    },
    {
      key: "lapsed",
      label: "Lapsed clients",
      description: "The win-back list — no visit in over 90 days",
      rows: () => clients.filter((c) => c.lapsed).length,
      build: () => ({
        filename: `hairline-lapsed-clients-${stamp()}.csv`,
        csv: toCsv(
          clients.filter((c) => c.lapsed).sort((a, b) => b.lifetimeSpend - a.lifetimeSpend),
          [
            { key: "name", label: "Name" },
            { key: "tel", label: "Phone" },
            { key: "lastVisit", label: "Last visit" },
            { key: "visitCount", label: "Visits" },
            { key: "lifetimeSpend", label: "Lifetime spend" },
            {
              key: "prefStylistId",
              label: "Usual stylist",
              value: (c) => getStaff(c.prefStylistId)?.name ?? "",
            },
          ]
        ),
      }),
    },
    {
      key: "sales",
      label: "Sales for the day",
      description: "Every invoice line on the demo trading day, plus anything rung up here",
      rows: () =>
        demoday.invoices.reduce((n, i) => n + i.lines.length, 0) +
        invoices.reduce((n, i) => n + i.lines.length, 0),
      build: () => {
        const rows = [
          ...demoday.invoices.flatMap((inv) =>
            inv.lines.map((l) => ({
              invoice: inv.id,
              date: inv.date,
              client: inv.clientName,
              item: l.descr,
              kind: l.kind,
              qty: l.qty,
              price: l.price,
              disc: l.disc,
              line: Math.round(l.price * l.qty * (1 - l.disc / 100) * 100) / 100,
              stylist: getStaff(l.stylistId)?.name ?? "",
            }))
          ),
          ...invoices.flatMap((inv) =>
            inv.lines.map((l) => ({
              invoice: inv.id,
              date: inv.date,
              client: inv.clientName,
              item: l.descr,
              kind: l.kind,
              qty: l.qty,
              price: l.price,
              disc: l.disc,
              line: Math.round(l.price * l.qty * (1 - l.disc / 100) * 100) / 100,
              stylist: getStaff(l.stylistId)?.name ?? "",
            }))
          ),
        ];
        return {
          filename: `hairline-sales-${stamp()}.csv`,
          csv: toCsv(rows, [
            { key: "invoice", label: "Invoice" },
            { key: "date", label: "Date" },
            { key: "client", label: "Client" },
            { key: "item", label: "Item" },
            { key: "kind", label: "Type" },
            { key: "qty", label: "Qty" },
            { key: "price", label: "Unit price" },
            { key: "disc", label: "Discount %" },
            { key: "line", label: "Line total" },
            { key: "stylist", label: "Stylist" },
          ]),
        };
      },
    },
    {
      key: "stock",
      label: "Stock on hand",
      description: "Retail and back bar with cost, price, margin and quantity",
      rows: () => products.retail.length + products.backbar.length,
      build: () => {
        const rows = [
          ...products.retail.map((p) => ({ ...p, shelf: "Retail" })),
          ...products.backbar.map((p) => ({ ...p, shelf: "Back bar" })),
        ];
        return {
          filename: `hairline-stock-${stamp()}.csv`,
          csv: toCsv(rows, [
            { key: "shelf", label: "Shelf" },
            { key: "name", label: "Item" },
            { key: "brand", label: "Brand" },
            { key: "barcode", label: "Barcode" },
            { key: "cost", label: "Cost" },
            { key: "price", label: "Selling price" },
            { key: "margin", label: "Margin %" },
            { key: "qty", label: "On hand" },
            { key: "reorder", label: "Reorder level" },
            {
              key: "needsCount",
              label: "Status",
              value: (p) => (p.needsCount ? "Needs count" : p.lowStock ? "Low" : "OK"),
            },
          ]),
        };
      },
    },
    {
      key: "order",
      label: "What to order",
      description: "Everything at or below its reorder level, grouped for the supplier",
      rows: () =>
        [...products.retail, ...products.backbar].filter((p) => p.lowStock || p.needsCount).length,
      build: () => {
        const rows = [...products.retail, ...products.backbar]
          .filter((p) => p.lowStock || p.needsCount)
          .sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name));
        return {
          filename: `hairline-order-list-${stamp()}.csv`,
          csv: toCsv(rows, [
            { key: "brand", label: "Supplier" },
            { key: "name", label: "Item" },
            { key: "qty", label: "On hand" },
            { key: "reorder", label: "Reorder at" },
            {
              key: "id",
              label: "Suggested order",
              value: (p) => Math.max(1, p.reorder * 2 - Math.max(0, p.qty)),
            },
            { key: "cost", label: "Unit cost" },
          ]),
        };
      },
    },
    {
      key: "services",
      label: "Service menu",
      description: "Every service with duration, cost, price and margin",
      rows: () => services.length,
      build: () => ({
        filename: `hairline-service-menu-${stamp()}.csv`,
        csv: toCsv(services, [
          { key: "dept", label: "Department" },
          { key: "name", label: "Service" },
          { key: "mins", label: "Minutes" },
          { key: "cost", label: "Cost" },
          { key: "price", label: "Price" },
          {
            key: "id",
            label: "Margin %",
            value: (s) => (s.cost > 0 ? Math.round(((s.price - s.cost) / s.price) * 100) : ""),
          },
        ]),
      }),
    },
    {
      key: "staff",
      label: "Staff performance",
      description: "Turnover, retail share, tips and advances over twelve months",
      rows: () => staff.length,
      build: () => ({
        filename: `hairline-staff-${stamp()}.csv`,
        csv: toCsv(staff, [
          { key: "name", label: "Name" },
          { key: "role", label: "Role" },
          { key: "startDate", label: "Started" },
          { key: "serviceRevenue", label: "Service revenue" },
          { key: "retailRevenue", label: "Retail revenue" },
          { key: "totalRevenue", label: "Total revenue" },
          { key: "retailShare", label: "Retail share %" },
          { key: "invoices", label: "Invoices" },
          { key: "monthlyTarget", label: "Monthly target" },
          { key: "tips", label: "Tips total", value: (s) => s.tips.total },
          { key: "subs", label: "Advances total", value: (s) => s.subs.total },
        ]),
      }),
    },
    {
      key: "revenue",
      label: "Revenue history",
      description: "Turnover by year since 2015, and by month for two years",
      rows: () => analytics.revenueByYear.length + analytics.revenueByMonth.length,
      build: () => {
        const rows = [
          ...analytics.revenueByYear.map((y) => ({
            period: String(y.year),
            kind: "Year",
            invoices: y.invoices,
            revenue: y.revenue,
          })),
          ...analytics.revenueByMonth.map((m) => ({
            period: m.ym,
            kind: "Month",
            invoices: m.invoices,
            revenue: m.revenue,
          })),
        ];
        return {
          filename: `hairline-revenue-${stamp()}.csv`,
          csv: toCsv(rows, [
            { key: "period", label: "Period" },
            { key: "kind", label: "Type" },
            { key: "invoices", label: "Invoices" },
            { key: "revenue", label: "Revenue" },
          ]),
        };
      },
    },
  ];

  function run(def: ExportDef) {
    const { filename, csv } = def.build();
    downloadCsv(filename, csv);
    setDone(`${filename} downloaded.`);
  }

  function runAll() {
    EXPORTS.forEach((def, i) => {
      // Browsers throttle simultaneous downloads, so stagger them slightly.
      window.setTimeout(() => run(def), i * 350);
    });
    setDone(`Downloading all ${EXPORTS.length} files…`);
  }

  return (
    <Card>
      <CardTitle
        right={
          <button
            type="button"
            onClick={runAll}
            className="rounded bg-taupe-deep px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink"
          >
            Download everything
          </button>
        }
      >
        Export to CSV
      </CardTitle>

      <p className="border-b border-hairline-soft px-4 py-3 text-xs text-mutedink">
        Every file opens straight in Excel or Google Sheets. Useful for the accountant, for a
        mail-merge, or for keeping your own copy of the salon&apos;s figures.
      </p>

      <ul className="divide-y divide-hairline-soft">
        {EXPORTS.map((def) => (
          <li key={def.key} className="flex items-center justify-between gap-4 px-4 py-3">
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">{def.label}</span>
              <span className="block text-xs text-mutedink">{def.description}</span>
            </span>
            <span className="flex shrink-0 items-center gap-3">
              <span className="tnum text-xs text-mutedink">
                {def.rows().toLocaleString("en-ZA")} rows
              </span>
              <button
                type="button"
                onClick={() => run(def)}
                className="rounded border border-taupe px-3 py-1.5 text-xs font-semibold text-taupe-deep hover:bg-chip"
              >
                Download
              </button>
            </span>
          </li>
        ))}
      </ul>

      {done && (
        <p role="status" className="border-t border-hairline-soft bg-good-soft px-4 py-2.5 text-xs text-good">
          {done}
        </p>
      )}
    </Card>
  );
}
