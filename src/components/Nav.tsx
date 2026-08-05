"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";
import type { Role } from "@/lib/types";
import { Wordmark } from "./Wordmark";
import { RoleSwitcher } from "./RoleSwitcher";

interface NavItem {
  href: string;
  label: string;
  roles: Role[];
  icon: string;
}

const ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", roles: ["owner", "stylist"], icon: "M3 12h6v9H3zM10.5 3h3v18h-3zM15 8h6v13h-6z" },
  { href: "/till", label: "Till", roles: ["owner", "reception"], icon: "M3 6h18v4H3zM3 12h18v8H3zM7 16h4" },
  { href: "/clients", label: "Clients", roles: ["owner", "reception", "stylist"], icon: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0" },
  { href: "/diary", label: "Diary", roles: ["owner", "reception", "stylist"], icon: "M4 5h16v16H4zM4 9h16M9 3v4M15 3v4" },
  { href: "/stock", label: "Stock", roles: ["owner", "reception"], icon: "M4 7l8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10" },
  { href: "/staff", label: "Team", roles: ["owner", "reception"], icon: "M9 11a3 3 0 100-6 3 3 0 000 6zM2 20a7 7 0 0114 0M17 11a3 3 0 100-6M17 14a6 6 0 015 6" },
  { href: "/cashup", label: "Cash-up", roles: ["owner", "reception"], icon: "M3 7h18v10H3zM12 14a2 2 0 100-4 2 2 0 000 4z" },
  { href: "/pricing", label: "Pricing", roles: ["owner", "reception"], icon: "M4 4h10l6 6-10 10-6-6zM9 9h.01" },
];

function Icon({ path }: { path: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px] shrink-0"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

export function Nav() {
  const pathname = usePathname();
  const { role } = useStore();
  const items = ITEMS.filter((i) => i.roles.includes(role));

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="no-print hidden md:flex md:w-56 md:shrink-0 md:flex-col md:gap-1 md:border-r md:border-hairline md:bg-card md:px-3 md:py-5">
        <Link href="/" className="mb-5 px-2 text-2xl">
          <Wordmark />
        </Link>
        <nav className="flex flex-col gap-0.5">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={`flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors ${
                isActive(item.href)
                  ? "bg-chip font-semibold text-ink"
                  : "text-body hover:bg-hairline-soft hover:text-ink"
              }`}
            >
              <span className={isActive(item.href) ? "text-taupe-deep" : "text-taupe"}>
                <Icon path={item.icon} />
              </span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto pt-5">
          <RoleSwitcher />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-hairline bg-card px-4 py-3 md:hidden">
        <Link href="/" className="text-xl">
          <Wordmark />
        </Link>
        <RoleSwitcher compact />
      </header>

      {/* Mobile bottom bar */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto border-t border-hairline bg-card md:hidden no-scrollbar">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={`flex min-w-[4.5rem] flex-1 flex-col items-center gap-1 px-2 py-2 text-[11px] ${
              isActive(item.href) ? "text-taupe-deep font-semibold" : "text-mutedink"
            }`}
          >
            <Icon path={item.icon} />
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
