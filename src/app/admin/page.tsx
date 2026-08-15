"use client";

import { useState } from "react";
import { PageHeader, Card } from "@/components/ui";
import { UsersPanel } from "@/components/admin/UsersPanel";
import { PermissionsPanel } from "@/components/admin/PermissionsPanel";
import { AbilitiesPanel } from "@/components/admin/AbilitiesPanel";
import { ExportPanel } from "@/components/admin/ExportPanel";
import { ImportClientsPanel } from "@/components/admin/ImportClientsPanel";
import { RestorePanel } from "@/components/admin/RestorePanel";
import { StaffPanel } from "@/components/admin/StaffPanel";
import { StockAdminPanel } from "@/components/admin/StockAdminPanel";
import { canAccess } from "@/lib/admin";
import { useStore } from "@/lib/store";

type Tab = "users" | "permissions" | "export" | "import" | "restore" | "staff" | "stock";

interface TabDef {
  key: Tab;
  label: string;
  /** Reception runs the data jobs; only the owner manages people and access. */
  ownerOnly?: boolean;
}

const TABS: TabDef[] = [
  { key: "export", label: "Export data" },
  { key: "import", label: "Load clients" },
  { key: "stock", label: "Stock lines" },
  { key: "restore", label: "MySalon backup" },
  { key: "staff", label: "Staff", ownerOnly: true },
  { key: "users", label: "Users", ownerOnly: true },
  { key: "permissions", label: "Roles & screens", ownerOnly: true },
];

export default function AdminPage() {
  const { role, permissions, resetDemo } = useStore();
  const isOwner = role === "owner";
  const [tab, setTab] = useState<Tab>("export");
  const [confirmReset, setConfirmReset] = useState(false);

  if (!canAccess(permissions, role, "admin")) {
    return (
      <>
        <PageHeader eyebrow="Admin" title="Not available" />
        <Card className="px-4 py-8">
          <p className="text-sm text-mutedink">
            Your role does not have access to the admin screen. An owner can grant it under
            Roles &amp; screens.
          </p>
        </Card>
      </>
    );
  }

  const visible = TABS.filter((t) => !t.ownerOnly || isOwner);
  const active = visible.some((t) => t.key === tab) ? tab : visible[0].key;

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Settings and data"
        subtitle={
          isOwner
            ? "Users, access, exports and imports."
            : "Exports and imports. Users and access are managed by the owner."
        }
        actions={
          isOwner ? (
            confirmReset ? (
              <span className="flex items-center gap-2">
                <span className="text-xs text-crit">Reset everything?</span>
                <button
                  type="button"
                  onClick={() => {
                    resetDemo();
                    setConfirmReset(false);
                  }}
                  className="rounded bg-crit px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Yes, reset
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="text-xs text-mutedink underline underline-offset-2"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="rounded border border-hairline px-3 py-1.5 text-xs font-semibold text-mutedink hover:text-ink"
              >
                Reset the demo
              </button>
            )
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap gap-1">
        {visible.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-pressed={active === t.key}
            className={`rounded-full px-3.5 py-1.5 text-xs transition-colors ${
              active === t.key
                ? "bg-taupe font-semibold text-white"
                : "bg-chip text-taupe-deep hover:bg-hairline"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active === "export" && <ExportPanel />}
      {active === "import" && <ImportClientsPanel />}
      {active === "restore" && <RestorePanel />}
      {active === "staff" && <StaffPanel />}
      {active === "stock" && <StockAdminPanel />}
      {active === "users" && <UsersPanel />}
      {active === "permissions" && (
        <div className="flex flex-col gap-4">
          <PermissionsPanel />
          <AbilitiesPanel />
        </div>
      )}
    </>
  );
}
