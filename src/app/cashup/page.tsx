"use client";

import { useMemo, useState } from "react";
import { StatTile } from "@/components/charts";
import { Card, CardTitle, PageHeader } from "@/components/ui";
import { demoday } from "@/lib/data";
import { longDate, zar } from "@/lib/format";
import { useStore } from "@/lib/store";

/** South African notes and coins, largest first — the order reception counts in. */
const DENOMINATIONS = [
  { value: 200, label: "R200", kind: "note" },
  { value: 100, label: "R100", kind: "note" },
  { value: 50, label: "R50", kind: "note" },
  { value: 20, label: "R20", kind: "note" },
  { value: 10, label: "R10", kind: "note" },
  { value: 5, label: "R5", kind: "coin" },
  { value: 2, label: "R2", kind: "coin" },
  { value: 1, label: "R1", kind: "coin" },
  { value: 0.5, label: "50c", kind: "coin" },
  { value: 0.2, label: "20c", kind: "coin" },
  { value: 0.1, label: "10c", kind: "coin" },
] as const;

export default function CashupPage() {
  const { invoices } = useStore();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [float, setFloat] = useState(demoday.float);
  const [locked, setLocked] = useState(false);

  // Expected cash = the real demo day plus any cash taken in this demo session.
  const playCash = invoices.reduce(
    (sum, inv) =>
      sum + inv.payments.filter((p) => p.method === "cash").reduce((s, p) => s + p.amount, 0),
    0
  );
  const playCard = invoices.reduce(
    (sum, inv) =>
      sum + inv.payments.filter((p) => p.method === "card").reduce((s, p) => s + p.amount, 0),
    0
  );
  const playEft = invoices.reduce(
    (sum, inv) =>
      sum + inv.payments.filter((p) => p.method === "eft").reduce((s, p) => s + p.amount, 0),
    0
  );

  const expectedCash = demoday.totals.cash + playCash;
  const expectedCard = demoday.totals.card + playCard;
  const expectedEft = demoday.totals.eft + playEft;
  const expectedVoucher = demoday.totals.voucher;

  const countedCash = useMemo(
    () =>
      DENOMINATIONS.reduce(
        (sum, d) => sum + (counts[d.label] ?? 0) * d.value,
        0
      ),
    [counts]
  );

  const cashInDrawer = countedCash - float;
  const variance = Math.round((cashInDrawer - expectedCash) * 100) / 100;

  const dayTotal = expectedCash + expectedCard + expectedEft + expectedVoucher;

  function setCount(label: string, value: string) {
    const n = Math.max(0, Number(value.replace(/\D/g, "")) || 0);
    setCounts((prev) => ({ ...prev, [label]: n }));
  }

  return (
    <>
      <PageHeader
        eyebrow="End of day"
        title="Cash-up"
        subtitle={`${longDate(demoday.date)} · count the drawer, card and EFT fill themselves in`}
        actions={
          locked ? (
            <span className="rounded-full bg-good-soft px-3 py-1 text-xs font-semibold text-good">
              Locked
            </span>
          ) : (
            <span className="rounded-full bg-warn-soft px-3 py-1 text-xs font-semibold text-warn">
              Open
            </span>
          )
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Day total" value={zar(dayTotal)} hint={`${demoday.invoiceCount + invoices.length} sales`} />
        <StatTile label="Expected in drawer" value={zar(expectedCash)} hint="Cash sales only" />
        <StatTile label="Counted" value={zar(cashInDrawer)} hint={`After R${float} float`} />
        <StatTile
          label="Variance"
          value={`${variance >= 0 ? "+" : ""}${zar(variance)}`}
          hint={
            countedCash === 0
              ? "Start counting to check"
              : Math.abs(variance) < 1
                ? "Balanced"
                : variance > 0
                  ? "Over — recount or check the float"
                  : "Short — recount"
          }
          tone={countedCash === 0 ? "neutral" : Math.abs(variance) < 1 ? "good" : "crit"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardTitle right={<span className="text-xs text-mutedink">Count the drawer</span>}>
            Notes and coins
          </CardTitle>
          <div className="divide-y divide-hairline-soft">
            {DENOMINATIONS.map((d) => {
              const count = counts[d.label] ?? 0;
              return (
                <div key={d.label} className="flex items-center gap-3 px-4 py-2">
                  <span
                    className={`w-12 shrink-0 text-sm font-semibold ${
                      d.kind === "note" ? "text-ink" : "text-mutedink"
                    }`}
                  >
                    {d.label}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCount(d.label, String(Math.max(0, count - 1)))}
                      disabled={locked}
                      aria-label={`One fewer ${d.label}`}
                      className="h-7 w-7 rounded border border-hairline text-mutedink hover:bg-hairline-soft disabled:opacity-40"
                    >
                      −
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={count || ""}
                      onChange={(e) => setCount(d.label, e.target.value)}
                      disabled={locked}
                      placeholder="0"
                      aria-label={`Number of ${d.label}`}
                      className="tnum w-14 rounded border border-hairline bg-paper px-2 py-1 text-center text-sm text-ink disabled:opacity-60"
                    />
                    <button
                      type="button"
                      onClick={() => setCount(d.label, String(count + 1))}
                      disabled={locked}
                      aria-label={`One more ${d.label}`}
                      className="h-7 w-7 rounded border border-hairline text-mutedink hover:bg-hairline-soft disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                  <span className="tnum ml-auto text-sm text-body">
                    {count > 0 ? zar(count * d.value) : "—"}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between border-t border-hairline px-4 py-3">
            <span className="text-sm font-semibold text-ink">Total counted</span>
            <span className="tnum text-lg font-semibold text-ink">{zar(countedCash)}</span>
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardTitle right={<span className="text-xs text-mutedink">From the till</span>}>
              Takings by method
            </CardTitle>
            <dl className="divide-y divide-hairline-soft text-sm">
              {[
                { label: "Cash", value: expectedCash },
                { label: "Card", value: expectedCard },
                { label: "EFT", value: expectedEft },
                { label: "Vouchers", value: expectedVoucher },
              ].map((row) => (
                <div key={row.label} className="flex justify-between px-4 py-2.5">
                  <dt className="text-body">{row.label}</dt>
                  <dd className="tnum font-semibold text-ink">{zar(row.value)}</dd>
                </div>
              ))}
              <div className="flex justify-between bg-paper px-4 py-2.5">
                <dt className="font-semibold text-ink">Day total</dt>
                <dd className="tnum font-semibold text-ink">{zar(dayTotal)}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardTitle>Float and close</CardTitle>
            <div className="px-4 py-4">
              <label className="mb-4 flex items-center justify-between gap-3 text-sm">
                <span className="text-body">Float left in the drawer</span>
                <input
                  type="number"
                  min={0}
                  value={float}
                  onChange={(e) => setFloat(Math.max(0, Number(e.target.value) || 0))}
                  disabled={locked}
                  className="tnum w-24 rounded border border-hairline bg-paper px-2 py-1.5 text-right text-sm text-ink disabled:opacity-60"
                />
              </label>

              {locked ? (
                <div className="rounded bg-good-soft px-3 py-3 text-sm text-good">
                  <p className="font-semibold">Day locked.</p>
                  <p className="mt-0.5 text-xs">
                    Counted {zar(countedCash)}, banking {zar(cashInDrawer)}, variance{" "}
                    {zar(variance)}. Nothing can be changed after this point — the audit trail keeps
                    the record.
                  </p>
                  <button
                    type="button"
                    onClick={() => setLocked(false)}
                    className="mt-2 text-xs underline underline-offset-2"
                  >
                    Unlock (prototype only)
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setLocked(true)}
                  disabled={countedCash === 0}
                  className="w-full rounded bg-taupe-deep px-4 py-3 text-sm font-semibold text-white hover:bg-ink disabled:cursor-not-allowed disabled:bg-hairline disabled:text-mutedink"
                >
                  {countedCash === 0 ? "Count the drawer first" : "Lock the day"}
                </button>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
