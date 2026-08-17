"use client";

import { useMemo, useState } from "react";
import { PrintArea } from "@/components/PrintArea";
import { Card, CardTitle, TableScroll } from "@/components/ui";
import { getStaff, meta } from "@/lib/data";
import { longDate, shortDate, zar } from "@/lib/format";
import { catalogue } from "@/lib/salesSource";
import {
  SERVICE_TYPES,
  purchaseHistory,
  purchaseTotals,
  type ServiceTypeFilter,
} from "@/lib/purchases";
import { useStore } from "@/lib/store";
import type { Visit } from "@/lib/types";

interface PurchaseHistoryProps {
  clientId: number;
  clientName: string;
  /** Their migrated history. Null while it is still being fetched. */
  visits: Visit[] | null;
  /** Compact form for the till, where space is short. */
  compact?: boolean;
}

/** Thirteen months back is what the migrated line-level history reaches. */
const defaultFrom = (() => {
  const d = new Date(`${meta.demoDate}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - 5);
  return d.toISOString().slice(0, 10);
})();

/**
 * What this client has bought, in MySalon's own columns.
 *
 * Reception reads this with the client in front of them, so the filters are the
 * two they actually use — service type and a date range — and it prints.
 */
export function PurchaseHistory({
  clientId,
  clientName,
  visits,
  compact = false,
}: PurchaseHistoryProps) {
  const { invoices } = useStore();
  const [serviceType, setServiceType] = useState<ServiceTypeFilter>("all");
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(meta.demoDate);

  const rows = useMemo(
    () =>
      purchaseHistory(visits ?? [], invoices, catalogue, { serviceType, from, to }, clientId),
    [visits, invoices, serviceType, from, to, clientId]
  );
  const totals = useMemo(() => purchaseTotals(rows), [rows]);

  const field =
    "rounded border border-hairline bg-paper px-2 py-1.5 text-xs text-ink";

  return (
    <Card className="print:border-0">
      <CardTitle
        right={
          <span className="no-print flex items-center gap-2 text-xs text-mutedink">
            {totals.visits} visit{totals.visits === 1 ? "" : "s"} · {totals.qty} item
            {totals.qty === 1 ? "" : "s"}
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded border border-taupe px-2 py-1 text-[11px] font-semibold text-taupe-deep hover:bg-chip"
            >
              Print
            </button>
          </span>
        }
      >
        Purchase history
      </CardTitle>

      {/* The two filters MySalon offered, and the two reception uses */}
      <div className="no-print flex flex-wrap items-center gap-2 border-b border-hairline-soft px-4 py-2.5">
        <span className="flex gap-1">
          {SERVICE_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setServiceType(t.value)}
              aria-pressed={serviceType === t.value}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                serviceType === t.value
                  ? "bg-taupe text-white"
                  : "bg-chip text-taupe-deep hover:bg-hairline"
              }`}
            >
              {t.label}
            </button>
          ))}
        </span>
        <label className="ml-auto flex items-center gap-1.5 text-[11px] text-mutedink">
          From
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            aria-label="History from"
            className={field}
          />
        </label>
        <label className="flex items-center gap-1.5 text-[11px] text-mutedink">
          to
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
            aria-label="History to"
            className={field}
          />
        </label>
      </div>

      <PrintArea landscape>
        <header className="hidden px-4 py-3 print:block">
          <h2 className="text-sm font-semibold text-ink">
            Client purchase history for {clientName}
          </h2>
          <p className="text-xs text-mutedink">
            Hairline · {longDate(from)} to {longDate(to)} · printed {longDate(meta.demoDate)}
          </p>
        </header>

        <TableScroll cap={!compact}>
          <table className="w-full text-sm" data-purchase-history>
            <thead>
              <tr className="border-b border-hairline text-left text-[10.5px] uppercase tracking-[0.06em] text-mutedink">
                <th className="px-3 py-2 font-semibold">Inv no.</th>
                <th className="px-3 py-2 font-semibold">Staff</th>
                <th className="px-3 py-2 font-semibold">Date</th>
                {!compact && <th className="px-3 py-2 font-semibold">Dept</th>}
                <th className="px-3 py-2 font-semibold">Description</th>
                {!compact && <th className="px-3 py-2 font-semibold">Item</th>}
                <th className="px-3 py-2 text-right font-semibold">Price</th>
                <th className="px-3 py-2 text-right font-semibold">Qty</th>
                <th className="px-3 py-2 font-semibold">Type</th>
              </tr>
            </thead>
            <tbody>
              {visits === null && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-mutedink">
                    Loading history…
                  </td>
                </tr>
              )}
              {visits !== null && rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-mutedink">
                    Nothing bought in this period.
                  </td>
                </tr>
              )}
              {rows.map((r, i) => (
                <tr
                  key={`${r.invoice}-${r.descr}-${i}`}
                  className="border-b border-hairline-soft last:border-0"
                >
                  <td className="tnum px-3 py-2 text-mutedink">INV {r.invoice}</td>
                  <td className="px-3 py-2 text-mutedink">
                    {getStaff(r.stylistId)?.name ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-mutedink">{shortDate(r.date)}</td>
                  {!compact && <td className="tnum px-3 py-2 text-mutedink">{r.deptNo}</td>}
                  <td className="px-3 py-2 text-ink">{r.descr}</td>
                  {!compact && <td className="tnum px-3 py-2 text-mutedink">{r.itemNo}</td>}
                  <td className="tnum px-3 py-2 text-right font-medium text-ink">
                    {zar(r.price)}
                  </td>
                  <td className="tnum px-3 py-2 text-right text-body">{r.qty}</td>
                  <td className="px-3 py-2 text-[11px] text-mutedink">{r.serviceType}</td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-hairline font-semibold text-ink">
                  <td className="px-3 py-2" colSpan={compact ? 4 : 6}>
                    {totals.visits} visit{totals.visits === 1 ? "" : "s"}
                  </td>
                  <td className="tnum px-3 py-2 text-right">{zar(totals.value)}</td>
                  <td className="tnum px-3 py-2 text-right">{totals.qty}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </TableScroll>
      </PrintArea>
    </Card>
  );
}
