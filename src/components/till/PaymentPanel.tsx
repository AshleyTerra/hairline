"use client";

import { useState } from "react";
import { zar } from "@/lib/format";
import type { Payment, PaymentMethod, TillTotals } from "@/lib/types";

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "card", label: "Card" },
  { value: "cash", label: "Cash" },
  { value: "eft", label: "EFT" },
  { value: "voucher", label: "Voucher" },
  { value: "topay", label: "To pay" },
];

const NOTES = [500, 200, 100, 50];

interface PaymentPanelProps {
  totals: TillTotals;
  payments: Payment[];
  onPay: (payment: Payment) => void;
  onUnpay: (index: number) => void;
}

export function PaymentPanel({ totals, payments, onPay, onUnpay }: PaymentPanelProps) {
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [amount, setAmount] = useState("");

  const value = Number(amount.replace(/[^\d.]/g, "")) || 0;

  function submit(overrideAmount?: number) {
    const pay = overrideAmount ?? value;
    if (pay <= 0) return;
    onPay({ method, amount: pay });
    setAmount("");
  }

  return (
    <div className="border-t border-hairline-soft p-4">
      <div className="mb-2 flex flex-wrap gap-1">
        {METHODS.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setMethod(m.value)}
            aria-pressed={method === m.value}
            className={`rounded px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              method === m.value ? "bg-taupe text-white" : "bg-chip text-taupe-deep hover:bg-hairline"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Amount"
          aria-label={`${method} amount`}
          className="tnum w-full rounded border border-hairline bg-paper px-3 py-2 text-sm text-ink placeholder:text-mutedink"
        />
        <button
          type="button"
          onClick={() => submit()}
          disabled={value <= 0}
          className="shrink-0 rounded bg-taupe-deep px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Add
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {totals.balance > 0 && (
          <button
            type="button"
            onClick={() => submit(totals.balance)}
            className="rounded bg-chip px-2.5 py-1 text-xs font-semibold text-taupe-deep hover:bg-hairline"
          >
            Exact {zar(totals.balance)}
          </button>
        )}
        {method === "cash" &&
          NOTES.filter((n) => n >= totals.balance).slice(-3).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => submit(n)}
              className="tnum rounded bg-chip px-2.5 py-1 text-xs font-semibold text-taupe-deep hover:bg-hairline"
            >
              R{n}
            </button>
          ))}
      </div>

      {payments.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {payments.map((p, i) => (
            <li
              key={`${p.method}-${i}`}
              className="flex items-center justify-between rounded bg-paper px-2.5 py-1.5 text-xs"
            >
              <span className="capitalize text-body">
                {METHODS.find((m) => m.value === p.method)?.label ?? p.method}
              </span>
              <span className="flex items-center gap-2">
                <span className="tnum font-semibold text-ink">{zar(p.amount)}</span>
                <button
                  type="button"
                  onClick={() => onUnpay(i)}
                  aria-label={`Remove ${p.method} payment`}
                  className="text-mutedink hover:text-crit"
                >
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
