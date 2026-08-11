"use client";

import { useState } from "react";

interface NewClientDialogProps {
  onSave: (client: { name: string; tel: string; email: string; notes: string }) => void;
  onClose: () => void;
}

/** Captures a walk-in on the spot, so the sale lands on a real client file. */
export function NewClientDialog({ onSave, onClose }: NewClientDialogProps) {
  const [name, setName] = useState("");
  const [tel, setTel] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("A name is needed — everything else can follow later.");
      return;
    }
    const digits = tel.replace(/\D/g, "");
    if (tel && digits.length < 9) {
      setError("That phone number looks too short.");
      return;
    }
    onSave({ name: trimmed, tel: tel.trim(), email: email.trim(), notes: notes.trim() });
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-label="Add a new client"
    >
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-lg border border-hairline bg-card"
      >
        <div className="flex items-center justify-between border-b border-hairline px-5 py-3.5">
          <h2 className="text-base font-semibold text-ink">New client</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-mutedink hover:text-ink">
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4">
          {[
            { label: "Name", value: name, set: setName, type: "text", placeholder: "Thandi Nkosi", required: true },
            { label: "Phone", value: tel, set: setTel, type: "tel", placeholder: "082 123 4567" },
            { label: "Email", value: email, set: setEmail, type: "email", placeholder: "optional" },
          ].map((f) => (
            <label key={f.label} className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-mutedink">
                {f.label}
                {!f.required && <span className="ml-1 font-normal normal-case tracking-normal">(optional)</span>}
              </span>
              <input
                type={f.type}
                value={f.value}
                onChange={(e) => {
                  f.set(e.target.value);
                  setError(null);
                }}
                placeholder={f.placeholder}
                className="w-full rounded border border-hairline bg-paper px-3 py-2 text-sm text-ink placeholder:text-faintink"
              />
            </label>
          ))}

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-mutedink">
              Notes <span className="font-normal normal-case tracking-normal">(optional)</span>
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Colour formula, preferences, allergies…"
              className="w-full resize-none rounded border border-hairline bg-paper px-3 py-2 text-sm text-ink placeholder:text-faintink"
            />
          </label>

          {error && (
            <p role="alert" className="rounded bg-crit-soft px-3 py-2 text-xs text-crit">
              {error}
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
