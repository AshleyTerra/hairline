"use client";

import { useState } from "react";
import { validateClient, type ClientInput, type ClientKind } from "@/lib/clientBook";
import type { NewClient } from "@/lib/types";

interface NewClientDialogProps {
  onSave: (client: Omit<NewClient, "id">) => void;
  onClose: () => void;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const KINDS: { value: ClientKind; label: string; hint: string }[] = [
  {
    value: "service",
    label: "Client file",
    hint: "A full file: mobile, email and birthday, so the salon can reach them again.",
  },
  {
    value: "walkin",
    label: "Walk-in",
    hint: "A name is enough. Marked as a walk-in, so it is never mistaken for a full file.",
  },
];

const EMPTY: ClientInput = {
  name: "",
  tel: "",
  email: "",
  birthDay: "",
  birthMonth: "",
  notes: "",
};

/**
 * Captures a client at the counter so the sale lands on a real file rather than
 * disappearing as an anonymous walk-in.
 *
 * Two kinds deliberately: a proper client file demands enough detail to be worth
 * keeping, while a walk-in stays a single field so nobody is held up — and is
 * marked as such, so a thin record is never taken for a complete one.
 */
export function NewClientDialog({ onSave, onClose }: NewClientDialogProps) {
  const [kind, setKind] = useState<ClientKind>("service");
  const [draft, setDraft] = useState<ClientInput>(EMPTY);
  const [problem, setProblem] = useState<{ field: string; error: string } | null>(null);

  const set = <K extends keyof ClientInput>(key: K, value: ClientInput[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setProblem(null);
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = validateClient(draft, kind);
    if (!result.ok) {
      setProblem({ field: result.field, error: result.error });
      return;
    }
    onSave(result.client);
  }

  const needed = kind === "service";
  /** A field in error gets a red edge, so the message has something to point at. */
  const edge = (field: string) =>
    problem?.field === field ? "border-crit" : "border-hairline";

  const fields: { key: keyof ClientInput; field: string; label: string; type: string; placeholder: string; required: boolean }[] = [
    { key: "name", field: "name", label: "Name", type: "text", placeholder: "Thandi Nkosi", required: true },
    { key: "tel", field: "tel", label: "Mobile", type: "tel", placeholder: "076 408 9755", required: needed },
    { key: "email", field: "email", label: "Email", type: "email", placeholder: "thandi@example.co.za", required: needed },
  ];

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-label="Add a new client"
    >
      <form
        onSubmit={submit}
        noValidate
        className="max-h-full w-full max-w-sm overflow-y-auto rounded-lg border border-hairline bg-card"
      >
        <div className="flex items-center justify-between border-b border-hairline px-5 py-3.5">
          <h2 className="text-base font-semibold text-ink">New client</h2>
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
          {/* Which kind of record this is */}
          <div className="grid grid-cols-2 gap-1.5">
            {KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                onClick={() => {
                  setKind(k.value);
                  setProblem(null);
                }}
                aria-pressed={kind === k.value}
                className={`rounded px-3 py-2 text-[12.5px] font-semibold transition-colors ${
                  kind === k.value
                    ? "bg-taupe text-white"
                    : "bg-paper text-taupe-deep hover:bg-chip"
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
          <p className="-mt-1 text-[11px] leading-snug text-mutedink">
            {KINDS.find((k) => k.value === kind)?.hint}
          </p>

          {fields.map((f) => (
            <label key={f.key} className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-mutedink">
                {f.label}
                {!f.required && (
                  <span className="ml-1 font-normal normal-case tracking-normal">(optional)</span>
                )}
              </span>
              <input
                type={f.type}
                value={draft[f.key]}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                aria-invalid={problem?.field === f.field || undefined}
                className={`w-full rounded border bg-paper px-3 py-2 text-sm text-ink placeholder:text-faintink ${edge(f.field)}`}
              />
            </label>
          ))}

          {/* Birthday: the day and the month, never the year */}
          <fieldset className="block border-0 p-0">
            <legend className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-mutedink">
              Birthday
              {!needed && (
                <span className="ml-1 font-normal normal-case tracking-normal">(optional)</span>
              )}
            </legend>
            <div className="flex gap-2">
              <select
                value={draft.birthDay}
                onChange={(e) => set("birthDay", e.target.value)}
                aria-label="Day of birth"
                aria-invalid={problem?.field === "birthday" || undefined}
                className={`w-24 rounded border bg-paper px-2 py-2 text-sm text-ink ${edge("birthday")}`}
              >
                <option value="">Day</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <select
                value={draft.birthMonth}
                onChange={(e) => set("birthMonth", e.target.value)}
                aria-label="Month of birth"
                aria-invalid={problem?.field === "birthday" || undefined}
                className={`min-w-0 flex-1 rounded border bg-paper px-2 py-2 text-sm text-ink ${edge("birthday")}`}
              >
                <option value="">Month</option>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-1 text-[11px] text-faintink">
              The day and month only — the salon sends greetings, not birthday cards with ages on.
            </p>
          </fieldset>

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-mutedink">
              Notes <span className="font-normal normal-case tracking-normal">(optional)</span>
            </span>
            <textarea
              value={draft.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
              placeholder="Colour formula, preferences, allergies…"
              className="w-full resize-none rounded border border-hairline bg-paper px-3 py-2 text-sm text-ink placeholder:text-faintink"
            />
          </label>

          {problem && (
            <p role="alert" className="rounded bg-crit-soft px-3 py-2 text-xs text-crit">
              {problem.error}
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
            Save &amp; use
          </button>
        </div>
      </form>
    </div>
  );
}
