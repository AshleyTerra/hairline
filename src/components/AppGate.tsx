"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";
import { Nav } from "./Nav";
import { LoginScreen } from "./LoginScreen";
import { Wordmark } from "./Wordmark";
import { longDate } from "@/lib/format";
import { meta } from "@/lib/data";

export function AppGate({ children }: { children: ReactNode }) {
  const { user, hydrated } = useStore();
  const pathname = usePathname();
  // The till lays out its own full-height surface, banner included.
  const bare = pathname.startsWith("/till");

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
