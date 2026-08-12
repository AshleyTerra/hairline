"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";
import { SCREENS, canAccess } from "@/lib/admin";
import { Wordmark } from "./Wordmark";
import { UserCard } from "./UserCard";

/** One path per screen key, so the icon set stays with the navigation. */
const ICONS: Record<string, string> = {
  dashboard: "M3 12h6v9H3zM10.5 3h3v18h-3zM15 8h6v13h-6z",
  till: "M3 6h18v4H3zM3 12h18v8H3zM7 16h4",
  clients: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0",
  diary: "M4 5h16v16H4zM4 9h16M9 3v4M15 3v4",
  stock: "M4 7l8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10",
  staff: "M9 11a3 3 0 100-6 3 3 0 000 6zM2 20a7 7 0 0114 0M17 11a3 3 0 100-6M17 14a6 6 0 015 6",
  cashup: "M3 7h18v10H3zM12 14a2 2 0 100-4 2 2 0 000 4z",
  pricing: "M4 4h10l6 6-10 10-6-6zM9 9h.01",
  reports: "M5 3h11l3 3v15H5zM9 12h6M9 16h6M9 8h3",
  admin: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-2.9 1.2v.2a2 2 0 11-4 0v-.1a1.7 1.7 0 00-2.9-1.2l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00-1.2-2.9H3a2 2 0 110-4h.1A1.7 1.7 0 004.3 6l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 002.9-1.2V2a2 2 0 114 0v.1a1.7 1.7 0 002.9 1.2l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 001.2 2.9H22a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z",
};

function Icon({ path, size = 18 }: { path: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

export function Nav() {
  const pathname = usePathname();
  const { role, permissions } = useStore();

  // The permission matrix in Admin is the single source of truth for the menu.
  const items = SCREENS.filter((s) => canAccess(permissions, role, s.key));

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      {/* Desktop icon rail — a counter-friendly 78px instead of a labelled sidebar.
          Pinned to the viewport so it stays put while the page scrolls. */}
      <aside className="no-print sticky top-0 hidden h-screen w-[78px] shrink-0 flex-col items-center gap-1.5 overflow-y-auto bg-ink pb-4 pt-[18px] md:flex">
        <Link href="/" className="mb-4 text-[13px] leading-none" aria-label="Hairline — home">
          <Wordmark onDark />
        </Link>

        <nav className="flex flex-col items-center gap-1.5">
          {items.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex w-[54px] flex-col items-center gap-1 rounded-xl py-[9px] transition-colors ${
                  active ? "bg-taupe text-white" : "text-railink hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                <Icon path={ICONS[item.key]} size={19} />
                <span className="text-[9.5px] tracking-[0.02em]">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto">
          <UserCard avatarOnly />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-hairline bg-card px-4 py-3 md:hidden">
        <Link href="/" className="text-xl">
          <Wordmark />
        </Link>
        <UserCard compact />
      </header>

      {/* Mobile bottom bar */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto border-t border-hairline bg-card no-scrollbar md:hidden">
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={`flex min-w-[4.5rem] flex-1 flex-col items-center gap-1 px-2 py-2 text-[11px] ${
              isActive(item.href) ? "font-semibold text-taupe-deep" : "text-mutedink"
            }`}
          >
            <Icon path={ICONS[item.key]} />
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
