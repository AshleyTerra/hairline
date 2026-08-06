"use client";

import { useRef, useState } from "react";
import { Card, CardTitle } from "@/components/ui";
import { describeBackup, type BackupCheck } from "@/lib/admin";
import { meta } from "@/lib/data";

/** Steps the real migration runs once the file reaches the server. */
const MIGRATION_STEPS = [
  ["Restore", "The backup is restored to a private copy of SQL Server, never over live data."],
  ["Read", "Clients, invoices, invoice lines, stock, staff, tips and cash-ups are read out."],
  ["Check", "Totals are compared against the old system, year by year, to the cent."],
  ["Load", "The data is written into Salon Manager and every figure re-checked."],
  ["Report", "You get a summary of what came across and anything that needs a decision."],
];

export function RestorePanel() {
  const [check, setCheck] = useState<BackupCheck | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setBusy(true);
    // Only the first few KB are needed to identify the format.
    const head = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
    setCheck(describeBackup(head, file.name, file.size));
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardTitle>Restore from a MySalon backup</CardTitle>
        <div className="px-4 py-4">
          <p className="mb-3 text-xs text-mutedink">
            Choose the <code className="rounded bg-chip px-1 py-0.5 font-mono">.bak</code> file
            that MySalon produces. The file is checked here in your browser — it is not uploaded
            anywhere.
          </p>

          <input
            ref={inputRef}
            type="file"
            accept=".bak"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
            className="block w-full text-sm text-body file:mr-3 file:rounded file:border-0 file:bg-taupe-deep file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-ink"
          />

          {busy && <p className="mt-3 text-xs text-mutedink">Reading the file…</p>}

          {check && (
            <div
              className={`mt-4 rounded border px-4 py-3 ${
                check.valid
                  ? "border-good bg-good-soft text-good"
                  : "border-crit bg-crit-soft text-crit"
              }`}
            >
              <p className="text-sm font-semibold">{check.summary}</p>
              {check.detail.length > 0 && (
                <ul className="mt-1.5 flex flex-col gap-0.5">
                  {check.detail.map((d) => (
                    <li key={d} className="text-xs">
                      {d}
                    </li>
                  ))}
                </ul>
              )}
              {check.valid && (
                <p className="mt-2 text-xs">
                  The file is valid and ready to hand to the migration. In the live system, pressing
                  Restore below sends it to the server; in this prototype there is no server, so the
                  steps are shown rather than run.
                </p>
              )}
            </div>
          )}

          {check?.valid && (
            <button
              type="button"
              disabled
              title="The prototype has no server to restore into."
              className="mt-3 w-full cursor-not-allowed rounded bg-hairline px-4 py-2.5 text-sm font-semibold text-mutedink"
            >
              Restore this backup — not available in the prototype
            </button>
          )}
        </div>
      </Card>

      <Card>
        <CardTitle right={<span className="text-xs text-mutedink">Five steps</span>}>
          What a restore actually does
        </CardTitle>
        <ol className="divide-y divide-hairline-soft">
          {MIGRATION_STEPS.map(([title, text], i) => (
            <li key={title} className="flex gap-3 px-4 py-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-chip text-xs font-semibold text-taupe-deep">
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">{title}</span>
                <span className="block text-xs text-mutedink">{text}</span>
              </span>
            </li>
          ))}
        </ol>
      </Card>

      <Card>
        <CardTitle>Where this demo&apos;s data came from</CardTitle>
        <dl className="divide-y divide-hairline-soft text-sm">
          {[
            ["Source", meta.generatedFrom],
            ["Data up to", meta.dataAsOf],
            ["Clients loaded", `${meta.clientsInDemo} of ${meta.activeClientsAllTime.toLocaleString("en-ZA")}`],
            ["Invoices in the salon's history", meta.totalInvoicesAllTime.toLocaleString("en-ZA")],
            ["Services priced", String(meta.servicesInDemo)],
            ["Stock lines", meta.productsInDemo.toLocaleString("en-ZA")],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 px-4 py-2.5">
              <dt className="text-mutedink">{label}</dt>
              <dd className="text-right text-ink">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="border-t border-hairline-soft px-4 py-2.5 text-xs text-mutedink">
          {meta.privacy}
        </p>
      </Card>
    </div>
  );
}
