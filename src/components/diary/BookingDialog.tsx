"use client";

import { useMemo, useState } from "react";
import { clients, services } from "@/lib/data";
import { SLOT_MINUTES, durationFor, endTime, slots, type BookingDraft } from "@/lib/diary";
import type { RosterMember } from "@/lib/roster";

/**
 * Books an appointment. Reception works from the client's name and the service —
 * the chair time follows from the service, and can be stretched for a client who
 * always takes longer.
 */
export function BookingDialog({
  date,
  dateLabel,
  start,
  stylistId,
  team,
  error,
  onSave,
  onClose,
}: {
  date: string;
  dateLabel: string;
  /** The slot that was clicked. */
  start: string;
  stylistId: number;
  team: readonly RosterMember[];
  error?: string | null;
  onSave: (draft: BookingDraft) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [client, setClient] = useState<{ id: number | null; name: string } | null>(null);
  const [serviceId, setServiceId] = useState<number>(() => services[0]?.id ?? 0);
  const [who, setWho] = useState<number>(stylistId);
  const [at, setAt] = useState(start);
  const service = services.find((s) => s.id === serviceId);
  const [mins, setMins] = useState<number>(() => durationFor(services[0]));

  /** Ten matches is plenty to pick from without turning into a list to read. */
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return clients
      .filter((c) => c.name.toLowerCase().includes(q) || (c.tel ?? "").includes(q))
      .slice(0, 10);
  }, [query]);

  const field =
    "w-full rounded border border-hairline bg-paper px-3 py-2 text-sm text-ink placeholder:text-mutedink";
  const legend = "mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-mutedink";

  function pickService(id: number) {
    setServiceId(id);
    const chosen = services.find((s) => s.id === id);
    setMins(durationFor(chosen));
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-ink/40 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-label="Book an appointment"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            date,
            start: at,
            mins,
            clientId: client?.id ?? null,
            clientName: client?.name ?? query,
            stylistId: who,
            service: service?.name ?? "",
            dept: service?.dept ?? "Cutting & Styling",
          });
        }}
        noValidate
        className="w-full max-w-md rounded-lg border border-hairline bg-card"
      >
        <div className="flex items-start justify-between gap-3 border-b border-hairline px-5 py-3.5">
          <div>
            <h2 className="text-base font-semibold text-ink">Book an appointment</h2>
            <p className="text-xs text-mutedink">
              {dateLabel} · {at}–{endTime(at, mins)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-mutedink hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4">
          <label className="block">
            <span className={legend}>Client</span>
            {client ? (
              <span className="flex items-center justify-between gap-2 rounded border border-hairline bg-paper px-3 py-2">
                <span className="truncate text-sm text-ink">{client.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setClient(null);
                    setQuery("");
                  }}
                  className="shrink-0 text-xs font-semibold text-taupe-deep underline underline-offset-2"
                >
                  Change
                </button>
              </span>
            ) : (
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search a client, or type a new name"
                aria-label="Client"
                className={field}
              />
            )}
          </label>

          {!client && matches.length > 0 && (
            <ul className="-mt-1 max-h-40 overflow-y-auto rounded border border-hairline-soft">
              {matches.map((c) => (
                <li key={c.id} className="border-b border-hairline-soft last:border-0">
                  <button
                    type="button"
                    onClick={() => setClient({ id: c.id, name: c.name })}
                    className="flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left hover:bg-chip"
                  >
                    <span className="truncate text-sm text-ink">{c.name}</span>
                    <span className="tnum shrink-0 text-xs text-mutedink">{c.tel}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!client && query.trim().length >= 2 && matches.length === 0 && (
            <p className="-mt-1 text-xs text-mutedink">
              Nobody on file by that name — it will be booked as “{query.trim()}”.
            </p>
          )}

          <label className="block">
            <span className={legend}>Service</span>
            <select
              value={serviceId}
              onChange={(e) => pickService(Number(e.target.value))}
              aria-label="Service"
              className={field}
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-3">
            <label className="block flex-1">
              <span className={legend}>With</span>
              <select
                value={who}
                onChange={(e) => setWho(Number(e.target.value))}
                aria-label="Stylist"
                className={field}
              >
                {team.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block w-28">
              <span className={legend}>At</span>
              <select
                value={at}
                onChange={(e) => setAt(e.target.value)}
                aria-label="Start time"
                className={field}
              >
                {slots().map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>

            <label className="block w-28">
              <span className={legend}>For</span>
              <select
                value={mins}
                onChange={(e) => setMins(Number(e.target.value))}
                aria-label="Duration"
                className={field}
              >
                {Array.from({ length: 16 }, (_, i) => (i + 1) * SLOT_MINUTES).map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error && (
            <p role="alert" className="rounded bg-crit-soft px-3 py-2 text-xs text-crit">
              {error}
            </p>
          )}

          <p className="text-[11px] text-mutedink">
            A booking is a courtesy, not a requirement — a walk-in can still be rung up without one.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-hairline px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-2 text-sm text-mutedink hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded bg-taupe-deep px-4 py-2 text-sm font-semibold text-white hover:bg-ink"
          >
            Book it
          </button>
        </div>
      </form>
    </div>
  );
}
