"use client";

import { useState } from "react";
import type { StaffRecord } from "@/lib/staffAdmin";

export interface StaffDraft {
  name: string;
  designation: string;
  email: string;
  tel: string;
}

/** Add or edit a staff member. The same form serves both. */
export function StaffDialog({
  existing,
  designations,
  error,
  onSave,
  onClose,
}: {
  /** Null when adding. */
  existing: StaffRecord | null;
  designations: readonly string[];
  error?: string | null;
  onSave: (draft: StaffDraft) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<StaffDraft>({
    name: existing?.name ?? "",
    designation: existing?.designation ?? designations[0] ?? "Stylist",
    email: existing?.email ?? "",
    tel: existing?.tel ?? "",
  });

  const field =
    "w-full rounded border border-hairline bg-paper px-3 py-2 text-sm text-ink placeholder:text-mutedink";
  const legend = "mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-mutedink";

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-label={existing ? `Edit ${existing.name}` : "Add a staff member"}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(draft);
        }}
        /* Our own checks do the talking — the browser's bubble says nothing about
           South African phone numbers, and it blocks submission silently. */
        noValidate
        className="w-full max-w-sm rounded-lg border border-hairline bg-card"
      >
        <div className="flex items-center justify-between border-b border-hairline px-5 py-3.5">
          <h2 className="text-base font-semibold text-ink">
            {existing ? `Edit ${existing.name}` : "Add a staff member"}
          </h2>
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
            <span className={legend}>Name</span>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Nomsa Dlamini"
              aria-label="Staff name"
              className={field}
            />
          </label>

          <label className="block">
            <span className={legend}>Designation</span>
            <select
              value={draft.designation}
              onChange={(e) => setDraft({ ...draft, designation: e.target.value })}
              aria-label="Staff designation"
              className={field}
            >
              {[...new Set([...designations, draft.designation])].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className={legend}>
              Email <span className="font-normal normal-case tracking-normal">(optional)</span>
            </span>
            <input
              type="email"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              placeholder="name@example.co.za"
              aria-label="Staff email"
              className={field}
            />
          </label>

          <label className="block">
            <span className={legend}>
              Telephone <span className="font-normal normal-case tracking-normal">(optional)</span>
            </span>
            <input
              type="tel"
              value={draft.tel}
              onChange={(e) => setDraft({ ...draft, tel: e.target.value })}
              placeholder="082 123 4567"
              aria-label="Staff telephone"
              className={field}
            />
          </label>

          {error && (
            <p role="alert" className="rounded bg-crit-soft px-3 py-2 text-xs text-crit">
              {error}
            </p>
          )}

          {existing && (
            <p className="text-[11px] text-mutedink">
              Number {existing.id} — it stays with them, because past sales point at it.
            </p>
          )}
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
            {existing ? "Save changes" : "Add staff member"}
          </button>
        </div>
      </form>
    </div>
  );
}
