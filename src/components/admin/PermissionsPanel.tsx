"use client";

import { Card, CardTitle, TableScroll } from "@/components/ui";
import { SCREENS, canAccess, isLocked, togglePermission } from "@/lib/admin";
import { useStore } from "@/lib/store";
import type { Role } from "@/lib/types";

const ROLES: { value: Role; label: string; hint: string }[] = [
  { value: "owner", label: "Owner", hint: "Runs the business" },
  { value: "reception", label: "Reception", hint: "Runs the front desk" },
  { value: "stylist", label: "Stylist", hint: "Sees their own work" },
];

export function PermissionsPanel() {
  const { permissions, setPermissions } = useStore();

  return (
    <Card>
      <CardTitle right={<span className="text-xs text-mutedink">Changes apply immediately</span>}>
        Which screens each role can open
      </CardTitle>

      <p className="border-b border-hairline-soft px-4 py-3 text-xs text-mutedink">
        Tick a box to give that role the screen. The menu on the left updates the moment you
        change something — sign in as that person to see exactly what they get.
      </p>

      <TableScroll>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-[0.08em] text-mutedink">
              <th className="px-4 py-2.5 font-semibold">Screen</th>
              {ROLES.map((r) => (
                <th key={r.value} className="px-4 py-2.5 text-center font-semibold">
                  {r.label}
                  <span className="block font-normal normal-case tracking-normal text-mutedink">
                    {r.hint}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SCREENS.map((screen) => (
              <tr key={screen.key} className="border-b border-hairline-soft last:border-0">
                <td className="px-4 py-2.5">
                  <span className="font-medium text-ink">{screen.label}</span>
                  <span className="block text-[11px] text-mutedink">{screen.description}</span>
                </td>
                {ROLES.map((r) => {
                  const on = canAccess(permissions, r.value, screen.key);
                  const locked = isLocked(r.value, screen.key);
                  return (
                    <td key={r.value} className="px-4 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={locked}
                        onChange={() =>
                          setPermissions(togglePermission(permissions, r.value, screen.key))
                        }
                        aria-label={`${screen.label} for ${r.label}`}
                        title={
                          locked
                            ? "The owner always keeps Admin, so nobody can lock themselves out."
                            : undefined
                        }
                        className="h-4 w-4 accent-[#6e6455] disabled:opacity-40"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
    </Card>
  );
}
