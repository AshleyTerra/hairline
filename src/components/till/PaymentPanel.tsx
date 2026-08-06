"use client";

import { zar } from "@/lib/format";
import type { PaymentMethod, TillTotals } from "@/lib/types";

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "card", label: "Card" },
  { value: "cash", label: "Cash" },
  { value: "eft", label: "EFT" },
  { value: "voucher", label: "Voucher" },
  { value: "topay", label: "To pay" },
];

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"];
const NOTES = [500, 200, 100, 50];

interface PaymentPanelProps {
  totals: TillTotals;
  method: PaymentMethod;
  onMethod: (method: PaymentMethod) => void;
  amount: string;
  /** Sets the whole amount, e.g. from a quick-tender button. */
  onAmount: (amount: string) => void;
  /** Appends one keypad key. Separate from onAmount so fast presses cannot
   *  read a stale value and drop digits. */
  onKey: (key: string) => void;
  onTender: () => void;
  onComplete: () => void;
}

/**
 * Methods, an on-screen keypad and the primary action. The keypad exists so the
 * counter can be worked without reaching for a keyboard.
 */
export function PaymentPanel({
  totals,
  method,
  onMethod,
  amount,
  onAmount,
  onKey,
  onTender,
  onComplete,
}: PaymentPanelProps) {
  const owing = totals.balance > 0;

  return (
    <div className="px-5 pb-5 pt-4">
      {/* Method */}
      <div className="mb-3 grid grid-cols-5 gap-[5px]">
        {METHODS.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => onMethod(m.value)}
            aria-pressed={method === m.value}
            className={`rounded-[10px] py-2.5 text-center text-[11.5px] font-semibold transition-colors ${
              method === m.value
                ? "bg-taupe text-white"
                : "bg-canvas text-taupe-deep hover:bg-chip"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* What is being tendered */}
      <div className="mb-3 flex items-center justify-between gap-3 rounded-[10px] bg-canvas px-3.5 py-2.5">
        <span className="text-[11px] uppercase tracking-[0.1em] text-faintink">Tender</span>
        <span
          className={`tnum text-[17px] font-semibold ${amount ? "text-ink" : "text-faintink"}`}
        >
          {amount ? `R ${amount}` : "—"}
        </span>
      </div>

      {/* Quick tenders */}
      <div className="mb-3 flex flex-wrap gap-[5px]">
        {owing && (
          <button
            type="button"
            onClick={() => onAmount(String(totals.balance))}
            className="rounded-[10px] bg-chip px-3 py-1.5 text-[11.5px] font-semibold text-taupe-deep transition-colors hover:bg-hairline"
          >
            Exact {zar(totals.balance)}
          </button>
        )}
        {method === "cash" &&
          NOTES.filter((n) => n >= totals.balance)
            .slice(-3)
            .map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onAmount(String(n))}
                className="tnum rounded-[10px] bg-chip px-3 py-1.5 text-[11.5px] font-semibold text-taupe-deep transition-colors hover:bg-hairline"
              >
                R{n}
              </button>
            ))}
      </div>

      {/* Keypad */}
      <div className="mb-3 grid grid-cols-3 gap-[7px]">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onKey(key)}
            aria-label={key === "⌫" ? "Delete last digit" : key}
            className="tnum rounded-[10px] bg-canvas py-[13px] text-center text-[17px] font-semibold text-ink transition-colors hover:bg-chip active:bg-hairline"
          >
            {key}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={owing ? onTender : onComplete}
        disabled={owing && !amount}
        className={`w-full rounded-[11px] py-[17px] text-center text-[15px] font-semibold transition-colors ${
          owing && !amount
            ? "cursor-not-allowed bg-hairline text-mutedink"
            : "bg-ink text-white hover:bg-black"
        }`}
      >
        {owing
          ? amount
            ? `Take R ${amount} & complete`
            : `${zar(totals.balance)} still owing`
          : `Complete sale — ${zar(totals.subtotal)}`}
      </button>
    </div>
  );
}
