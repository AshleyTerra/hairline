"use client";

import { useState } from "react";
import { validateStockEdit, type StockEditInput } from "@/lib/stockBook";
import type { Product } from "@/lib/types";

interface StockDialogProps {
  /** The line being corrected, or null when adding a new one. */
  product: Product | null;
  /** Which shelf a new line goes on. */
  shelf: "retail" | "backbar";
  onSave: (patch: {
    name: string;
    brand: string;
    cost: number;
    price: number;
    reorder: number;
    barcode: string;
  }) => void;
  onClose: () => void;
}

const blank: StockEditInput = {
  name: "",
  brand: "",
  cost: "",
  price: "",
  reorder: "0",
  barcode: "",
};

/**
 * Adding a stock line, or correcting one that is already there.
 *
 * Barcodes are free text on purpose: the same product turns up with a changed
 * code often enough that reception has to be able to fix it on the spot, and
 * plenty of items never carry a supplier barcode at all — so the salon writes
 * its own and scans that.
 */
export function StockDialog({ product, shelf, onSave, onClose }: StockDialogProps) {
  const [draft, setDraft] = useState<StockEditInput>(
    product
      ? {
          name: product.name,
          brand: product.brand,
          cost: product.cost ? String(product.cost) : "",
          price: product.price ? String(product.price) : "",
          reorder: String(product.reorder ?? 0),
          barcode: product.barcode ?? "",
        }
      : blank
  );
  const [problem, setProblem] = useState<{ field: string; error: string } | null>(null);

  const set = (key: keyof StockEditInput, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setProblem(null);
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = validateStockEdit(draft);
    if (!result.ok) {
      setProblem({ field: result.field, error: result.error });
      return;
    }
    onSave({
      name: result.patch.name!,
      brand: result.patch.brand!,
      cost: result.patch.cost!,
      price: result.patch.price!,
      reorder: result.patch.reorder!,
      barcode: result.patch.barcode!,
    });
  }

  const edge = (field: string) => (problem?.field === field ? "border-crit" : "border-hairline");
  const input = "w-full rounded border bg-paper px-3 py-2 text-sm text-ink placeholder:text-faintink";
  const legend = "mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-mutedink";

  const fields: { key: keyof StockEditInput; label: string; placeholder: string; hint?: string }[] = [
    { key: "name", label: "Item", placeholder: "Smooth Down Shampoo 300ml" },
    { key: "brand", label: "Brand", placeholder: "Redken" },
    { key: "cost", label: "Cost price", placeholder: "114,86", hint: "Excluding VAT, as the supplier invoices it" },
    { key: "price", label: "Selling price", placeholder: "225,00", hint: "Including VAT — what the client pays" },
    { key: "reorder", label: "Reorder level", placeholder: "2" },
    { key: "barcode", label: "Barcode", placeholder: "884486063274 or your own code" },
  ];

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-ink/40 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-label={product ? "Edit a stock item" : "Add a stock item"}
    >
      <form onSubmit={submit} noValidate className="w-full max-w-sm rounded-lg border border-hairline bg-card">
        <div className="flex items-center justify-between border-b border-hairline px-5 py-3.5">
          <h2 className="text-base font-semibold text-ink">
            {product ? "Edit stock item" : `Add to the ${shelf === "backbar" ? "back bar" : "retail shelf"}`}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-mutedink hover:text-ink">
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4">
          {fields.map((f) => (
            <label key={f.key} className="block">
              <span className={legend}>{f.label}</span>
              <input
                type="text"
                inputMode={f.key === "cost" || f.key === "price" || f.key === "reorder" ? "decimal" : "text"}
                value={draft[f.key]}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                aria-label={f.label}
                aria-invalid={problem?.field === f.key || undefined}
                className={`${input} ${edge(f.key)}`}
              />
              {f.hint && <span className="mt-1 block text-[11px] text-faintink">{f.hint}</span>}
            </label>
          ))}

          {problem && (
            <p role="alert" className="rounded bg-crit-soft px-3 py-2 text-xs text-crit">
              {problem.error}
            </p>
          )}

          {product && (
            <p className="text-[11px] text-faintink">
              Quantity on hand is not edited here — it moves by receiving, selling or counting.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-hairline px-5 py-3.5">
          <button type="button" onClick={onClose} className="rounded px-3 py-2 text-sm text-mutedink hover:text-ink">
            Cancel
          </button>
          <button
            type="submit"
            className="rounded bg-taupe-deep px-4 py-2 text-sm font-semibold text-white hover:bg-ink"
          >
            {product ? "Save changes" : "Add item"}
          </button>
        </div>
      </form>
    </div>
  );
}
