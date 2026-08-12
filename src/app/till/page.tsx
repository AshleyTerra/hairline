"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { ClientPicker } from "@/components/till/ClientPicker";
import { ItemCatalogue } from "@/components/till/ItemCatalogue";
import { TipPanel } from "@/components/till/TipPanel";
import { DocketBar } from "@/components/till/DocketBar";
import { DayBook } from "@/components/till/DayBook";
import { NewClientDialog } from "@/components/till/NewClientDialog";
import { InvoiceSlip, type InvoiceSlipData } from "@/components/till/InvoiceSlip";
import { closeDocket, findDocket, nextNumber, openDocket, saveDocket } from "@/lib/dockets";
import { PaymentPanel } from "@/components/till/PaymentPanel";
import { GlobalSearch } from "@/components/till/GlobalSearch";
import { demoday, earningStylists, getClient, getStaff, meta, staff } from "@/lib/data";
import { initials, longDate, zar, zar0 } from "@/lib/format";
import { useStore } from "@/lib/store";
import { elapsedSeconds, emptyTill, tillReduce, totals as computeTotals } from "@/lib/till";
import type { Client, PaymentMethod, Product, Service, TillLine } from "@/lib/types";

let lineCounter = 0;
const nextKey = () => `line-${(lineCounter += 1)}`;

export default function TillPage() {
  const { invoices, addInvoice, dockets, setDockets, addClient } = useStore();
  const [till, dispatch] = useReducer(tillReduce, undefined, emptyTill);
  const [docketNo, setDocketNo] = useState<number | null>(null);
  const [addingClient, setAddingClient] = useState(false);
  const [slip, setSlip] = useState<InvoiceSlipData | null>(null);
  const [saved, setSaved] = useState<{ number: number; owing: number; client: string } | null>(
    null
  );
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState<{ total: number; seconds: number } | null>(null);
  const [query, setQuery] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [amount, setAmount] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const totals = useMemo(() => computeTotals(till), [till]);
  const seconds = elapsedSeconds(till, now);

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

  useEffect(() => {
    if (!saved) return;
    const id = window.setTimeout(() => setSaved(null), 6000);
    return () => window.clearTimeout(id);
  }, [saved]);

  // Park whatever is on screen against the open docket, so switching between
  // clients never loses work.
  useEffect(() => {
    if (docketNo == null) return;
    setDockets(saveDocket(dockets, docketNo, till));
    // `dockets` is deliberately omitted: including it would loop on its own write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [till, docketNo]);

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
    dispatch({
      type: "add",
      at: Date.now(),
      line: {
        key: nextKey(),
        descr: product.name,
        price: product.price,
        qty: 1,
        disc: 0,
        stylistId: defaultStylist,
        kind: "product",
      },
    });
  }

  function pickClient(client: Client) {
    dispatch({
      type: "setClient",
      clientId: client.id,
      clientName: client.name,
      at: Date.now(),
    });
  }

  /** Voids the sale, including anything half-typed on the keypad. */
  function clearSale() {
    if (docketNo != null) setDockets(closeDocket(dockets, docketNo));
    setDocketNo(null);
    dispatch({ type: "clear" });
    setAmount("");
    setMethod("card");
    setEditing(null);
  }

  /**
   * Parks the current sale and starts a fresh docket. A date prepares one for an
   * upcoming day; it waits there rather than opening at the counter now.
   */
  function newDocket(forDate?: string) {
    const { docket, dockets: next } = openDocket(
      docketNo != null ? saveDocket(dockets, docketNo, till) : dockets,
      emptyTill(),
      meta.lastInvoiceNumber,
      new Date().toISOString(),
      forDate
    );
    setDockets(next);
    setAmount("");

    const isFuture = forDate != null && forDate > meta.demoDate;
    if (isFuture) {
      // Leave the counter alone; the docket belongs to that future day.
      setSaved({ number: docket.number, owing: 0, client: `docket for ${forDate}` });
      return;
    }
    setDocketNo(docket.number);
    dispatch({ type: "clear" });
  }

  /**
   * Puts the sale on the client's docket to settle later, and frees the counter
   * for the next person. It shows under Clients today, awaiting payment.
   */
  function saveForLater() {
    if (till.lines.length === 0) return;

    let next = dockets;
    let number = docketNo;
    if (number == null) {
      const opened = openDocket(
        dockets,
        till,
        meta.lastInvoiceNumber,
        new Date().toISOString()
      );
      next = opened.dockets;
      number = opened.docket.number;
    } else {
      next = saveDocket(dockets, number, till);
    }

    setDockets(next);
    setDocketNo(null);
    dispatch({ type: "clear" });
    setAmount("");
    setMethod("card");
    setEditing(null);
    setSaved({ number, owing: totals.balance, client: till.clientName ?? "Walk-in" });
  }

  /** Brings a parked docket back to the counter. */
  function openExisting(number: number) {
    if (number === docketNo) return;
    const saved = docketNo != null ? saveDocket(dockets, docketNo, till) : dockets;
    setDockets(saved);
    const target = findDocket(saved, number);
    if (!target) return;
    setDocketNo(number);
    dispatch({ type: "load", state: target.state });
    setAmount("");
  }

  /** Keypad input. The functional update keeps every press, however fast. */
  function pressKey(key: string) {
    setAmount((prev) => {
      if (key === "⌫") return prev.slice(0, -1);
      if (key === "." && prev.includes(".")) return prev;
      return prev + key;
    });
  }

  /** Captures the typed amount, then completes if that clears the balance. */
  function tender() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    const next = tillReduce(till, { type: "pay", payment: { method, amount: value } });
    dispatch({ type: "pay", payment: { method, amount: value } });
    setAmount("");
    if (computeTotals(next).balance <= 0) complete(next);
  }

  function complete(state = till) {
    const t = computeTotals(state);
    if (state.lines.length === 0 || t.balance > 0) return;

    // The docket's number becomes the invoice number.
    const number = docketNo ?? nextNumber(dockets, meta.lastInvoiceNumber);
    const client = getClient(state.clientId);
    setSlip({
      number,
      date: new Date().toISOString(),
      clientName: state.clientName ?? "Walk-in",
      clientTel: client?.tel,
      lines: state.lines,
      payments: state.payments,
      tips: state.tips,
      subtotal: t.subtotal,
      vat: t.vat,
      tipTotal: t.tipTotal,
      dueTotal: t.dueTotal,
    });
    if (docketNo != null) setDockets(closeDocket(dockets, docketNo));
    setDocketNo(null);

    addInvoice({
      clientId: state.clientId,
      clientName: state.clientName ?? "Walk-in",
      // `total` is the sales figure; the tip is collected but reported apart.
      total: t.subtotal,
      lines: state.lines,
      payments: state.payments,
      tips: state.tips,
      seconds,
    });
    setToast({ total: t.subtotal, seconds });
    dispatch({ type: "clear" });
    setAmount("");
    setMethod("card");
  }

  const playTotal = invoices.reduce((sum, i) => sum + i.total, 0);
  const dayTotal = demoday.totals.total + playTotal;
  const dayCount = demoday.invoiceCount + invoices.length;

  const tipStylists = useMemo(() => {
    const ids = new Set(till.lines.map((l) => l.stylistId).filter((id): id is number => id != null));
    return staff.filter((s) => ids.has(s.id));
  }, [till.lines]);

  const hasLines = till.lines.length > 0;
  const changeDue = totals.change > 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Top bar */}
      <header className="flex shrink-0 flex-wrap items-center gap-4 border-b border-edge bg-white px-6 py-3.5">
        <GlobalSearch
          onPickClient={pickClient}
          onPickService={addService}
          onPickProduct={addProduct}
          onQueryChange={setQuery}
        />

        <div className="ml-auto text-right">
          <p className="text-[10.5px] uppercase tracking-[0.1em] text-faintink">Taken today</p>
          <p className="text-ink">
            <span className="tnum text-[18px] font-semibold">{zar0(dayTotal)}</span>
            <span className="text-[12px] text-faintink"> · {dayCount} sales</span>
          </p>
        </div>

        {till.startedAt != null ? (
          <span
            className={`flex items-center gap-1.5 rounded-full px-[15px] py-2 text-[13px] font-semibold ${
              seconds <= 30 ? "bg-good-soft text-good" : "bg-warn-soft text-warn"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
            <span className="tnum">{seconds}s</span>
          </span>
        ) : (
          <span className="text-[12px] text-faintink">
            Target: a routine sale in under 30 seconds
          </span>
        )}
      </header>

      {/* Working area */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* Catalogue */}
        <div className="flex min-h-0 flex-col gap-3.5 overflow-hidden bg-canvas px-6 py-5">
          <p className="shrink-0 text-[11px] text-faintink">
            Prototype — real salon data, demo day {longDate(meta.demoDate)}. Client names and
            numbers are anonymised.
          </p>

          {saved && (
            <div
              role="status"
              className="shrink-0 rounded-[10px] border border-warn bg-warn-soft px-4 py-3 text-[13px] text-warn"
            >
              <strong>
                Saved — {saved.client}, docket #{saved.number}.
              </strong>{" "}
              {zar(saved.owing)} awaiting payment under Clients today.
            </div>
          )}

          {toast && (
            <div
              role="status"
              className="shrink-0 rounded-[10px] border border-good bg-good-soft px-4 py-3 text-[13px] text-good"
            >
              <strong>Sale complete — {zar(toast.total)}.</strong> Rung up in {toast.seconds}{" "}
              second{toast.seconds === 1 ? "" : "s"}
              {toast.seconds <= 30 ? " — inside the 30-second target." : "."}
            </div>
          )}

          {/* A slim reminder of what is still open, whichever tab is showing */}
          {dockets.length > 0 && (
            <DocketBar
              dockets={dockets}
              activeNumber={docketNo}
              onOpen={openExisting}
              onNew={newDocket}
            />
          )}

          <ItemCatalogue
            onAddService={addService}
            onAddProduct={addProduct}
            query={query}
            openDockets={dockets.length}
            clientsTab={
              <DayBook
                dockets={dockets}
                activeNumber={docketNo}
                onOpenDocket={openExisting}
                onNewDocket={newDocket}
              />
            }
          />

          {invoices.length > 0 && (
            <div className="shrink-0 border-t border-edge pt-2.5">
              <p className="text-[11px] text-faintink">
                Rung up in this demo: {invoices.length} sale
                {invoices.length === 1 ? "" : "s"} · {zar0(playTotal)}
              </p>
            </div>
          )}
        </div>

        {/* Receipt */}
        <aside className="flex min-h-0 flex-col overflow-y-auto border-t border-edge bg-white lg:border-l lg:border-t-0">
          <ClientPicker
            clientId={till.clientId}
            clientName={till.clientName}
            docketNumber={docketNo}
            onChange={() => window.dispatchEvent(new Event("hairline:focus-search"))}
            onAddClient={() => setAddingClient(true)}
            onClear={hasLines || docketNo != null ? clearSale : undefined}
          />

          {/* Lines — a floor height so a tall keypad can never squeeze them away */}
          <div className="min-h-[150px] flex-1 shrink-0 overflow-y-auto py-1.5">
            {!hasLines ? (
              <p className="px-4 py-10 text-center text-[14px] text-faintink">
                Pick a service or product to start.
              </p>
            ) : (
              <ul>
                {till.lines.map((line) => {
                  const stylist = getStaff(line.stylistId);
                  return (
                    <li key={line.key} className="group px-5 py-3">
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => setEditing(editing === line.key ? null : line.key)}
                          title="Change the stylist, quantity or discount"
                          className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg bg-canvas text-[10px] font-bold text-taupe-deep transition-colors hover:bg-chip"
                        >
                          {stylist ? initials(stylist.name) : "—"}
                        </button>

                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] leading-[1.35] text-ink">{line.descr}</p>
                          <button
                            type="button"
                            onClick={() => setEditing(editing === line.key ? null : line.key)}
                            className="text-left text-[11.5px] text-faintink hover:text-taupe-deep"
                          >
                            {stylist?.name ?? "No stylist"} · Qty {line.qty}
                            {line.disc > 0 ? ` · ${line.disc}% off` : ""}
                          </button>
                        </div>

                        <span className="tnum shrink-0 text-[15px] font-semibold text-ink">
                          {zar(line.price * line.qty * (1 - line.disc / 100))}
                        </span>

                        <button
                          type="button"
                          onClick={() => dispatch({ type: "remove", key: line.key })}
                          aria-label={`Remove ${line.descr}`}
                          className="shrink-0 text-faintink opacity-0 transition-opacity hover:text-crit focus-visible:opacity-100 group-hover:opacity-100"
                        >
                          ✕
                        </button>
                      </div>

                      {editing === line.key && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-[10px] bg-canvas px-3 py-2.5">
                          <label className="flex items-center gap-1.5 text-[11.5px] text-taupe-deep">
                            Stylist
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
                              className="rounded border border-edge bg-white px-1.5 py-1 text-[11.5px] text-ink"
                            >
                              {staff
                                .filter((s) => s.role !== "reception")
                                .map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                            </select>
                          </label>

                          <label className="flex items-center gap-1.5 text-[11.5px] text-taupe-deep">
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
                              className="tnum w-14 rounded border border-edge bg-white px-1.5 py-1 text-[11.5px] text-ink"
                            />
                          </label>

                          <label className="flex items-center gap-1.5 text-[11.5px] text-taupe-deep">
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
                              className="tnum w-14 rounded border border-edge bg-white px-1.5 py-1 text-[11.5px] text-ink"
                            />
                          </label>

                          <button
                            type="button"
                            onClick={() => setEditing(null)}
                            className="ml-auto text-[11.5px] font-semibold text-taupe"
                          >
                            Done
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {hasLines && (
            <>
              <TipPanel
                tips={till.tips}
                suggestedIds={tipStylists.map((s) => s.id)}
                onTip={(stylistId, amount) => dispatch({ type: "tip", stylistId, amount })}
              />

              {/* Totals — the anchor of the screen */}
              <div
                className={`px-5 py-[18px] text-white transition-colors duration-200 ${
                  changeDue ? "bg-good" : "bg-taupe-deep"
                }`}
              >
                <div className="flex justify-between text-[12.5px] text-[#d8d1c5]">
                  <span>Subtotal</span>
                  <span className="tnum">{zar(totals.subtotal)}</span>
                </div>
                <div className="mt-1 flex justify-between text-[12.5px] text-[#d8d1c5]">
                  <span>VAT included (15%)</span>
                  <span className="tnum">{zar(totals.vat)}</span>
                </div>
                {totals.tipTotal > 0 && (
                  <div className="mt-1 flex justify-between text-[12.5px] text-[#d8d1c5]">
                    <span>Tip</span>
                    <span className="tnum">+ {zar(totals.tipTotal)}</span>
                  </div>
                )}
                {till.payments.map((p, i) => (
                  <div
                    key={`${p.method}-${i}`}
                    className="mt-1 flex justify-between text-[12.5px] text-[#d8d1c5]"
                  >
                    <span className="capitalize">
                      {p.method === "topay" ? "To pay" : p.method} taken
                    </span>
                    <span className="tnum">
                      − {zar(p.amount)}
                      <button
                        type="button"
                        onClick={() => dispatch({ type: "unpay", index: i })}
                        aria-label={`Remove ${p.method} payment`}
                        className="ml-2 text-white/60 hover:text-white"
                      >
                        ✕
                      </button>
                    </span>
                  </div>
                ))}

                <div className="mt-3 flex items-baseline justify-between border-t border-white/[0.18] pt-3">
                  <span className="text-[12px] uppercase tracking-[0.12em] text-[#e6e0d4]">
                    {changeDue ? "Change due" : "Balance"}
                  </span>
                  <span className="tnum text-[40px] font-semibold leading-none tracking-[-0.025em]">
                    {zar(changeDue ? totals.change : totals.balance)}
                  </span>
                </div>
              </div>

              <PaymentPanel
                totals={totals}
                method={method}
                onMethod={setMethod}
                amount={amount}
                onAmount={setAmount}
                onKey={pressKey}
                onTender={tender}
                onComplete={() => complete()}
                onSave={saveForLater}
              />
            </>
          )}
        </aside>
      </div>

      {addingClient && (
        <NewClientDialog
          onClose={() => setAddingClient(false)}
          onSave={(input) => {
            const created = addClient(input);
            dispatch({
              type: "setClient",
              clientId: created.id,
              clientName: created.name,
              at: Date.now(),
            });
            setAddingClient(false);
          }}
        />
      )}

      {slip && <InvoiceSlip data={slip} onClose={() => setSlip(null)} />}
    </div>
  );
}
