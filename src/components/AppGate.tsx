"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";
import { Nav } from "./Nav";
import { LoginScreen } from "./LoginScreen";
import { Wordmark } from "./Wordmark";
import { longDate } from "@/lib/format";
import { meta } from "@/lib/data";
import { SCREENS, canAccess } from "@/lib/admin";

/** Longest matching screen for a path, so /clients/123 resolves to "clients". */
function screenFor(pathname: string): string | null {
  const match = [...SCREENS]
    .filter((s) => (s.href === "/" ? pathname === "/" : pathname.startsWith(s.href)))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.key ?? null;
}

export function AppGate({ children }: { children: ReactNode }) {
  const { user, hydrated, role, permissions } = useStore();
  const pathname = usePathname();
  // The till lays out its own full-height surface, banner included.
  const bare = pathname.startsWith("/till");
  const screen = screenFor(pathname);
  const denied = screen !== null && user !== null && !canAccess(permissions, role, screen);

  // Hold back the first paint until the session has been read, so a signed-in
  // user never sees the login screen flash past.
  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <div className="text-3xl opacity-40">
          <Wordmark />
        </div>
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  // The menu hides screens a role cannot open; the URL must refuse them too.
  if (denied) {
    return (
      <div className="flex min-h-screen flex-col md:flex-row">
        <Nav />
        <main className="flex min-w-0 flex-1 items-center justify-center px-4 py-16">
          <div className="max-w-md text-center">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-taupe">
              Not available
            </p>
            <h1 className="mb-2 text-2xl font-light text-ink">
              This screen isn&apos;t part of your role
            </h1>
            <p className="text-sm text-mutedink">
              An owner can change who sees what under Admin → Roles &amp; screens.
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (bare) {
    return (
      <div className="flex h-screen overflow-hidden bg-canvas">
        <Nav />
        <div className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0">{children}</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Nav />
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="no-print border-b border-hairline bg-chip px-4 py-1.5 text-center text-[11px] text-taupe-deep">
          Prototype — real salon data, demo day {longDate(meta.demoDate)}. Client names and numbers
          are anonymised.
        </p>
        <main className="min-w-0 flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-10">{children}</main>
      </div>
    </div>
  );
}
