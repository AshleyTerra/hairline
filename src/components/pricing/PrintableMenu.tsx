"use client";

import { serviceDepts, services, meta } from "@/lib/data";
import { zar } from "@/lib/format";
import { Wordmark } from "@/components/Wordmark";

/**
 * The client-facing price menu, generated from the same prices the till charges.
 * Hairline currently rebuilds this as a Word document every year; here it can
 * never drift from what clients are actually charged.
 */
export function PrintableMenu() {
  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3 rounded border border-hairline bg-chip px-4 py-3">
        <p className="text-xs text-taupe-deep">
          Generated live from {services.length} priced services. Print it, or save as a PDF.
        </p>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded bg-taupe-deep px-4 py-2 text-xs font-semibold text-white hover:bg-ink"
        >
          Print this menu
        </button>
      </div>

      <div className="rounded border border-hairline bg-card px-6 py-8 print:border-0 print:px-0 print:py-0">
        <header className="mb-6 border-b border-hairline pb-4 text-center">
          <div className="mb-1 text-3xl">
            <Wordmark />
          </div>
          <p className="text-sm text-mutedink">Price menu</p>
          <p className="mt-1 text-[11px] text-mutedink">
            {meta.company} · Shop 30, Stoneridge Centre, Greenstone Park · 011 452 1852
          </p>
        </header>

        <div className="columns-1 gap-8 sm:columns-2">
          {serviceDepts.map((dept) => {
            const list = services.filter((s) => s.dept === dept);
            if (list.length === 0) return null;
            return (
              <section key={dept} className="mb-6 break-inside-avoid">
                <h3 className="mb-2 border-b border-taupe pb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-taupe-deep">
                  {dept}
                </h3>
                <ul>
                  {list.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-baseline justify-between gap-3 border-b border-hairline-soft py-1 last:border-0"
                    >
                      <span className="text-[12.5px] text-ink">{s.name}</span>
                      <span className="tnum shrink-0 text-[12.5px] font-semibold text-ink">
                        {zar(s.price)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <footer className="mt-4 border-t border-hairline pt-3 text-center text-[10.5px] text-mutedink">
          All prices include VAT at 15% and are subject to change. Prices for longer or thicker
          hair are quoted on consultation.
        </footer>
      </div>
    </>
  );
}
