"use client";

import { getStaff, meta } from "@/lib/data";
import { longDate, zar } from "@/lib/format";
import { Wordmark } from "@/components/Wordmark";
import type { Payment, Tip, TillLine } from "@/lib/types";

export interface InvoiceSlipData {
  number: number;
  date: string;
  clientName: string;
  clientTel?: string;
  lines: TillLine[];
  payments: Payment[];
  tips: Tip[];
  subtotal: number;
  vat: number;
  tipTotal: number;
  dueTotal: number;
}

const METHOD_LABEL: Record<string, string> = {
  card: "Card",
  cash: "Cash",
  eft: "EFT",
  voucher: "Voucher",
  topay: "On account",
};

/** A proper invoice: salon detail, client detail, every line, and a number. */
export function InvoiceSlip({ data, onClose }: { data: InvoiceSlipData; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-ink/40 px-4 py-8 print:static print:overflow-visible print:bg-transparent print:p-0"
      role="dialog"
      aria-modal="true"
      aria-label={`Invoice ${data.number}`}
    >
      <div className="w-full max-w-md rounded-lg border border-hairline bg-card print:max-w-none print:rounded-none print:border-0">
        <div className="no-print flex items-center justify-between border-b border-hairline px-5 py-3">
          <h2 className="text-sm font-semibold text-ink">Invoice #{data.number}</h2>
          <span className="flex gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded bg-taupe-deep px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink"
            >
              Print
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-hairline px-3 py-1.5 text-xs font-semibold text-mutedink hover:text-ink"
            >
              Close
            </button>
          </span>
        </div>

        {/* The slip itself */}
        <div className="px-6 py-6 print:px-0">
          <header className="mb-4 text-center">
            <div className="mb-1 text-2xl">
              <Wordmark />
            </div>
            <p className="text-[11px] leading-relaxed text-mutedink">
              {meta.company} · Shop 30, Stoneridge Centre
              <br />
              Cnr Modderfontein &amp; Harreford Str, Greenstone Park
              <br />
              011 452 1852 · VAT reg 4060268234
            </p>
          </header>

          <div className="mb-3 flex justify-between border-y border-hairline py-2 text-[11.5px]">
            <span>
              <span className="block text-mutedink">Invoice</span>
              <span className="tnum font-semibold text-ink">#{data.number}</span>
            </span>
            <span className="text-right">
              <span className="block text-mutedink">Date</span>
              <span className="text-ink">{longDate(data.date.slice(0, 10))}</span>
            </span>
          </div>

          <div className="mb-3 text-[11.5px]">
            <span className="block text-mutedink">Client</span>
            <span className="font-semibold text-ink">{data.clientName}</span>
            {data.clientTel && <span className="block text-mutedink">{data.clientTel}</span>}
          </div>

          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="border-b border-hairline text-left text-[10px] uppercase tracking-[0.08em] text-mutedink">
                <th className="py-1.5 font-semibold">Item</th>
                <th className="py-1.5 text-right font-semibold">Qty</th>
                <th className="py-1.5 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.lines.map((l) => (
                <tr key={l.key} className="border-b border-hairline-soft">
                  <td className="py-1.5 pr-2 text-ink">
                    {l.descr}
                    <span className="block text-[10px] text-mutedink">
                      {getStaff(l.stylistId)?.name ?? "—"}
                      {l.disc > 0 ? ` · ${l.disc}% off` : ""}
                    </span>
                  </td>
                  <td className="tnum py-1.5 text-right text-mutedink">{l.qty}</td>
                  <td className="tnum py-1.5 text-right text-ink">
                    {zar(l.price * l.qty * (1 - l.disc / 100))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <dl className="mt-3 flex flex-col gap-1 text-[11.5px]">
            <div className="flex justify-between">
              <dt className="text-mutedink">Subtotal</dt>
              <dd className="tnum text-ink">{zar(data.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-mutedink">VAT included (15%)</dt>
              <dd className="tnum text-mutedink">{zar(data.vat)}</dd>
            </div>
            {data.tips.map((t) => (
              <div key={t.stylistId} className="flex justify-between">
                <dt className="text-mutedink">
                  Tip — {getStaff(t.stylistId)?.name ?? "operator"}
                </dt>
                <dd className="tnum text-ink">{zar(t.amount)}</dd>
              </div>
            ))}
            <div className="mt-1 flex justify-between border-t border-hairline pt-1.5">
              <dt className="font-semibold text-ink">Total paid</dt>
              <dd className="tnum text-base font-semibold text-ink">{zar(data.dueTotal)}</dd>
            </div>
            {data.payments.map((p, i) => (
              <div key={`${p.method}-${i}`} className="flex justify-between">
                <dt className="text-mutedink">{METHOD_LABEL[p.method] ?? p.method}</dt>
                <dd className="tnum text-mutedink">{zar(p.amount)}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-4 border-t border-hairline pt-3 text-center text-[10px] leading-relaxed text-mutedink">
            Thank you for supporting Hairline.
            <br />
            Retail products may be exchanged unopened within 14 days with this invoice.
          </p>
        </div>
      </div>
    </div>
  );
}
