"use client";

import { Card, CardTitle, TableScroll } from "@/components/ui";
import { ABILITIES, canDo, toggleAbility } from "@/lib/admin";
import { useStore } from "@/lib/store";
import type { Role } from "@/lib/types";

const ROLES: { value: Role; label: string; hint: string }[] = [
  { value: "owner", label: "Owner", hint: "Runs the business" },
  { value: "reception", label: "Reception", hint: "Runs the front desk" },
  { value: "stylist", label: "Stylist", hint: "Sees their own work" },
];

/**
 * What each role may *do*, as opposed to which screens they may open. Changing a
 * price at the counter is a different decision from being allowed to work the
 * till at all, so it is kept apart from the screen grid.
 */
export function AbilitiesPanel() {
  const { abilities, setAbilities } = useStore();

  return (
    <Card>
      <CardTitle right={<span className="text-xs text-mutedink">Changes apply immediately</span>}>
        What each role may do at the counter
      </CardTitle>

      <p className="border-b border-hairline-soft px-4 py-3 text-xs text-mutedink">
        Screen permissions above decide what someone can open. These decide what they can change
        once they are there. Every price change is recorded against the person who made it,
        whichever boxes are ticked here.
      </p>

      <TableScroll>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-[0.08em] text-mutedink">
              <th className="px-4 py-2.5 font-semibold">Ability</th>
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
            {ABILITIES.map((ability) => (
              <tr key={ability.key} className="border-b border-hairline-soft last:border-0">
                <td className="px-4 py-2.5">
                  <span className="font-medium text-ink">{ability.label}</span>
                  <span className="block text-[11px] text-mutedink">{ability.description}</span>
                </td>
                {ROLES.map((r) => (
                  <td key={r.value} className="px-4 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={canDo(abilities, r.value, ability.key)}
                      onChange={() => setAbilities(toggleAbility(abilities, r.value, ability.key))}
                      aria-label={`${ability.label} for ${r.label}`}
                      className="h-4 w-4 accent-[#6e6455]"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
    </Card>
  );
}
