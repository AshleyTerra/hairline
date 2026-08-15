"use client";

import { useMemo, useState } from "react";
import { longDate, zar } from "@/lib/format";
import { balanceOf, findVouchers, isExpired, usedOf, type Voucher } from "@/lib/vouchers";

/**
 * Redeeming a voucher against the sale on screen. Reception finds it by barcode,
 * by the recipient, or by whoever bought it, then takes as much of it as the
 * client wants to use — the rest stays on the voucher for their next visit.
 */
export function RedeemVoucherDialog({
  vouchers,
  owing,
  today,
  error,
  stylists,
  defaultStylistId,
  onRedeem,
  onClose,
}: {
  vouchers: readonly Voucher[];
  /** What is still to pay on this sale, offered as the amount to take. */
  owing: number;
  today: string;
  error?: string | null;
  /** Who the redeemed work can be credited to. */
  stylists: readonly { id: number; name: string }[];
  /** Whoever is already on the sale, offered first. */
  defaultStylistId: number | null;
  onRedeem: (voucher: Voucher, amount: number, stylistId: number | null) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Voucher | null>(null);
  const [amount, setAmount] = useState("");
  const [stylistId, setStylistId] = useState<number | "">(defaultStylistId ?? "");

  const matches = useMemo(() => findVouchers(vouchers, query).slice(0, 8), [vouchers, query]);
  const left = picked ? balanceOf(picked) : 0;
  const expired = picked ? isExpired(picked, today) : false;

  const field =
    "w-full rounded border border-hairline bg-paper px-3 py-2 text-sm text-ink placeholder:text-mutedink";
  const legend = "mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-mutedink";

  function choose(voucher: Voucher) {
    setPicked(voucher);
    /* Whichever is smaller: what is left on it, or what is still owed. */
    setAmount(String(Math.min(balanceOf(voucher), owing > 0 ? owing : balanceOf(voucher))));
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-ink/40 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-label="Redeem a voucher"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (picked) {
            onRedeem(picked, Number(amount) || 0, stylistId === "" ? null : Number(stylistId));
          }
        }}
        noValidate
        className="w-full max-w-sm rounded-lg border border-hairline bg-card"
      >
        <div className="flex items-start justify-between gap-3 border-b border-hairline px-5 py-3.5">
          <div>
            <h2 className="text-base font-semibold text-ink">Redeem a voucher</h2>
            <p className="text-xs text-mutedink">{zar(owing)} still to pay on this sale.</p>
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
            <span className={legend}>Barcode, recipient or client</span>
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPicked(null);
              }}
              placeholder="Scan the card, or type a name"
              aria-label="Find a voucher"
              className={field}
              autoFocus
            />
          </label>

          {!picked && query.trim() !== "" && (
            <ul className="max-h-44 overflow-y-auto rounded border border-hairline-soft">
              {matches.length === 0 ? (
                <li className="px-3 py-3 text-xs text-mutedink">
                  No voucher matches that. Vouchers sold in this demo can be found by barcode,
                  recipient or the client who bought it.
                </li>
              ) : (
                matches.map((v) => (
                  <li key={v.number} className="border-b border-hairline-soft last:border-0">
                    <button
                      type="button"
                      onClick={() => choose(v)}
                      className="flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left hover:bg-chip"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-ink">{v.recipientName}</span>
                        <span className="tnum block truncate text-[11px] text-mutedink">
                          {v.barcode} · bought by {v.clientName}
                        </span>
                      </span>
                      <span className="tnum shrink-0 text-sm font-semibold text-ink">
                        {zar(balanceOf(v))}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}

          {picked && (
            <>
              <dl className="rounded border border-hairline-soft px-3 py-2.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-mutedink">Recipient</dt>
                  <dd className="text-ink">{picked.recipientName}</dd>
                </div>
                <div className="mt-1 flex justify-between">
                  <dt className="text-mutedink">Voucher</dt>
                  <dd className="tnum text-ink">{zar(picked.amount)}</dd>
                </div>
                <div className="mt-1 flex justify-between">
                  <dt className="text-mutedink">Used so far</dt>
                  <dd className="tnum text-ink">{zar(usedOf(picked))}</dd>
                </div>
                <div className="mt-1 flex justify-between border-t border-hairline-soft pt-1">
                  <dt className="font-semibold text-ink">Left on it</dt>
                  <dd className="tnum font-semibold text-ink">{zar(left)}</dd>
                </div>
                <div className="mt-1 flex justify-between">
                  <dt className="text-mutedink">Expires</dt>
                  <dd className={expired ? "text-crit" : "text-ink"}>
                    {longDate(picked.expires)}
                    {expired ? " — expired" : ""}
                  </dd>
                </div>
              </dl>

              <label className="block">
                <span className={legend}>Take from it now</span>
                <input
                  type="number"
                  min={0}
                  step={10}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  aria-label="Amount to redeem"
                  className={field}
                />
                <span className="mt-1 block text-xs text-mutedink">
                  Anything left stays on the voucher for their next visit.
                </span>
              </label>

              {/* Who did the work. The money was banked when the voucher was
                  sold, so this credits their turnover without the salon
                  counting the same rand a second time. */}
              <label className="block">
                <span className={legend}>Work done by</span>
                <select
                  value={stylistId}
                  onChange={(e) =>
                    setStylistId(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  aria-label="Stylist the redeemed work belongs to"
                  className={field}
                >
                  <option value="">Nobody — a salon sale</option>
                  {stylists.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-mutedink">
                  Counts towards their turnover for wages. The salon banked the money when the
                  voucher was sold, so it is not taken as turnover twice.
                </span>
              </label>
            </>
          )}

          {error && (
            <p role="alert" className="rounded bg-crit-soft px-3 py-2 text-xs text-crit">
              {error}
            </p>
          )}
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
            disabled={!picked}
            className="rounded bg-taupe-deep px-4 py-2 text-sm font-semibold text-white hover:bg-ink disabled:opacity-40"
          >
            {picked ? `Take ${zar(Number(amount) || 0)}` : "Find the voucher"}
          </button>
        </div>
      </form>
    </div>
  );
}
