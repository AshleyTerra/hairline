"use client";

import { useMemo, useRef, useState } from "react";
import { Badge, Card, CardTitle, TableScroll } from "@/components/ui";
import { downloadCsv, toCsv } from "@/lib/csv";
import { products } from "@/lib/data";
import { zar } from "@/lib/format";
import {
  archive,
  archiveMany,
  inactiveItems,
  parseStockImport,
  unarchive,
  type Shelf,
  type StockDraft,
  type StockImportResult,
} from "@/lib/stockAdmin";
import { useStore } from "@/lib/store";

const TEMPLATE = toCsv(
  [
    { Item: "Smooth Shampoo 300ml", Brand: "Redken", Type: "Retail", Cost: "114.86", Price: "225", Reorder: "3", Barcode: "884486063274" },
    { Item: "20 Vol Chromatics 1L", Brand: "Redken", Type: "Back bar", Cost: "169.00", Price: "0", Reorder: "2", Barcode: "" },
  ],
  [
    { key: "Item", label: "Item" },
    { key: "Brand", label: "Brand" },
    { key: "Type", label: "Type" },
    { key: "Cost", label: "Cost" },
    { key: "Price", label: "Price" },
    { key: "Reorder", label: "Reorder" },
    { key: "Barcode", label: "Barcode" },
  ]
);

type Tab = "add" | "import" | "archive";

export function StockAdminPanel() {
  const { newStock, addStock, clearNewStock, archivedStock, setArchivedStock } = useStore();
  const [tab, setTab] = useState<Tab>("import");
  const [result, setResult] = useState<StockImportResult | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [defaultShelf, setDefaultShelf] = useState<Shelf>("retail");
  const [draft, setDraft] = useState<StockDraft>({
    name: "",
    brand: "",
    shelf: "retail",
    cost: 0,
    price: 0,
    reorder: 0,
    barcode: "",
  });
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const allStock = useMemo(() => [...products.retail, ...products.backbar], []);
  /** Nothing sold in the window the history covers. */
  const inactive = useMemo(() => inactiveItems(allStock), [allStock]);
  const archivedItems = useMemo(
    () => allStock.filter((p) => archivedStock.includes(p.id)),
    [allStock, archivedStock]
  );

  const field = "rounded border border-hairline bg-paper px-2.5 py-1.5 text-sm text-ink";
  const legend = "mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-mutedink";

  async function handleFile(file: File) {
    const text = await file.text();
    setFilename(file.name);
    setResult(parseStockImport(text, defaultShelf));
    setMessage(null);
  }

  function commitImport() {
    if (!result || result.rows.length === 0) return;
    addStock(result.rows);
    setMessage(`${result.rows.length} lines added.`);
    setResult(null);
    setFilename(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function addOne(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) return setError("Give the item a name.");
    if (draft.shelf === "retail" && draft.price <= 0) {
      return setError("A retail item needs a selling price.");
    }
    addStock([{ ...draft, name: draft.name.trim(), brand: draft.brand.trim() || "Unknown" }]);
    setMessage(`${draft.name.trim()} added.`);
    setDraft({ name: "", brand: "", shelf: "retail", cost: 0, price: 0, reorder: 0, barcode: "" });
    setError(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1">
        {(
          [
            ["import", "Import a spreadsheet"],
            ["add", "Add one item"],
            ["archive", `Archive inactive (${inactive.length})`],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
            className={`rounded-full px-3.5 py-1.5 text-xs transition-colors ${
              tab === key
                ? "bg-taupe font-semibold text-white"
                : "bg-chip text-taupe-deep hover:bg-hairline"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------ import */}
      {tab === "import" && (
        <>
          <Card>
            <CardTitle
              right={
                <button
                  type="button"
                  onClick={() => downloadCsv("hairline-stock-import-template.csv", TEMPLATE)}
                  className="text-xs text-taupe-deep underline underline-offset-2"
                >
                  Download a template
                </button>
              }
            >
              Import retail or back-bar lines
            </CardTitle>
            <div className="px-4 py-4">
              <p className="mb-3 text-xs text-mutedink">
                Save the supplier price list as CSV. An <strong>Item</strong> column is required;
                Brand, Type, Cost, Price, Reorder and Barcode are used when present. Every row is
                checked before anything is added.
              </p>

              <label className="mb-3 flex items-center gap-2 text-sm text-body">
                Rows with no Type column are
                <select
                  value={defaultShelf}
                  onChange={(e) => setDefaultShelf(e.target.value as Shelf)}
                  aria-label="Default shelf"
                  className={field}
                >
                  <option value="retail">retail</option>
                  <option value="backbar">back bar</option>
                </select>
              </label>

              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                }}
                aria-label="Stock spreadsheet"
                className="block w-full text-sm text-body file:mr-3 file:rounded file:border-0 file:bg-taupe-deep file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-ink"
              />
            </div>
          </Card>

          {result && (
            <Card>
              <CardTitle
                right={
                  <span className="flex items-center gap-2">
                    <Badge tone={result.rows.length > 0 ? "good" : "crit"}>
                      {result.rows.length} ready
                    </Badge>
                    {result.errors.length > 0 && (
                      <Badge tone="warn">{result.errors.length} skipped</Badge>
                    )}
                  </span>
                }
              >
                Checked “{filename}”
              </CardTitle>

              {result.errors.length > 0 && (
                <div className="border-b border-hairline-soft bg-warn-soft px-4 py-3">
                  <p className="mb-1 text-xs font-semibold text-warn">
                    These rows were left out. Nothing has been added yet.
                  </p>
                  <ul className="flex flex-col gap-0.5">
                    {result.errors.slice(0, 8).map((e) => (
                      <li key={e} className="text-xs text-warn">
                        {e}
                      </li>
                    ))}
                    {result.errors.length > 8 && (
                      <li className="text-xs text-warn">…and {result.errors.length - 8} more.</li>
                    )}
                  </ul>
                </div>
              )}

              {result.rows.length > 0 && (
                <>
                  <TableScroll>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-[0.08em] text-mutedink">
                          <th className="px-4 py-2 font-semibold">Item</th>
                          <th className="px-4 py-2 font-semibold">Brand</th>
                          <th className="px-4 py-2 font-semibold">Shelf</th>
                          <th className="px-4 py-2 text-right font-semibold">Cost</th>
                          <th className="px-4 py-2 text-right font-semibold">Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.rows.slice(0, 12).map((r) => (
                          <tr key={r.name} className="border-b border-hairline-soft last:border-0">
                            <td className="px-4 py-2 text-ink">{r.name}</td>
                            <td className="px-4 py-2 text-mutedink">{r.brand}</td>
                            <td className="px-4 py-2 text-mutedink">
                              {r.shelf === "retail" ? "Retail" : "Back bar"}
                            </td>
                            <td className="tnum px-4 py-2 text-right text-mutedink">
                              {zar(r.cost)}
                            </td>
                            <td className="tnum px-4 py-2 text-right text-ink">
                              {r.price > 0 ? zar(r.price) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableScroll>
                  {result.rows.length > 12 && (
                    <p className="px-4 py-2 text-xs text-mutedink">
                      Showing the first 12 of {result.rows.length}.
                    </p>
                  )}
                  <div className="flex justify-end gap-2 border-t border-hairline-soft px-4 py-3">
                    <button
                      type="button"
                      onClick={() => {
                        setResult(null);
                        setFilename(null);
                        if (fileRef.current) fileRef.current.value = "";
                      }}
                      className="rounded px-3 py-2 text-sm text-mutedink hover:text-ink"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={commitImport}
                      className="rounded bg-taupe-deep px-4 py-2 text-sm font-semibold text-white hover:bg-ink"
                    >
                      Add {result.rows.length} lines
                    </button>
                  </div>
                </>
              )}
            </Card>
          )}
        </>
      )}

      {/* --------------------------------------------------------------- add */}
      {tab === "add" && (
        <Card>
          <CardTitle>Add a stock line</CardTitle>
          <form onSubmit={addOne} className="flex flex-wrap items-end gap-3 px-4 py-4">
            <label className="block">
              <span className={legend}>Item</span>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                aria-label="Item name"
                className={`${field} min-w-56`}
              />
            </label>
            <label className="block">
              <span className={legend}>Brand</span>
              <input
                type="text"
                value={draft.brand}
                onChange={(e) => setDraft({ ...draft, brand: e.target.value })}
                aria-label="Brand"
                className={field}
              />
            </label>
            <label className="block">
              <span className={legend}>Shelf</span>
              <select
                value={draft.shelf}
                onChange={(e) => setDraft({ ...draft, shelf: e.target.value as Shelf })}
                aria-label="Shelf"
                className={field}
              >
                <option value="retail">Retail</option>
                <option value="backbar">Back bar</option>
              </select>
            </label>
            {(["cost", "price", "reorder"] as const).map((k) => (
              <label key={k} className="block">
                <span className={legend}>{k}</span>
                <input
                  type="number"
                  min={0}
                  step={k === "reorder" ? 1 : 0.01}
                  value={draft[k]}
                  onChange={(e) => setDraft({ ...draft, [k]: Number(e.target.value) || 0 })}
                  aria-label={k}
                  className={`${field} w-24`}
                />
              </label>
            ))}
            <label className="block">
              <span className={legend}>Barcode</span>
              <input
                type="text"
                value={draft.barcode}
                onChange={(e) => setDraft({ ...draft, barcode: e.target.value })}
                aria-label="Barcode"
                className={field}
              />
            </label>
            <button
              type="submit"
              className="rounded bg-taupe-deep px-4 py-2 text-sm font-semibold text-white hover:bg-ink"
            >
              Add item
            </button>
            {error && <p className="w-full text-xs text-crit">{error}</p>}
          </form>
        </Card>
      )}

      {/* ----------------------------------------------------------- archive */}
      {tab === "archive" && (
        <>
          <Card>
            <CardTitle
              right={
                inactive.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setArchivedStock(archiveMany(archivedStock, inactive.map((i) => i.id)));
                      setMessage(`${inactive.length} inactive lines archived.`);
                    }}
                    className="rounded bg-taupe-deep px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink"
                  >
                    Archive all {inactive.length}
                  </button>
                )
              }
            >
              Not sold in the last three years
            </CardTitle>
            <p className="border-b border-hairline-soft px-4 py-2.5 text-xs text-mutedink">
              Archiving takes an item out of the till and stock pickers. It never removes past
              sales, so old invoices and reports stay intact.
            </p>
            <TableScroll>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-[0.08em] text-mutedink">
                    <th className="px-4 py-2 font-semibold">Item</th>
                    <th className="px-4 py-2 font-semibold">Brand</th>
                    <th className="px-4 py-2 text-right font-semibold">On hand</th>
                    <th className="px-4 py-2 text-right font-semibold">Value at cost</th>
                    <th className="px-4 py-2 text-right font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {inactive.filter((i) => !archivedStock.includes(i.id)).slice(0, 40).map((i) => (
                    <tr key={i.id} className="border-b border-hairline-soft last:border-0">
                      <td className="px-4 py-2 text-ink">{i.name}</td>
                      <td className="px-4 py-2 text-mutedink">{i.brand}</td>
                      <td className="tnum px-4 py-2 text-right text-mutedink">{i.qty}</td>
                      <td className="tnum px-4 py-2 text-right text-mutedink">
                        {zar(Math.max(0, i.qty) * i.cost)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setArchivedStock(archive(archivedStock, i.id));
                            setMessage(`${i.name} archived.`);
                          }}
                          className="text-xs font-semibold text-taupe-deep underline underline-offset-2"
                        >
                          Archive
                        </button>
                      </td>
                    </tr>
                  ))}
                  {inactive.filter((i) => !archivedStock.includes(i.id)).length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-mutedink">
                        Nothing left to archive.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </TableScroll>
          </Card>

          {archivedItems.length > 0 && (
            <Card>
              <CardTitle right={<span className="text-xs text-mutedink">{archivedItems.length}</span>}>
                Archived
              </CardTitle>
              <ul className="divide-y divide-hairline-soft">
                {archivedItems.slice(0, 30).map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-ink">{i.name}</span>
                      <span className="block text-xs text-mutedink">{i.brand}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setArchivedStock(unarchive(archivedStock, i.id));
                        setMessage(`${i.name} restored.`);
                      }}
                      className="shrink-0 text-xs font-semibold text-taupe-deep underline underline-offset-2"
                    >
                      Unarchive
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      {newStock.length > 0 && (
        <Card>
          <CardTitle
            right={
              <button
                type="button"
                onClick={clearNewStock}
                className="text-xs text-mutedink underline underline-offset-2 hover:text-crit"
              >
                Remove them
              </button>
            }
          >
            Lines added in this demo ({newStock.length})
          </CardTitle>
          <TableScroll>
            <table className="w-full text-sm">
              <tbody>
                {newStock.slice(-10).reverse().map((s, i) => (
                  <tr key={`${s.name}-${i}`} className="border-b border-hairline-soft last:border-0">
                    <td className="px-4 py-2 text-ink">{s.name}</td>
                    <td className="px-4 py-2 text-mutedink">{s.brand}</td>
                    <td className="px-4 py-2 text-mutedink">
                      {s.shelf === "retail" ? "Retail" : "Back bar"}
                    </td>
                    <td className="tnum px-4 py-2 text-right text-ink">
                      {s.price > 0 ? zar(s.price) : zar(s.cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </Card>
      )}

      {message && (
        <p role="status" className="rounded bg-good-soft px-3 py-2 text-xs text-good">
          {message}
        </p>
      )}
    </div>
  );
}
