"use client";

import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { getStaff } from "@/lib/data";
import { initials } from "@/lib/format";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner — sees everything",
  reception: "Reception — till and clients",
  stylist: "Stylist — own day and figures",
};

export function UserCard({ compact = false }: { compact?: boolean }) {
  const { user, stylistId, signOut } = useStore();
  const router = useRouter();

  if (!user) return null;

  const name =
    user.role === "stylist" ? (getStaff(stylistId)?.name ?? user.displayName) : user.displayName;

  function handleSignOut() {
    signOut();
    router.push("/");
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleSignOut}
        className="flex items-center gap-2 text-xs text-mutedink"
        title={`Signed in as ${name} — tap to sign out`}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-chip text-[11px] font-semibold text-taupe-deep">
          {initials(name)}
        </span>
        <span className="underline underline-offset-2">Sign out</span>
      </button>
    );
  }

  return (
    <div className="rounded border border-hairline bg-paper p-3">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-taupe text-sm font-semibold text-white">
          {initials(name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{name}</p>
          <p className="truncate text-[11px] text-mutedink">{ROLE_LABEL[user.role]}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={handleSignOut}
        className="mt-2.5 w-full rounded border border-hairline px-2.5 py-1.5 text-xs font-semibold text-body transition-colors hover:bg-hairline-soft hover:text-ink"
      >
        Sign out
      </button>
    </div>
  );
}
