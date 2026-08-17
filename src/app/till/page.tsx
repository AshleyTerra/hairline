"use client";

import { Suspense, useEffect, useMemo, useReducer, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ClientPicker } from "@/components/till/ClientPicker";
import { ItemCatalogue } from "@/components/till/ItemCatalogue";
import { TipPanel } from "@/components/till/TipPanel";
import { DocketBar } from "@/components/till/DocketBar";
import { DayBook } from "@/components/till/DayBook";
import { NewClientDialog } from "@/components/till/NewClientDialog";
import { InvoiceSlip, type InvoiceSlipData } from "@/components/till/InvoiceSlip";
import { VoucherDialog } from "@/components/till/VoucherDialog";
import { RedeemVoucherDialog } from "@/components/till/RedeemVoucherDialog";
import { closeDocket, findDocket, nextNumber, openDocket, saveDocket } from "@/lib/dockets";
import { PaymentPanel } from "@/components/till/PaymentPanel";
import { GlobalSearch } from "@/components/till/GlobalSearch";
import { demoday, getClient, getStaff, loadVisits, meta, products, staff } from "@/lib/data";
import { PurchaseHistory } from "@/components/clients/PurchaseHistory";
import { AmendDocketDialog } from "@/components/till/AmendDocketDialog";
import { initials, longDate, zar, zar0 } from "@/lib/format";
import { demoNow, demoToday } from "@/lib/clock";
import { creditable, roster } from "@/lib/roster";
import { useStore } from "@/lib/store";
import { canDo } from "@/lib/admin";
import { stockBook } from "@/lib/stockBook";
import {
  applyCostPrice,
  applyFinalValue,
  costIncl,
  elapsedSeconds,
  emptyTill,
  restoreListPrice,
  tillReduce,
  totals as computeTotals,
} from "@/lib/till";
import {
  checkRedemption,
  issueVoucher,
  nextVoucherNumber,
  redeem as redeemVoucher,
  voucherLine,
  type Voucher,
  type VoucherDraft,
} from "@/lib/vouchers";
import type {
  Client,
  Payment,
  PaymentMethod,
  Product,
  Service,
  TillLine,
  Visit,
} from "@/lib/types";

let lineCounter = 0;
const nextKey = () => `line-${(lineCounter += 1)}`;

/**
 * The counter. Wrapped in Suspense because it reads the query string: arriving
 * from the diary, /till?docket=93712 says whose docket to bring to the counter.
 */
export default function TillPage() {
  return (
    <Suspense fallback={null}>
      <TillCounter />
    </Suspense>
  );
}

function TillCounter() {
  const {
    invoices,
    addInvoice,
    dockets,
    setDockets,
    addClient,
    staffRecords,
    vouchers,
    addVouchers,
    saveVoucher,
    role,
    user,
    abilities,
    updateInvoice,
    confirmPassword,
    newStock,
    stockEdits,
    archivedStock,
  } = useStore();
  const params = useSearchParams();

  /* Changing a price is a separate decision from being allowed to work the
     till, so it is an ability rather than a screen permission. */
  const mayCostPrice = canDo(abilities, role, "costPrice");
  const mayOverride = canDo(abilities, role, "priceOverride");
  const mayAmend = canDo(abilities, role, "amendInvoice");
  /** Whoever the override is recorded against. */
  const overrideBy = user?.displayName ?? user?.username ?? role;

  /* Read once, as the screen opens — later renders must not reopen it. */
  const arriving = useMemo(() => {
    const asked = Number(params.get("docket"));
    return Number.isFinite(asked) && asked > 0 && findDocket(dockets, asked) ? asked : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [till, dispatch] = useReducer(tillReduce, arriving, (number) => {
    const waiting = number != null ? findDocket(dockets, number) : undefined;
    return waiting ? waiting.state : emptyTill();
  });
  const [docketNo, setDocketNo] = useState<number | null>(arriving);
  const [addingClient, setAddingClient] = useState(false);
  const [slip, setSlip] = useState<InvoiceSlipData | null>(null);
  const [saved, setSaved] = useState<{ number: number; owing: number; client: string } | null>(
    null
  );
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState<{ total: number; seconds: number; change: number } | null>(
    null
  );
  const [query, setQuery] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [amount, setAmount] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [sellingVoucher, setSellingVoucher] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  /** What this client has bought before, opened from the docket header. */
  const [showingHistory, setShowingHistory] = useState(false);
  /** Which closed invoice is being corrected, if any. */
  const [amending, setAmending] = useState<number | null>(null);
  const [pastVisits, setPastVisits] = useState<Visit[] | null>(null);

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

  /* Their history is fetched only when reception asks for it — it is a separate
     file per client, and the till should not pay for one nobody opened. */
  useEffect(() => {
    if (!showingHistory || till.clientId == null) return;
    if (till.clientId < 0) return;
    let active = true;
    loadVisits(till.clientId).then((v) => {
      if (active) setPastVisits(v);
    });
    return () => {
      active = false;
    };
  }, [showingHistory, till.clientId]);

  /* The address bar is tidied once the docket is on the counter. */
  useEffect(() => {
    if (arriving != null) window.history.replaceState({}, "", "/till");
  }, [arriving]);

  /**
   * Who a line can be credited to, and who can be tipped: whoever is on the
   * books in Admin today, bar reception. Someone taken on this morning can be
   * picked this morning; someone turned inactive is not offered at all.
   */
  const staffForPicker = useMemo(() => creditable(roster(staffRecords, staff)), [staffRecords]);

  /* Retail as the salon maintains it: a barcode corrected on the Stock screen
     is the barcode this till scans, and a line added there is sellable here. */
  const tillItems = useMemo(
    () => stockBook(products.till, newStock, stockEdits, archivedStock, "retail"),
    [newStock, stockEdits, archivedStock]
  );

  /** The client's usual stylist if they are still working, else the first on. */
  const defaultStylist = useMemo(() => {
    const client = getClient(till.clientId);
    if (client?.prefStylistId && staffForPicker.some((m) => m.id === client.prefStylistId)) {
      return client.prefStylistId;
    }
    const stylists = staffForPicker.filter((m) => !m.support);
    return (stylists[0] ?? staffForPicker[0])?.id ?? null;
  }, [till.clientId, staffForPicker]);

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
        /* Carried so the line can be sold at cost without another lookup.
           MySalon stores this excluding VAT; costIncl() adds it back. */
        cost: product.cost,
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
      demoNow(),
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
        demoNow()
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

  /**
   * Captures the typed amount, then completes if that clears the balance. A part
   * payment stays on the docket so the rest can go on another method — cash and
   * card on the same sale is routine.
   */
  function tender() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    const next = tillReduce(till, { type: "pay", payment: { method, amount: value } });
    dispatch({ type: "pay", payment: { method, amount: value } });
    setAmount("");
    if (computeTotals(next).balance <= 0) complete(next);
  }

  /** Puts a voucher on the sale to be sold, priced as a Hairline stock line. */
  function addVoucherLine(draft: VoucherDraft) {
    const check = issueVoucher(vouchers, draft, {
      clientId: till.clientId,
      clientName: till.clientName ?? "Walk-in",
      on: demoToday(),
    });
    if (!check.ok) {
      setVoucherError(check.error);
      return;
    }
    dispatch({ type: "add", line: voucherLine(draft, nextKey()), at: Date.now() });
    setSellingVoucher(false);
    setVoucherError(null);
  }

  /**
   * Takes a voucher as payment. It is a promise against the docket until the sale
   * completes, checked against anything already taken off the same voucher here.
   */
  function takeVoucher(voucher: Voucher, value: number, stylistId: number | null) {
    const pending = till.payments
      .filter((p) => p.voucherNumber === voucher.number)
      .reduce((sum, p) => sum + p.amount, 0);

    const check = checkRedemption(voucher, value, demoToday(), pending);
    if (!check.ok) {
      setVoucherError(check.error);
      return;
    }

    const payment: Payment = {
      method: "voucher",
      amount: value,
      voucherNumber: voucher.number,
      voucherStylistId: stylistId,
    };
    const next = tillReduce(till, { type: "pay", payment });
    dispatch({ type: "pay", payment });
    setRedeeming(false);
    setVoucherError(null);
    if (computeTotals(next).balance <= 0) complete(next);
  }

  function complete(state = till) {
    const t = computeTotals(state);
    if (state.lines.length === 0 || t.balance > 0) return;

    // The docket's number becomes the invoice number.
    const number = docketNo ?? nextNumber(dockets, meta.lastInvoiceNumber);
    const client = getClient(state.clientId);

    /*
     * Vouchers on the sale become real vouchers now the money is in. The draft
     * rides on the line, so a docket parked half-finished still issues correctly.
     */
    const issued: Voucher[] = [];
    for (const line of state.lines) {
      if (!line.voucher) continue;
      const result = issueVoucher([...vouchers, ...issued], line.voucher, {
        clientId: state.clientId,
        clientName: state.clientName ?? "Walk-in",
        on: demoToday(),
        invoice: number,
      });
      if (result.ok) issued.push(result.voucher);
    }
    if (issued.length > 0) addVouchers(issued);

    /*
     * Vouchers are only drawn down now. Up to this point a voucher payment is a
     * promise on the docket, so a sale that is voided leaves the card untouched.
     */
    for (const payment of state.payments) {
      if (payment.voucherNumber == null) continue;
      const held = vouchers.find((v) => v.number === payment.voucherNumber);
      if (!held) continue;
      /* The stylist keeps the service value in their own figures; the cash was
         banked when the voucher was sold, so business turnover must not take
         it twice. The report reconciles the two. */
      const drawn = redeemVoucher(
        held,
        payment.amount,
        demoToday(),
        number,
        payment.voucherStylistId ?? null
      );
      if (drawn.ok) saveVoucher(drawn.voucher);
    }
    setSlip({
      number,
      date: demoNow(),
      clientName: state.clientName ?? "Walk-in",
      clientTel: client?.tel,
      lines: state.lines,
      payments: state.payments,
      tips: state.tips,
      subtotal: t.subtotal,
      vat: t.vat,
      tipTotal: t.tipTotal,
      dueTotal: t.dueTotal,
      paid: t.paid,
      change: t.change,
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
    setToast({ total: t.subtotal, seconds, change: t.change });
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
          items={tillItems}
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
              <strong>
                Sale complete — {zar(toast.total)}
                {toast.change > 0 ? `. Change ${zar(toast.change)}` : ""}.
              </strong>{" "}
              Rung up in {toast.seconds} second{toast.seconds === 1 ? "" : "s"}
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
            showCost={mayCostPrice}
            items={tillItems}
            clientsTab={
              <DayBook
                dockets={dockets}
                activeNumber={docketNo}
                onOpenDocket={openExisting}
                onNewDocket={newDocket}
                onAmend={mayAmend ? setAmending : undefined}
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
        {/* The panel itself never scrolls: only the lines do, so the keypad and
            the primary action stay in view on a short screen. */}
        <aside className="flex min-h-0 flex-col overflow-y-auto border-t border-edge bg-white lg:overflow-hidden lg:border-l lg:border-t-0">
          <ClientPicker
            clientId={till.clientId}
            clientName={till.clientName}
            docketNumber={docketNo}
            onChange={() => window.dispatchEvent(new Event("hairline:focus-search"))}
            onAddClient={() => setAddingClient(true)}
            onClear={hasLines || docketNo != null ? clearSale : undefined}
            onHistory={() => setShowingHistory(true)}
          />

          {/* Lines — a floor height so a tall keypad can never squeeze them away */}
          <div className="min-h-[110px] flex-1 overflow-y-auto py-1 lg:min-h-[48px]">
            {!hasLines ? (
              <p className="px-4 py-10 text-center text-[14px] text-faintink">
                Pick a service or product to start.
              </p>
            ) : (
              <ul>
                {till.lines.map((line) => {
                  /* Records first, so a stylist taken on today has a name here. */
                  const stylist =
                    staffForPicker.find((m) => m.id === line.stylistId) ?? getStaff(line.stylistId);
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
                            {line.kind === "stock"
                              ? "Hairline sale"
                              : (stylist?.name ?? "No stylist")}{" "}
                            · Qty {line.qty}
                            {line.disc > 0 ? ` · ${line.disc}% off` : ""}
                            {line.priceMode === "cost" ? " · at cost" : ""}
                            {line.priceMode === "final" ? " · priced by hand" : ""}
                            {/* The cost price sits beside the retail one, quietly,
                                for whoever is allowed to see it. */}
                            {mayCostPrice && line.cost != null && line.cost > 0 && (
                              <span className="text-faintink"> · cost {zar(costIncl(line.cost))}</span>
                            )}
                          </button>
                        </div>

                        <span className="shrink-0 text-right">
                          <span className="tnum block text-[15px] font-semibold text-ink">
                            {zar(
                              line.finalValue ?? line.price * line.qty * (1 - line.disc / 100)
                            )}
                          </span>
                          {line.override && (
                            <span className="tnum block text-[10.5px] text-faintink line-through">
                              {zar(line.override.from * line.qty)}
                            </span>
                          )}
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
                              {staffForPicker.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name}
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

                          {/* Pricing controls, for whoever is allowed them */}
                          {(mayCostPrice || mayOverride) && (
                            <div className="flex w-full flex-wrap items-center gap-2 border-t border-edge-faint pt-2">
                              {mayCostPrice && line.cost != null && line.cost > 0 && (
                                <span className="flex items-center gap-1">
                                  {(["list", "cost"] as const).map((mode) => {
                                    const on =
                                      mode === "cost"
                                        ? line.priceMode === "cost"
                                        : line.priceMode == null;
                                    return (
                                      <button
                                        key={mode}
                                        type="button"
                                        aria-pressed={on}
                                        onClick={() =>
                                          dispatch({
                                            type: "update",
                                            key: line.key,
                                            patch:
                                              mode === "cost"
                                                ? applyCostPrice(line, overrideBy, demoNow())
                                                : restoreListPrice(line),
                                          })
                                        }
                                        className={`rounded px-2 py-1 text-[11px] font-semibold transition-colors ${
                                          on
                                            ? "bg-taupe text-white"
                                            : "bg-white text-taupe-deep hover:bg-chip"
                                        }`}
                                      >
                                        {mode === "cost" ? "Cost price" : "Full price"}
                                      </button>
                                    );
                                  })}
                                </span>
                              )}

                              {mayOverride && (
                                <label className="flex items-center gap-1.5 text-[11.5px] text-taupe-deep">
                                  Final value
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={line.finalValue ?? ""}
                                    placeholder="exact"
                                    onChange={(e) => {
                                      const raw = e.target.value;
                                      dispatch({
                                        type: "update",
                                        key: line.key,
                                        patch:
                                          raw === ""
                                            ? restoreListPrice(line)
                                            : applyFinalValue(
                                                line,
                                                Number(raw),
                                                overrideBy,
                                                demoNow()
                                              ),
                                      });
                                    }}
                                    aria-label={`Final value for ${line.descr}`}
                                    className="tnum w-20 rounded border border-edge bg-white px-1.5 py-1 text-[11.5px] text-ink"
                                  />
                                </label>
                              )}

                              {line.override && (
                                <span className="text-[10.5px] text-faintink">
                                  was {zar(line.override.from)} · {line.override.by}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* A voucher goes on the docket alongside the cut and the shampoo. It
              shares the tip strip, so the panel keeps its height. */}
          {!hasLines && (
            <div className="flex shrink-0 items-center gap-3 border-t border-edge-faint px-5 py-2">
              <button
                type="button"
                onClick={() => {
                  setVoucherError(null);
                  setSellingVoucher(true);
                }}
                className="text-[12px] font-semibold text-taupe transition-colors hover:text-taupe-deep"
              >
                + Gift voucher
              </button>
              <span className="text-[11px] text-faintink">A Hairline sale, no stylist</span>
            </div>
          )}

          {hasLines && (
            <>
              <TipPanel
                tips={till.tips}
                suggestedIds={tipStylists.map((s) => s.id)}
                onTip={(stylistId, amount) => dispatch({ type: "tip", stylistId, amount })}
                extra={
                  <button
                    type="button"
                    onClick={() => {
                      setVoucherError(null);
                      setSellingVoucher(true);
                    }}
                    title="Sold as a Hairline sale, with no stylist against it"
                    className="text-[11.5px] font-semibold text-taupe transition-colors hover:text-taupe-deep"
                  >
                    + Gift voucher
                  </button>
                }
              />

              {/* Totals — the anchor of the screen */}
              <div
                className={`shrink-0 px-5 py-3 text-white transition-colors duration-200 ${
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

                <div className="mt-2 flex items-baseline justify-between border-t border-white/[0.18] pt-2">
                  <span className="text-[12px] uppercase tracking-[0.12em] text-[#e6e0d4]">
                    {changeDue ? "Change due" : "Balance"}
                  </span>
                  <span className="tnum text-[32px] font-semibold leading-none tracking-[-0.025em]">
                    {zar(changeDue ? totals.change : totals.balance)}
                  </span>
                </div>
              </div>

              <PaymentPanel
                totals={totals}
                taken={till.payments}
                method={method}
                onMethod={setMethod}
                onRedeemVoucher={() => {
                  setMethod("voucher");
                  setVoucherError(null);
                  setRedeeming(true);
                }}
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

      {sellingVoucher && (
        <VoucherDialog
          today={demoToday()}
          nextNumber={nextVoucherNumber(vouchers)}
          error={voucherError}
          onAdd={addVoucherLine}
          onClose={() => {
            setSellingVoucher(false);
            setVoucherError(null);
          }}
        />
      )}

      {redeeming && (
        <RedeemVoucherDialog
          vouchers={vouchers}
          owing={totals.balance}
          today={demoToday()}
          error={voucherError}
          stylists={staffForPicker.map((m) => ({ id: m.id, name: m.name }))}
          /* Whoever is already doing the work on this sale. */
          defaultStylistId={
            till.lines.find((l) => l.kind === "service" && l.stylistId != null)?.stylistId ??
            defaultStylist
          }
          onRedeem={takeVoucher}
          onClose={() => {
            setRedeeming(false);
            setVoucherError(null);
          }}
        />
      )}

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

      {showingHistory && till.clientId != null && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-ink/40 px-4 py-8"
          role="dialog"
          aria-modal="true"
          aria-label={`What ${till.clientName ?? "this client"} has bought before`}
          onClick={() => setShowingHistory(false)}
        >
          <div className="w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <PurchaseHistory
              clientId={till.clientId}
              clientName={till.clientName ?? "This client"}
              visits={till.clientId < 0 ? [] : pastVisits}
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowingHistory(false)}
                className="rounded bg-card px-4 py-2 text-sm font-semibold text-ink"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {amending != null && (() => {
        const invoice = invoices.find((i) => i.id === amending);
        if (!invoice) return null;
        return (
          <AmendDocketDialog
            invoice={invoice}
            stylists={staffForPicker.map((m) => ({ id: m.id, name: m.name }))}
            by={overrideBy}
            onConfirmPassword={confirmPassword}
            onClose={() => setAmending(null)}
            onSave={(corrected) => {
              updateInvoice(corrected);
              setAmending(null);
            }}
          />
        );
      })()}

      {slip && <InvoiceSlip data={slip} onClose={() => setSlip(null)} />}
    </div>
  );
}
