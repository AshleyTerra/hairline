"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { ClientPicker } from "@/components/till/ClientPicker";
import { ItemCatalogue } from "@/components/till/ItemCatalogue";
import { PaymentPanel } from "@/components/till/PaymentPanel";
import { PageHeader, Badge } from "@/components/ui";
import { demoday, earningStylists, getClient, meta, staff } from "@/lib/data";
import { zar, zar0, longDate } from "@/lib/format";
import { useStore } from "@/lib/store";
import { elapsedSeconds, emptyTill, tillReduce, totals as computeTotals } from "@/lib/till";
import type { Payment, Product, Service, TillLine } from "@/lib/types";

let lineCounter = 0;
const nextKey = () => `line-${(lineCounter += 1)}`;

export default function TillPage() {
  const { invoices, addInvoice } = useStore();
  const [till, dispatch] = useReducer(tillReduce, undefined, emptyTill);
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState<{ total: number; seconds: number } | null>(null);

  const totals = useMemo(() => computeTotals(till), [till]);
  const seconds = elapsedSeconds(till, now);

  // Drive the "under 30 seconds" clock while a sale is open.
  useEffect(() => {
    if (till.startedAt == null) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [till.startedAt]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(id);
  }, [toast]);

  const defaultStylist = useMemo(() => {
    const client = getClient(till.clientId);
    if (client?.prefStylistId && earningStylists.some((s) => s.id === client.prefStylistId)) {
      return client.prefStylistId;
    }
    return earningStylists[0]?.id ?? null;
  }, [till.clientId]);

  function addService(service: Service) {
    const line: TillLine = {
      key: nextKey(),
      descr: service.name,
      price: service.price,
      qty: 1,
      disc: 0,
      stylistId: defaultStylist,
      kind: "service",
      mins: service.mins,
    };
    dispatch({ type: "add", line, at: Date.now() });
  }

  function addProduct(product: Product) {
    const line: TillLine = {
      key: nextKey(),
      descr: product.name,
      price: product.price,
      qty: 1,
      disc: 0,
      stylistId: defaultStylist,
      kind: "product",
    };
    dispatch({ type: "add", line, at: Date.now() });
  }

  function complete() {
    if (till.lines.length === 0 || totals.balance > 0) return;
    addInvoice({
      clientId: till.clientId,
      clientName: till.clientName ?? "Walk-in",
      total: totals.subtotal,
      lines: till.lines,
      payments: till.payments,
      tips: till.tips,
      seconds,
    });
    setToast({ total: totals.subtotal, seconds });
    dispatch({ type: "clear" });
  }

  // Takings so far = the real demo day plus anything rung up in this session.
  const playTotal = invoices.reduce((sum, i) => sum + i.total, 0);
  const dayTotal = demoday.totals.total + playTotal;
  const dayCount = demoday.invoiceCount + invoices.length;

  const tipStylists = useMemo(() => {
    const ids = new Set(till.lines.map((l) => l.stylistId).filter((id): id is number => id != null));
    return staff.filter((s) => ids.has(s.id));
  }, [till.lines]);

  return (
    <>
      <PageHeader
        eyebrow="Reception"
        title="Till"
        subtitle={`${longDate(meta.demoDate)} · ${dayCount} sales · ${zar0(dayTotal)} taken so far`}
        actions={
          till.startedAt != null ? (
            <span
              className={`tnum rounded-full px-3 py-1 text-sm font-semibold ${
                seconds <= 30 ? "bg-good-soft text-good" : "bg-warn-soft text-warn"
              }`}
            >
              {seconds}s
            </span>
          ) : (
            <span className="text-xs text-mutedink">Target: a routine sale in under 30 seconds</span>
          )
        }
      />

      {toast && (
        <div
          role="status"
          className="mb-4 flex flex-wrap items-center gap-2 rounded border border-good bg-good-soft px-4 py-3 text-sm text-good"
        >
          <strong>Sale complete — {zar(toast.total)}.</strong>
          <span>
            Rung up in {toast.seconds} second{toast.seconds === 1 ? "" : "s"}
            {toast.seconds <= 30 ? " — inside the 30-second target." : "."}
          </span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Left: pick a client, then pick items */}
        <div className="flex flex-col gap-4">
          <ClientPicker
            clientId={till.clientId}
            clientName={till.clientName}
            onPick={(c) =>
              dispatch({
                type: "setClient",
                clientId: c.id,
                clientName: c.name || null,
                at: Date.now(),
              })
            }
          />
          <ItemCatalogue onAddService={addService} onAddProduct={addProduct} />
        </div>

        {/* Right: the running sale */}
        <aside className="flex h-fit flex-col rounded border border-hairline bg-card lg:sticky lg:top-4">
          <div className="flex items-center justify-between border-b border-hairline-soft px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">This sale</h2>
            {till.lines.length > 0 && (
              <button
                type="button"
                onClick={() => dispatch({ type: "clear" })}
                className="text-xs text-mutedink underline underline-offset-2 hover:text-crit"
              >
                Clear
              </button>
            )}
          </div>

          {till.lines.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-mutedink">
              Pick a service or product to start.
            </p>
          ) : (
            <ul className="divide-y divide-hairline-soft">
              {till.lines.map((line) => (
                <li key={line.key} className="px-4 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 text-sm text-ink">{line.descr}</p>
                    <span className="tnum text-sm font-semibold text-ink">
                      {zar(line.price * line.qty * (1 - line.disc / 100))}
                    </span>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: "remove", key: line.key })}
                      aria-label={`Remove ${line.descr}`}
                      className="text-mutedink hover:text-crit"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                    <select
                      value={line.stylistId ?? ""}
                      onChange={(e) =>
                        dispatch({
                          type: "update",
                          key: line.key,
                          patch: { stylistId: Number(e.target.value) },
                        })
                      }
                      aria-label={`Stylist for ${line.descr}`}
                      className="rounded border border-hairline bg-paper px-1.5 py-1 text-xs text-body"
                    >
                      {staff
                        .filter((s) => s.role !== "reception")
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                    </select>
                    <label className="flex items-center gap-1 text-mutedink">
                      Qty
                      <input
                        type="number"
                        min={1}
                        value={line.qty}
                        onChange={(e) =>
                          dispatch({
                            type: "update",
                            key: line.key,
                            patch: { qty: Math.max(1, Number(e.target.value) || 1) },
                          })
                        }
                        aria-label={`Quantity for ${line.descr}`}
                        className="tnum w-12 rounded border border-hairline bg-paper px-1.5 py-1 text-xs text-body"
                      />
                    </label>
                    <label className="flex items-center gap-1 text-mutedink">
                      Disc %
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={line.disc}
                        onChange={(e) =>
                          dispatch({
                            type: "update",
                            key: line.key,
                            patch: {
                              disc: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                            },
                          })
                        }
                        aria-label={`Discount for ${line.descr}`}
                        className="tnum w-12 rounded border border-hairline bg-paper px-1.5 py-1 text-xs text-body"
                      />
                    </label>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {till.lines.length > 0 && (
            <>
              <div className="border-t border-hairline-soft px-4 py-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-mutedink">Subtotal</span>
                  <span className="tnum font-semibold text-ink">{zar(totals.subtotal)}</span>
                </div>
                <div className="mt-1 flex justify-between text-xs text-mutedink">
                  <span>VAT included (15%)</span>
                  <span className="tnum">{zar(totals.vat)}</span>
                </div>
                {totals.tipTotal > 0 && (
                  <div className="mt-1 flex justify-between text-xs text-taupe-deep">
                    <span>Tips (paid to staff, not part of the sale)</span>
                    <span className="tnum">{zar(totals.tipTotal)}</span>
                  </div>
                )}
              </div>

              {tipStylists.length > 0 && (
                <div className="border-t border-hairline-soft px-4 py-3">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-mutedink">
                    Tip
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {tipStylists.map((s) => {
                      const current = till.tips.find((t) => t.stylistId === s.id)?.amount ?? "";
                      return (
                        <label key={s.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-body">{s.name}</span>
                          <input
                            type="number"
                            min={0}
                            value={current}
                            placeholder="0"
                            onChange={(e) =>
                              dispatch({
                                type: "tip",
                                stylistId: s.id,
                                amount: Number(e.target.value) || 0,
                              })
                            }
                            aria-label={`Tip for ${s.name}`}
                            className="tnum w-20 rounded border border-hairline bg-paper px-2 py-1 text-xs text-ink"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <PaymentPanel
                totals={totals}
                payments={till.payments}
                onPay={(p: Payment) => dispatch({ type: "pay", payment: p })}
                onUnpay={(i) => dispatch({ type: "unpay", index: i })}
              />

              <div className="border-t border-hairline-soft px-4 py-3">
                {totals.change > 0 && (
                  <div className="mb-2 flex justify-between rounded bg-good-soft px-3 py-2 text-sm text-good">
                    <span className="font-semibold">Change due</span>
                    <span className="tnum font-semibold">{zar(totals.change)}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={complete}
                  disabled={totals.balance > 0}
                  className="w-full rounded bg-taupe-deep px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-ink disabled:cursor-not-allowed disabled:bg-hairline disabled:text-mutedink"
                >
                  {totals.balance > 0
                    ? `${zar(totals.balance)} still owing`
                    : `Complete sale — ${zar(totals.subtotal)}`}
                </button>
              </div>
            </>
          )}
        </aside>
      </div>

      {invoices.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-ink">
            Rung up in this demo{" "}
            <Badge tone="neutral">
              {invoices.length} sale{invoices.length === 1 ? "" : "s"} · {zar0(playTotal)}
            </Badge>
          </h2>
          <ul className="flex flex-col gap-1">
            {invoices.slice(0, 6).map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between rounded border border-hairline bg-card px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate text-body">
                  {inv.clientName} · {inv.lines.length} item{inv.lines.length === 1 ? "" : "s"}
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-mutedink">{inv.seconds}s</span>
                  <span className="tnum font-semibold text-ink">{zar(inv.total)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
