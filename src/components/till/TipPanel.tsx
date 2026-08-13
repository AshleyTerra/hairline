"use client";

import { useState, type ReactNode } from "react";
import { staff } from "@/lib/data";
import { zar } from "@/lib/format";
import { creditable, roster } from "@/lib/roster";
import { useStore } from "@/lib/store";
import type { Tip } from "@/lib/types";

interface TipPanelProps {
  tips: Tip[];
  /** Stylists already on the sale, offered first in the dropdown. */
  suggestedIds: number[];
  onTip: (stylistId: number, amount: number) => void;
  /** Shares this strip — the gift voucher action, so the panel keeps its height. */
  extra?: ReactNode;
}

/**
 * Tips, with an operator dropdown so anyone can be tipped — including the
 * assistants, who earn tips daily but never appear on the invoice lines.
 */
export function TipPanel({ tips, suggestedIds, onTip, extra }: TipPanelProps) {
  const [adding, setAdding] = useState(false);
  const [who, setWho] = useState<number | "">(suggestedIds[0] ?? "");
  const [amount, setAmount] = useState("");

  /* Everyone on the books today bar reception, with the sale's stylists first. */
  const { staffRecords } = useStore();
  const tippable = creditable(roster(staffRecords, staff));
  const choices = [
    ...tippable.filter((m) => suggestedIds.includes(m.id)),
    ...tippable.filter((m) => !suggestedIds.includes(m.id)),
  ];

  function add() {
    const value = Number(amount);
    if (who === "" || !Number.isFinite(value) || value <= 0) return;
    onTip(Number(who), value);
    setAmount("");
    setAdding(false);
  }

  /* Records first, so a rename in Admin shows on a tip already taken. */
  const nameOf = (id: number) =>
    staffRecords.find((r) => r.id === id)?.name ?? staff.find((s) => s.id === id)?.name ?? "Unknown";

  return (
    <div className="shrink-0 border-t border-edge-faint px-5 py-2">
      <div className="mb-1 flex items-center justify-between gap-3">
        <p className="text-[10.5px] uppercase tracking-[0.1em] text-faintink">Tip</p>
        <span className="flex items-center gap-4">
          {extra}
          {!adding && (
            <button
              type="button"
              onClick={() => {
                setAdding(true);
                setWho(suggestedIds[0] ?? "");
              }}
              className="text-[11.5px] font-semibold text-taupe transition-colors hover:text-taupe-deep"
            >
              + Add tip
            </button>
          )}
        </span>
      </div>

      {tips.length > 0 && (
        <ul className="mb-1.5 flex flex-col gap-1">
          {tips.map((t) => (
            <li key={t.stylistId} className="flex items-center justify-between gap-2">
              <span className="truncate text-[12.5px] text-body">{nameOf(t.stylistId)}</span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="tnum text-[12.5px] font-semibold text-ink">{zar(t.amount)}</span>
                <button
                  type="button"
                  onClick={() => onTip(t.stylistId, 0)}
                  aria-label={`Remove tip for ${nameOf(t.stylistId)}`}
                  className="text-faintink transition-colors hover:text-crit"
                >
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <div className="flex items-center gap-1.5">
          <select
            value={who}
            onChange={(e) => setWho(e.target.value === "" ? "" : Number(e.target.value))}
            aria-label="Who is the tip for"
            className="min-w-0 flex-1 rounded-lg bg-canvas px-2 py-1.5 text-[12.5px] text-ink"
          >
            <option value="">Choose operator…</option>
            {choices.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.support ? ` (${m.designation.toLowerCase()})` : ""}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="0"
            aria-label="Tip amount"
            className="tnum w-20 rounded-lg bg-canvas px-2 py-1.5 text-right text-[12.5px] text-ink"
          />
          <button
            type="button"
            onClick={add}
            className="rounded-lg bg-taupe-deep px-2.5 py-1.5 text-[12px] font-semibold text-white"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="px-1 text-[12px] text-faintink hover:text-ink"
          >
            Cancel
          </button>
        </div>
      )}

      {tips.length > 0 && (
        <p className="mt-1.5 text-[11px] text-faintink">
          Added to what the client pays, but kept out of the stylist&apos;s sales figure.
        </p>
      )}
    </div>
  );
}
