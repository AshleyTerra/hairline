"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Badge, Card, PageHeader, TableScroll } from "@/components/ui";
import { analytics, clients, getStaff, meta } from "@/lib/data";
import { birthdayOf, clientBook } from "@/lib/clientBook";
import { relativeToDemo, zar0 } from "@/lib/format";
import { useStore } from "@/lib/store";

type Filter = "all" | "lapsed" | "vip" | "birthday";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All clients" },
  { value: "lapsed", label: "Lapsed 90+ days" },
  { value: "vip", label: "Top spenders" },
  { value: "birthday", label: "Birthdays this month" },
];

function ClientsList() {
  const params = useSearchParams();
  const [filter, setFilter] = useState<Filter>(
    (params.get("filter") as Filter | null) ?? "all"
  );
  const [query, setQuery] = useState("");

  const demoMonth = Number(meta.demoDate.slice(5, 7));

  /* One directory: the migrated file plus anyone captured at the counter. */
  const { newClients } = useStore();
  const book = useMemo(() => clientBook(clients, newClients), [newClients]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");

    return book
      .filter((c) => {
        if (filter === "lapsed" && !c.lapsed) return false;
        if (filter === "vip" && !c.vip) return false;
        // Birthdays are day-and-month for new captures and a full date for the
        // migrated file, so read the month rather than slicing a fixed offset.
        if (filter === "birthday" && birthdayOf(c.birthday)?.month !== demoMonth) return false;
        if (!q) return true;
        if (c.name.toLowerCase().includes(q)) return true;
        return digits.length >= 3 && c.tel.replace(/\D/g, "").includes(digits);
      })
      .sort((a, b) => {
        // A client captured today has no visit yet, but reception has just typed
        // them in — so they belong at the top, not the bottom.
        if (!a.lastVisit && !b.lastVisit) return a.id - b.id;
        if (!a.lastVisit) return -1;
        if (!b.lastVisit) return 1;
        return b.lastVisit.localeCompare(a.lastVisit);
      })
      .slice(0, 200);
  }, [book, filter, query, demoMonth]);

  return (
    <>
      <PageHeader
        eyebrow="Client relationships"
        title="Clients"
        subtitle={`${book.length} of Hairline's ${analytics.clientHealth.activeClients.toLocaleString("en-ZA")} active clients, with full visit history. Names are anonymised.`}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or phone…"
          className="w-full rounded border border-hairline bg-card px-3 py-2 text-sm text-ink placeholder:text-mutedink sm:w-72"
        />
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              aria-pressed={filter === f.value}
              className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                filter === f.value
                  ? "bg-taupe text-white font-semibold"
                  : "bg-chip text-taupe-deep hover:bg-hairline"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filter === "lapsed" && (
        <p className="mb-3 rounded border border-warn bg-warn-soft px-3 py-2 text-xs text-warn">
          Across the whole client base, {analytics.retention.lapsed.toLocaleString("en-ZA")} clients
          last visited between 3 and 12 months ago. A win-back message to this list is the single
          cheapest revenue in the salon.
        </p>
      )}

      <Card>
        <TableScroll>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-[0.08em] text-mutedink">
                <th className="px-4 py-2.5 font-semibold">Client</th>
                <th className="px-4 py-2.5 font-semibold">Usual stylist</th>
                <th className="px-4 py-2.5 font-semibold">Last visit</th>
                <th className="px-4 py-2.5 text-right font-semibold">Visits</th>
                <th className="px-4 py-2.5 text-right font-semibold">Lifetime</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-hairline-soft last:border-0 hover:bg-paper"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/clients/${c.id}`}
                      className="font-medium text-ink underline-offset-2 hover:underline"
                    >
                      {c.name}
                    </Link>
                    <span className="ml-2 inline-flex gap-1 align-middle">
                      {c.vip && <Badge tone="accent">VIP</Badge>}
                      {c.medical && <Badge tone="crit">Medical</Badge>}
                      {c.lapsed && <Badge tone="warn">Lapsed</Badge>}
                    </span>
                    <span className="block text-xs text-mutedink">{c.tel}</span>
                  </td>
                  <td className="px-4 py-2.5 text-mutedink">
                    {getStaff(c.prefStylistId)?.name ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-mutedink">
                    {relativeToDemo(c.lastVisit, meta.demoDate)}
                  </td>
                  <td className="tnum px-4 py-2.5 text-right text-body">{c.visitCount}</td>
                  <td className="tnum px-4 py-2.5 text-right font-semibold text-ink">
                    {zar0(c.lifetimeSpend)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>

        {rows.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-mutedink">
            No clients match that search.
          </p>
        )}
      </Card>

      <p className="mt-3 text-xs text-mutedink">
        Showing {rows.length} client{rows.length === 1 ? "" : "s"}
        {rows.length === 200 ? " (first 200 — refine the search to narrow it)" : ""}.
      </p>
    </>
  );
}

export default function ClientsPage() {
  return (
    <Suspense fallback={<PageHeader title="Clients" subtitle="Loading…" />}>
      <ClientsList />
    </Suspense>
  );
}
