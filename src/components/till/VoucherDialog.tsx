"use client";

import { useState } from "react";
import { DEFAULT_VOUCHER_MONTHS, expiryFrom, type VoucherDraft } from "@/lib/vouchers";
import { longDate } from "@/lib/format";

/**
 * Selling a gift voucher. It goes onto the docket like any other line, so it can
 * be paid for alongside a cut and a bottle of shampoo. The recipient is often not
 * the person paying, which is why their name and number are asked for here.
 */
export function VoucherDialog({
  today,
  nextNumber,
  error,
  onAdd,
  onClose,
}: {
  /** The trading day, which the twelve months run from. */
  today: string;
  /** Offered as the barcode when the card has no printed one. */
  nextNumber: number;
  error?: string | null;
  onAdd: (draft: VoucherDraft) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<VoucherDraft>({
    recipientName: "",
    recipientTel: "",
    amount: 0,
    expires: expiryFrom(today),
    barcode: "",
  });
  const [amount, setAmount] = useState("");

  const field =
    "w-full rounded border border-hairline bg-paper px-3 py-2 text-sm text-ink placeholder:text-mutedink";
  const legend = "mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-mutedink";

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-ink/40 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-label="Sell a gift voucher"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onAdd({ ...draft, amount: Number(amount) || 0 });
        }}
        noValidate
        className="w-full max-w-sm rounded-lg border border-hairline bg-card"
      >
        <div className="flex items-start justify-between gap-3 border-b border-hairline px-5 py-3.5">
          <div>
            <h2 className="text-base font-semibold text-ink">Sell a gift voucher</h2>
            <p className="text-xs text-mutedink">
              Goes on this docket. Voucher {nextNumber}.
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

        <div className="flex flex-col gap-3 px-5 py-4">
          <label className="block">
            <span className={legend}>Recipient&apos;s name</span>
            <input
              type="text"
              value={draft.recipientName}
              onChange={(e) => setDraft({ ...draft, recipientName: e.target.value })}
              placeholder="Who is it for?"
              aria-label="Recipient name"
              className={field}
            />
          </label>

          <label className="block">
            <span className={legend}>
              Recipient&apos;s cell{" "}
              <span className="font-normal normal-case tracking-normal">(optional)</span>
            </span>
            <input
              type="tel"
              value={draft.recipientTel}
              onChange={(e) => setDraft({ ...draft, recipientTel: e.target.value })}
              placeholder="084 811 0426"
              aria-label="Recipient cell"
              className={field}
            />
          </label>

          <div className="flex gap-3">
            <label className="block flex-1">
              <span className={legend}>Amount</span>
              <input
                type="number"
                min={0}
                step={50}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1000"
                aria-label="Voucher amount"
                className={field}
              />
            </label>

            <label className="block flex-1">
              <span className={legend}>Expires</span>
              <input
                type="date"
                value={draft.expires}
                min={today}
                onChange={(e) => setDraft({ ...draft, expires: e.target.value })}
                aria-label="Expiry date"
                className={field}
              />
            </label>
          </div>

          <label className="block">
            <span className={legend}>
              Barcode{" "}
              <span className="font-normal normal-case tracking-normal">
                (blank uses {nextNumber})
              </span>
            </span>
            <input
              type="text"
              value={draft.barcode}
              onChange={(e) => setDraft({ ...draft, barcode: e.target.value })}
              placeholder={String(nextNumber)}
              aria-label="Barcode"
              className={field}
            />
          </label>

          {error && (
            <p role="alert" className="rounded bg-crit-soft px-3 py-2 text-xs text-crit">
              {error}
            </p>
          )}

          <p className="text-[11px] text-mutedink">
            {DEFAULT_VOUCHER_MONTHS} months by default, so this one runs to{" "}
            {longDate(draft.expires)}. The money counts as a Hairline sale, not a stylist&apos;s —
            they earn it when the voucher is used.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-hairline px-5 py-3.5">
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
            Add to the sale
          </button>
        </div>
      </form>
    </div>
  );
}
