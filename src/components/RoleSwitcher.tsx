"use client";

import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { earningStylists } from "@/lib/data";
import type { Role } from "@/lib/types";

const ROLES: { value: Role; label: string; hint: string }[] = [
  { value: "owner", label: "Owner", hint: "Sees everything" },
  { value: "reception", label: "Reception", hint: "Till, clients, stock" },
  { value: "stylist", label: "Stylist", hint: "Own day and figures" },
];

/** Landing page for each role when the current page is not permitted. */
const HOME: Record<Role, string> = {
  owner: "/",
  reception: "/till",
  stylist: "/",
};

export function RoleSwitcher({ compact = false }: { compact?: boolean }) {
  const { role, setRole, stylistId, setStylistId } = useStore();
  const router = useRouter();

  function change(next: Role) {
    setRole(next);
    router.push(HOME[next]);
  }

  if (compact) {
    return (
      <label className="flex items-center gap-2 text-xs">
        <span className="sr-only">Viewing as</span>
        <select
          value={role}
          onChange={(e) => change(e.target.value as Role)}
          className="rounded border border-hairline bg-paper px-2 py-1.5 text-xs font-semibold text-ink"
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <div className="rounded border border-hairline bg-paper p-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-mutedink">
        Viewing as
      </p>
      <div className="flex flex-col gap-1">
        {ROLES.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => change(r.value)}
            aria-pressed={role === r.value}
            className={`rounded px-2.5 py-1.5 text-left text-xs transition-colors ${
              role === r.value
                ? "bg-taupe text-white"
                : "text-body hover:bg-hairline-soft"
            }`}
          >
            <span className="block font-semibold">{r.label}</span>
            <span className={role === r.value ? "text-white/80" : "text-mutedink"}>{r.hint}</span>
          </button>
        ))}
      </div>

      {role === "stylist" && (
        <label className="mt-3 block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-mutedink">
            Signed in as
          </span>
          <select
            value={stylistId}
            onChange={(e) => setStylistId(Number(e.target.value))}
            className="w-full rounded border border-hairline bg-card px-2 py-1.5 text-xs text-ink"
          >
            {earningStylists.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
