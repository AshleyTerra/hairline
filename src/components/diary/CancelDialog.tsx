"use client";

import { useState } from "react";
import { zar0 } from "@/lib/format";
import { endTime, type Appointment } from "@/lib/diary";

/**
 * Cancelling a booking. Most cancellations cost nothing; a late one costs the
 * stylist an empty chair, so the salon can put a charge on it. The suggestion is
 * half the service — reception decides, and can waive it outright.
 */
export function CancelDialog({
  appointment,
  suggested,
  hasDocket,
  onConfirm,
  onClose,
}: {
  appointment: Appointment;
  /** Half the service price, offered as the starting figure. */
  suggested: number;
  /** True when a docket was already opened for them. */
  hasDocket: boolean;
  onConfirm: (fee: number) => void;
  onClose: () => void;
}) {
  const [charge, setCharge] = useState(false);
  const [amount, setAmount] = useState(String(suggested));

  const fee = charge ? Math.max(0, Number(amount) || 0) : 0;
  const field = "w-full rounded border border-hairline bg-paper px-3 py-2 text-sm text-ink";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Cancel the booking"
    >
      <div className="w-full max-w-sm rounded-lg border border-hairline bg-card">
        <div className="border-b border-hairline px-5 py-3.5">
          <h2 className="text-base font-semibold text-ink">Cancel this booking?</h2>
          <p className="text-xs text-mutedink">
            {appointment.clientName} · {appointment.start}–
            {endTime(appointment.start, appointment.mins)} · {appointment.service}
          </p>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4">
          <label className="flex items-start gap-2.5 text-sm text-ink">
            <input
              type="checkbox"
              checked={charge}
              onChange={(e) => setCharge(e.target.checked)}
              aria-label="Charge a cancellation fee"
              className="mt-0.5 h-4 w-4 accent-[#6e6455]"
            />
            <span>
              Charge a cancellation fee
              <span className="block text-xs text-mutedink">
                Goes onto a docket awaiting payment, credited to the stylist who lost the chair.
              </span>
            </span>
          </label>

          {charge && (
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-mutedink">
                Fee
              </span>
              <input
                type="number"
                min={0}
                step={10}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-label="Cancellation fee"
                className={field}
              />
              <span className="mt-1 block text-xs text-mutedink">
                Half the service comes to {zar0(suggested)}.
              </span>
            </label>
          )}

          {hasDocket && (
            <p className="rounded bg-warn-soft px-3 py-2 text-xs text-warn">
              Their docket is open at the till. Cancelling closes it, so nothing is left waiting to
              be settled.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-hairline px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-2 text-sm text-mutedink hover:text-ink"
          >
            Keep the booking
          </button>
          <button
            type="button"
            onClick={() => onConfirm(fee)}
            className="rounded bg-taupe-deep px-4 py-2 text-sm font-semibold text-white hover:bg-ink"
          >
            {fee > 0 ? `Cancel and charge ${zar0(fee)}` : "Cancel, no charge"}
          </button>
        </div>
      </div>
    </div>
  );
}
