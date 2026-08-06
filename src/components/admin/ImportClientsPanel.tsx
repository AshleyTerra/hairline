"use client";

import { useRef, useState } from "react";
import { Badge, Card, CardTitle, TableScroll } from "@/components/ui";
import { parseClientImport, type ClientImportResult } from "@/lib/admin";
import { downloadCsv, toCsv } from "@/lib/csv";
import { useStore } from "@/lib/store";

const TEMPLATE = toCsv(
  [
    {
      Name: "Thandi Nkosi",
      Phone: "082 123 4567",
      Email: "thandi@example.co.za",
      Birthday: "1988-03-14",
      Notes: "Prefers early appointments",
    },
    {
      Name: "Pieter van Wyk",
      Phone: "073 555 0199",
      Email: "",
      Birthday: "",
      Notes: "Referred by Karin",
    },
  ],
  [
    { key: "Name", label: "Name" },
    { key: "Phone", label: "Phone" },
    { key: "Email", label: "Email" },
    { key: "Birthday", label: "Birthday" },
    { key: "Notes", label: "Notes" },
  ]
);

export function ImportClientsPanel() {
  const { importedClients, addImportedClients, clearImportedClients } = useStore();
  const [result, setResult] = useState<ClientImportResult | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [applied, setApplied] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    const text = await file.text();
    setFilename(file.name);
    setResult(parseClientImport(text));
    setApplied(null);
  }

  function apply() {
    if (!result || result.rows.length === 0) return;
    addImportedClients(result.rows);
    setApplied(`${result.rows.length} clients added to the demo.`);
    setResult(null);
    setFilename(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardTitle
          right={
            <button
              type="button"
              onClick={() => downloadCsv("hairline-client-import-template.csv", TEMPLATE)}
              className="text-xs text-taupe-deep underline underline-offset-2"
            >
              Download a template
            </button>
          }
        >
          Load new clients from a spreadsheet
        </CardTitle>

        <div className="px-4 py-4">
          <p className="mb-3 text-xs text-mutedink">
            Save your spreadsheet as CSV and choose it below. A <strong>Name</strong> column is
            required; Phone, Email, Birthday and Notes are used if they are there. Common column
            spellings are recognised, so <em>Cell</em>, <em>Mobile</em> and <em>Contact</em> all
            work as the phone column.
          </p>

          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
            className="block w-full text-sm text-body file:mr-3 file:rounded file:border-0 file:bg-taupe-deep file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-ink"
          />

          {applied && (
            <p role="status" className="mt-3 rounded bg-good-soft px-3 py-2 text-xs text-good">
              {applied}
            </p>
          )}
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
                These rows were left out. Nothing has been changed yet.
              </p>
              <ul className="flex flex-col gap-0.5">
                {result.errors.slice(0, 8).map((e) => (
                  <li key={e} className="text-xs text-warn">
                    {e}
                  </li>
                ))}
                {result.errors.length > 8 && (
                  <li className="text-xs text-warn">
                    …and {result.errors.length - 8} more.
                  </li>
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
                      <th className="px-4 py-2 font-semibold">Name</th>
                      <th className="px-4 py-2 font-semibold">Phone</th>
                      <th className="px-4 py-2 font-semibold">Email</th>
                      <th className="px-4 py-2 font-semibold">Birthday</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.slice(0, 10).map((r, i) => (
                      <tr key={`${r.name}-${i}`} className="border-b border-hairline-soft last:border-0">
                        <td className="px-4 py-2 text-ink">{r.name}</td>
                        <td className="px-4 py-2 text-mutedink">{r.tel || "—"}</td>
                        <td className="px-4 py-2 text-mutedink">{r.email || "—"}</td>
                        <td className="px-4 py-2 text-mutedink">{r.birthday || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
              {result.rows.length > 10 && (
                <p className="px-4 py-2 text-xs text-mutedink">
                  Showing the first 10 of {result.rows.length}.
                </p>
              )}
              <div className="flex justify-end gap-2 border-t border-hairline-soft px-4 py-3">
                <button
                  type="button"
                  onClick={() => {
                    setResult(null);
                    setFilename(null);
                    if (inputRef.current) inputRef.current.value = "";
                  }}
                  className="rounded px-3 py-2 text-sm text-mutedink hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={apply}
                  className="rounded bg-taupe-deep px-4 py-2 text-sm font-semibold text-white hover:bg-ink"
                >
                  Add {result.rows.length} clients
                </button>
              </div>
            </>
          )}
        </Card>
      )}

      {importedClients.length > 0 && (
        <Card>
          <CardTitle
            right={
              <button
                type="button"
                onClick={clearImportedClients}
                className="text-xs text-mutedink underline underline-offset-2 hover:text-crit"
              >
                Remove them
              </button>
            }
          >
            Clients added in this demo ({importedClients.length})
          </CardTitle>
          <TableScroll>
            <table className="w-full text-sm">
              <tbody>
                {importedClients.slice(-10).reverse().map((c, i) => (
                  <tr key={`${c.name}-${i}`} className="border-b border-hairline-soft last:border-0">
                    <td className="px-4 py-2 text-ink">{c.name}</td>
                    <td className="px-4 py-2 text-mutedink">{c.tel || "—"}</td>
                    <td className="px-4 py-2 text-mutedink">{c.email || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
          <p className="px-4 py-2.5 text-xs text-mutedink">
            These live in this browser only, so the demo data stays clean for the next person.
          </p>
        </Card>
      )}
    </div>
  );
}
