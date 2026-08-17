"use client";

import { useState } from "react";
import { zar } from "@/lib/format";
import { demoNow } from "@/lib/clock";
import {
  amendedTotal,
  paymentsMatchTotal,
  recordAmendment,
  setLineStylist,
  setPaymentMethod,
  splitLine,
  splitPayment,
} from "@/lib/amend";
import type { PaymentMethod, PlayInvoice } from "@/lib/types";

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "card", label: "Card" },
  { value: "cash", label: "Cash" },
  { value: "eft", label: "EFT" },
  { value: "voucher", label: "Voucher" },
  { value: "topay", label: "On account" },
];

interface AmendDocketDialogProps {
  invoice: PlayInvoice;
  /** Who a line can be credited to. */
  stylists: readonly { id: number; name: string }[];
  /** The person amending, for the trail. */
  by: string;
  /** Checks their own password before anything can be changed. */
  onConfirmPassword: (password: string) => boolean;
  onSave: (invoice: PlayInvoice) => void;
  onClose: () => void;
}

/**
 * Correcting a docket that has already been closed.
 *
 * Two things go wrong in haste, and these are the two this fixes: the work was
 * not split between the two stylists who did it, and the wrong payment type was
 * chosen. Neither changes what the client paid, so the total is shown throughout
 * and the dialog refuses to save if it has moved.
 *
 * The password is the user's own. It is asked for first, so nothing can be
 * changed by somebody who wandered past an unattended screen.
 */
export function AmendDocketDialog({
  invoice,
  stylists,
  by,
  onConfirmPassword,
  onSave,
  onClose,
}: AmendDocketDialogProps) {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [draft, setDraft] = useState<PlayInvoice>(invoice);
  const [notes, setNotes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  /** Splitting one line: which line, with whom, and what share. */
  const [splitting, setSplitting] = useState<string | null>(null);
  const [splitWith, setSplitWith] = useState<number | "">("");
  const [splitShare, setSplitShare] = useState("50");

  /** Splitting one payment: which, onto what method, and how much. */
  const [payingSplit, setPayingSplit] = useState<number | null>(null);
  const [splitMethod, setSplitMethod] = useState<PaymentMethod>("cash");
  const [splitAmount, setSplitAmount] = useState("");

  const nameOf = (id: number | null) =>
    stylists.find((s) => s.id === id)?.name ?? "nobody";

  const note = (what: string) => setNotes((prev) => [...prev, what]);

  function unlock(e: React.FormEvent) {
    e.preventDefault();
    if (!onConfirmPassword(password)) {
      setError("That password does not match your own sign-in.");
      return;
    }
    setUnlocked(true);
    setPassword("");
    setError(null);
  }

  function moveLine(key: string, stylistId: number) {
    const line = draft.lines.find((l) => l.key === key);
    if (!line || line.stylistId === stylistId) return;
    setDraft(setLineStylist(draft, key, stylistId));
    note(`${line.descr} moved from ${nameOf(line.stylistId)} to ${nameOf(stylistId)}`);
  }

  function doSplitLine() {
    if (splitting == null || splitWith === "") return;
    const line = draft.lines.find((l) => l.key === splitting);
    const result = splitLine(draft, splitting, Number(splitWith), Number(splitShare));
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDraft(result.value);
    note(
      `${line?.descr ?? "Line"} split ${100 - Number(splitShare)}/${splitShare} between ` +
        `${nameOf(line?.stylistId ?? null)} and ${nameOf(Number(splitWith))}`
    );
    setSplitting(null);
    setSplitWith("");
    setError(null);
  }

  function changeMethod(index: number, method: PaymentMethod) {
    const was = draft.payments[index];
    if (!was || was.method === method) return;
    setDraft(setPaymentMethod(draft, index, method));
    note(`${zar(was.amount)} moved from ${was.method} to ${method}`);
  }

  function doSplitPayment() {
    if (payingSplit == null) return;
    const was = draft.payments[payingSplit];
    const result = splitPayment(draft, payingSplit, splitMethod, Number(splitAmount));
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDraft(result.value);
    note(`${zar(Number(splitAmount))} of ${zar(was.amount)} moved to ${splitMethod}`);
    setPayingSplit(null);
    setSplitAmount("");
    setError(null);
  }

  function save() {
    if (notes.length === 0) {
      setError("Nothing has been changed yet.");
      return;
    }
    if (amendedTotal(draft) !== amendedTotal(invoice)) {
      setError("The docket total has moved. An amendment must not change what was charged.");
      return;
    }
    if (!paymentsMatchTotal(draft)) {
      setError("The payments no longer add up to what was taken.");
      return;
    }
    onSave(recordAmendment(draft, by, demoNow(), notes.join("; ")));
  }

  const field = "rounded border border-hairline bg-paper px-2 py-1.5 text-xs text-ink";
  const legend = "mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-mutedink";
  const moved = amendedTotal(draft) !== amendedTotal(invoice);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/50 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-label={`Amend invoice ${invoice.id}`}
    >
      <div className="w-full max-w-2xl rounded-lg border border-hairline bg-card">
        <div className="flex items-center justify-between border-b border-hairline px-5 py-3.5">
          <div>
            <h2 className="text-base font-semibold text-ink">Amend invoice #{invoice.id}</h2>
            <p className="text-xs text-mutedink">
              {invoice.clientName} · {zar(amendedTotal(invoice))} · this cannot change what was
              charged
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-mutedink hover:text-ink"
          >
            ✕
          </button>
        </div>

        {/* ------------------------------------------------ the password gate */}
        {!unlocked ? (
          <form onSubmit={unlock} noValidate className="flex flex-col gap-3 px-5 py-5">
            <p className="text-sm text-body">
              A closed docket is part of the day&apos;s takings and of somebody&apos;s wage
              figure. Confirm your own password to correct it.
            </p>
            <label className="block">
              <span className={legend}>Your password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                autoComplete="current-password"
                aria-label="Your password"
                className={`w-full ${field}`}
              />
            </label>
            {error && (
              <p role="alert" className="rounded bg-crit-soft px-3 py-2 text-xs text-crit">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded px-3 py-2 text-sm text-mutedink hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded bg-taupe-deep px-4 py-2 text-sm font-semibold text-white hover:bg-ink"
              >
                Unlock
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* --------------------------------------------------- the lines */}
            <section className="border-b border-hairline-soft px-5 py-4">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-mutedink">
                Who did the work
              </h3>
              <ul className="flex flex-col gap-2">
                {draft.lines.map((line) => (
                  <li key={line.key} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 text-ink">{line.descr}</span>
                    <span className="tnum shrink-0 text-mutedink">
                      {zar(line.finalValue ?? line.price * line.qty * (1 - line.disc / 100))}
                    </span>
                    <select
                      value={line.stylistId ?? ""}
                      onChange={(e) => moveLine(line.key, Number(e.target.value))}
                      aria-label={`Stylist for ${line.descr}`}
                      className={field}
                    >
                      {line.stylistId == null && <option value="">Nobody</option>}
                      {stylists.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setSplitting(splitting === line.key ? null : line.key);
                        setError(null);
                      }}
                      className="rounded border border-hairline px-2 py-1 text-[11px] font-semibold text-taupe-deep hover:bg-chip"
                    >
                      Split
                    </button>

                    {splitting === line.key && (
                      <span className="flex w-full flex-wrap items-center gap-2 rounded bg-paper px-2.5 py-2">
                        <span className="text-[11px] text-mutedink">Share with</span>
                        <select
                          value={splitWith}
                          onChange={(e) =>
                            setSplitWith(e.target.value === "" ? "" : Number(e.target.value))
                          }
                          aria-label={`Split ${line.descr} with`}
                          className={field}
                        >
                          <option value="">Choose…</option>
                          {stylists
                            .filter((s) => s.id !== line.stylistId)
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                        </select>
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={splitShare}
                          onChange={(e) => setSplitShare(e.target.value)}
                          aria-label={`Share for ${line.descr}`}
                          className={`tnum w-16 ${field}`}
                        />
                        <span className="text-[11px] text-mutedink">% to them</span>
                        <button
                          type="button"
                          onClick={doSplitLine}
                          className="rounded bg-taupe-deep px-2.5 py-1 text-[11px] font-semibold text-white"
                        >
                          Split it
                        </button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            {/* ------------------------------------------------ the payments */}
            <section className="border-b border-hairline-soft px-5 py-4">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-mutedink">
                How it was paid
              </h3>
              <ul className="flex flex-col gap-2">
                {draft.payments.map((p, i) => (
                  <li key={`${p.method}-${i}`} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="tnum min-w-0 flex-1 text-ink">{zar(p.amount)}</span>
                    <select
                      value={p.method}
                      onChange={(e) => changeMethod(i, e.target.value as PaymentMethod)}
                      aria-label={`Method for payment ${i + 1}`}
                      className={field}
                    >
                      {METHODS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setPayingSplit(payingSplit === i ? null : i);
                        setError(null);
                      }}
                      className="rounded border border-hairline px-2 py-1 text-[11px] font-semibold text-taupe-deep hover:bg-chip"
                    >
                      Split
                    </button>

                    {payingSplit === i && (
                      <span className="flex w-full flex-wrap items-center gap-2 rounded bg-paper px-2.5 py-2">
                        <span className="text-[11px] text-mutedink">Move</span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={splitAmount}
                          onChange={(e) => setSplitAmount(e.target.value)}
                          aria-label={`Amount to move off payment ${i + 1}`}
                          className={`tnum w-24 ${field}`}
                        />
                        <span className="text-[11px] text-mutedink">onto</span>
                        <select
                          value={splitMethod}
                          onChange={(e) => setSplitMethod(e.target.value as PaymentMethod)}
                          aria-label={`Other method for payment ${i + 1}`}
                          className={field}
                        >
                          {METHODS.map((m) => (
                            <option key={m.value} value={m.value}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={doSplitPayment}
                          className="rounded bg-taupe-deep px-2.5 py-1 text-[11px] font-semibold text-white"
                        >
                          Split it
                        </button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            {/* --------------------------------------------------- the trail */}
            <div className="px-5 py-4">
              <div className="mb-3 flex items-center justify-between gap-3 rounded bg-paper px-3 py-2 text-sm">
                <span className="text-mutedink">Docket total</span>
                <span className={`tnum font-semibold ${moved ? "text-crit" : "text-ink"}`}>
                  {zar(amendedTotal(draft))}
                  {moved && <span className="ml-2 text-[11px]">must not change</span>}
                </span>
              </div>

              {notes.length > 0 && (
                <ul className="mb-3 flex flex-col gap-1">
                  {notes.map((n, i) => (
                    <li key={i} className="text-[12px] text-body">
                      · {n}
                    </li>
                  ))}
                </ul>
              )}

              <p className="mb-3 text-[11px] text-faintink">
                Recorded against {by}, with the time. The turnover reports pick the correction up
                straight away.
              </p>

              {error && (
                <p role="alert" className="mb-3 rounded bg-crit-soft px-3 py-2 text-xs text-crit">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded px-3 py-2 text-sm text-mutedink hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={notes.length === 0 || moved}
                  className="rounded bg-taupe-deep px-4 py-2 text-sm font-semibold text-white hover:bg-ink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Save the correction
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
