"use client";

import { useMemo } from "react";
import { PrintArea } from "@/components/PrintArea";
import { Card } from "@/components/ui";
import { meta, serviceDepts, services } from "@/lib/data";
import { longDate, zar } from "@/lib/format";

/**
 * The service list at cost price — what the salon spends to perform each
 * service, rather than what it charges for it.
 *
 * Deliberately a separate sheet from the client menu. The client menu carries
 * selling prices and goes on the counter; this one carries costs and does not,
 * so the two can never be picked up in mistake for one another.
 */
export function ServiceCostSheet() {
  const groups = useMemo(
    () =>
      serviceDepts
        .map((dept) => ({
          dept,
          items: services
            .filter((s) => s.dept === dept)
            .sort((a, b) => a.name.localeCompare(b.name)),
        }))
        .filter((g) => g.items.length > 0),
    []
  );

  const withCost = services.filter((s) => s.cost > 0).length;

  return (
    <>
      <div className="no-print mb-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded bg-taupe-deep px-4 py-2 text-sm font-semibold text-white hover:bg-ink"
        >
          Print / save as PDF
        </button>
        <p className="text-xs text-mutedink">
          {withCost} of {services.length} services have a cost on file. The rest print as “—”
          rather than as zero, so a gap reads as a gap.
        </p>
      </div>

      <PrintArea>
        <Card className="print:border-0">
          <header className="border-b border-hairline px-5 py-4">
            <h2 className="text-base font-semibold text-ink">Service cost list</h2>
            <p className="text-xs text-mutedink">
              Hairline · what each service costs the salon · {longDate(meta.demoDate)}
            </p>
            <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-crit">
              Internal — cost prices, not for the counter
            </p>
          </header>

          {/* No break-inside-avoid on a department: Treatments alone runs to 84
              lines, and holding one whole leaves half a column blank. Only the
              heading is held to its rows, in the print stylesheet. */}
          <div className="cost-columns px-5 py-4">
            {groups.map((g) => (
              <section key={g.dept} className="mb-4">
                <h3 className="mb-1 border-b border-hairline-soft pb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-taupe-deep">
                  {g.dept}
                </h3>
                <ul>
                  {g.items.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-baseline justify-between gap-3 py-[3px] text-[12.5px]"
                    >
                      <span className="min-w-0 text-body">{s.name}</span>
                      <span
                        className={`tnum shrink-0 ${s.cost > 0 ? "font-semibold text-ink" : "text-faintink"}`}
                      >
                        {s.cost > 0 ? zar(s.cost) : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </Card>
      </PrintArea>
    </>
  );
}
