"use client";

import { useMemo, useState } from "react";
import { Card, CardTitle } from "@/components/ui";
import { Wordmark } from "@/components/Wordmark";
import { PrintArea } from "@/components/PrintArea";
import { meta, serviceDepts, services } from "@/lib/data";
import { zar0 } from "@/lib/format";

/**
 * The client price menu: choose which services appear, then print a tri-fold
 * brochure. It follows the 2026 menu the salon hands out — landscape, three
 * columns a side, prices right-aligned, contact panel on the back.
 */
export function MenuBuilder() {
  const [chosen, setChosen] = useState<Set<number>>(() => new Set(services.map((s) => s.id)));
  const [showPicker, setShowPicker] = useState(true);

  const byDept = useMemo(
    () =>
      serviceDepts
        .map((dept) => ({
          dept,
          items: services.filter((s) => s.dept === dept),
        }))
        .filter((g) => g.items.length > 0),
    []
  );

  const included = useMemo(
    () => byDept.map((g) => ({ ...g, items: g.items.filter((s) => chosen.has(s.id)) })).filter((g) => g.items.length > 0),
    [byDept, chosen]
  );

  const total = chosen.size;

  function toggle(id: number) {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleDept(dept: string, on: boolean) {
    setChosen((prev) => {
      const next = new Set(prev);
      for (const s of services.filter((x) => x.dept === dept)) {
        if (on) next.add(s.id);
        else next.delete(s.id);
      }
      return next;
    });
  }

  /** Splits the chosen services across three roughly equal columns. */
  const columns = useMemo(() => {
    const flat: { dept: string; items: typeof services }[] = included;
    const weight = (g: (typeof flat)[number]) => g.items.length + 2; // heading costs space
    const totalWeight = flat.reduce((n, g) => n + weight(g), 0);
    const target = totalWeight / 3;
    const cols: (typeof flat)[] = [[], [], []];
    let col = 0;
    let used = 0;
    for (const group of flat) {
      if (used >= target && col < 2) {
        col += 1;
        used = 0;
      }
      cols[col].push(group);
      used += weight(group);
    }
    return cols;
  }, [included]);

  return (
    <div className="flex flex-col gap-4">
      {/* ------------------------------------------------ chooser (not printed) */}
      <Card className="no-print">
        <CardTitle
          right={
            <span className="flex items-center gap-3">
              <span className="text-xs text-mutedink">
                {total} of {services.length} services
              </span>
              <button
                type="button"
                onClick={() => setChosen(new Set(services.map((s) => s.id)))}
                className="text-xs text-taupe-deep underline underline-offset-2"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => setChosen(new Set())}
                className="text-xs text-mutedink underline underline-offset-2"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setShowPicker((s) => !s)}
                className="text-xs font-semibold text-taupe-deep"
              >
                {showPicker ? "Hide list" : "Choose services"}
              </button>
            </span>
          }
        >
          Which services go on the menu
        </CardTitle>

        {showPicker && (
          <div className="grid gap-4 px-4 py-4 sm:grid-cols-2 lg:grid-cols-3">
            {byDept.map((group) => {
              const on = group.items.filter((s) => chosen.has(s.id)).length;
              return (
                <div key={group.dept}>
                  <label className="mb-1 flex items-center gap-2 border-b border-hairline pb-1">
                    <input
                      type="checkbox"
                      checked={on === group.items.length}
                      ref={(el) => {
                        if (el) el.indeterminate = on > 0 && on < group.items.length;
                      }}
                      onChange={(e) => toggleDept(group.dept, e.target.checked)}
                      aria-label={`All ${group.dept}`}
                      className="h-3.5 w-3.5 accent-[#6e6455]"
                    />
                    <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-taupe-deep">
                      {group.dept}
                    </span>
                    <span className="ml-auto text-[11px] text-mutedink">
                      {on}/{group.items.length}
                    </span>
                  </label>
                  <ul>
                    {group.items.map((s) => (
                      <li key={s.id}>
                        <label className="flex items-center gap-2 py-0.5 text-[12.5px] text-body">
                          <input
                            type="checkbox"
                            checked={chosen.has(s.id)}
                            onChange={() => toggle(s.id)}
                            aria-label={s.name}
                            className="h-3.5 w-3.5 shrink-0 accent-[#6e6455]"
                          />
                          <span className="min-w-0 flex-1 truncate">{s.name}</span>
                          <span className="tnum shrink-0 text-mutedink">{zar0(s.price)}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-hairline-soft px-4 py-3">
          <button
            type="button"
            onClick={() => window.print()}
            disabled={total === 0}
            className="rounded bg-taupe-deep px-4 py-2 text-sm font-semibold text-white hover:bg-ink disabled:opacity-40"
          >
            Print the menu
          </button>
          <p className="text-xs text-mutedink">
            Prints landscape on A4, three columns to a side — fold in three, as the current menu
            does. Choose “Save as PDF” in the print dialogue to send it to the printer shop.
          </p>
        </div>
      </Card>

      {/* ------------------------------------------------------------ the menu */}
      <Card className="print:border-0">
        <div className="no-print">
          <CardTitle>Preview</CardTitle>
        </div>

        <PrintArea landscape className="menu-sheet px-6 py-6 print:px-0 print:py-0">
          {total === 0 ? (
            <p className="py-10 text-center text-sm text-mutedink">
              Nothing chosen yet — tick a few services above.
            </p>
          ) : (
            <div className="menu-columns grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {columns.map((col, i) => (
                <div key={i} className="flex flex-col gap-4">
                  {col.map((group) => (
                    <section key={group.dept}>
                      <h3 className="mb-1 border-b border-ink pb-0.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink">
                        {group.dept}
                      </h3>
                      <ul>
                        {group.items.map((s) => (
                          <li
                            key={s.id}
                            className="flex items-baseline justify-between gap-2 py-[1px]"
                          >
                            <span className="text-[10.5px] uppercase leading-tight text-ink">
                              {s.name}
                            </span>
                            <span className="tnum shrink-0 text-[10.5px] font-semibold text-ink">
                              {zar0(s.price)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              ))}

              {/*
                The note and the contact block live inside the flow, so on paper
                they fill the last panel of the fold instead of being pushed onto
                a sheet of their own.
              */}
              <p className="menu-note mt-5 text-center text-[9px] font-bold uppercase italic text-ink sm:col-span-2 lg:col-span-3">
                All prices include VAT &amp; are subject to change without prior notice. T&apos;s
                &amp; C&apos;s apply.
              </p>

              {/* Back panel: the contact block from the printed menu */}
              <div className="menu-back mt-6 border-t border-hairline pt-6 sm:col-span-2 lg:col-span-3 print:border-0">
                <div className="grid items-center gap-6 sm:grid-cols-3">
                  <div className="text-center sm:text-left">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink">
                      Follow us
                    </p>
                    <p className="mt-1 text-[12px] text-body">Facebook · @hairline_stoneridge</p>
                    <p className="text-[12px] text-body">Instagram · hairline_stoneridge</p>
                  </div>

                  <div className="text-center">
                    <div className="text-3xl">
                      <Wordmark />
                    </div>
                    <p className="mt-1 text-[10.5px] text-mutedink">
                      Shop 30, Stoneridge Centre
                      <br />
                      Cnr Modderfontein &amp; Harreford Str
                      <br />
                      Greenstone Park
                    </p>
                  </div>

                  <div className="text-center sm:text-right">
                    <p className="tnum text-[15px] font-bold text-ink">011 452 1852</p>
                    <p className="tnum text-[15px] font-bold text-ink">076 972 9590</p>
                    <p className="mt-1 text-[10.5px] text-mutedink">
                      Menu generated {meta.demoDate.split("-").reverse().join("/")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </PrintArea>
      </Card>
    </div>
  );
}
