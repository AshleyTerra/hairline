"use client";

import { useState } from "react";
import { Badge, Card, CardTitle, TableScroll } from "@/components/ui";
import {
  addDesignation,
  editStaff,
  removeDesignation,
  renameDesignation,
  setActive,
} from "@/lib/staffAdmin";
import { useStore } from "@/lib/store";

/** Staff records: names, designations, contact details and active status. */
export function StaffPanel() {
  const { staffRecords, setStaffRecords, designations, setDesignations } = useStore();
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [newDesignation, setNewDesignation] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameTo, setRenameTo] = useState("");

  const field = "w-full rounded border border-hairline bg-paper px-2 py-1 text-sm text-ink";

  function apply(
    result:
      | { ok: true; staff: typeof staffRecords }
      | { ok: false; error: string },
    success: string
  ) {
    if (result.ok) {
      setStaffRecords(result.staff);
      setMessage({ tone: "ok", text: success });
    } else {
      setMessage({ tone: "bad", text: result.error });
    }
  }

  function applyDesignation(
    result:
      | { ok: true; designations: string[]; staff: typeof staffRecords }
      | { ok: false; error: string },
    success: string
  ) {
    if (result.ok) {
      setDesignations(result.designations);
      setStaffRecords(result.staff);
      setMessage({ tone: "ok", text: success });
      return true;
    }
    setMessage({ tone: "bad", text: result.error });
    return false;
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardTitle
          right={
            <span className="text-xs text-mutedink">
              {staffRecords.filter((s) => s.active).length} active of {staffRecords.length}
            </span>
          }
        >
          Staff records
        </CardTitle>
        <TableScroll>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-[0.08em] text-mutedink">
                <th className="px-3 py-2.5 font-semibold">No.</th>
                <th className="px-3 py-2.5 font-semibold">Name</th>
                <th className="px-3 py-2.5 font-semibold">Designation</th>
                <th className="px-3 py-2.5 font-semibold">Email</th>
                <th className="px-3 py-2.5 font-semibold">Telephone</th>
                <th className="px-3 py-2.5 text-center font-semibold">Active</th>
              </tr>
            </thead>
            <tbody>
              {staffRecords.map((s) => (
                <tr key={s.id} className="border-b border-hairline-soft last:border-0">
                  <td className="tnum px-3 py-2 text-mutedink">{s.id}</td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      defaultValue={s.name}
                      onBlur={(e) =>
                        e.target.value !== s.name &&
                        apply(
                          editStaff(staffRecords, s.id, { name: e.target.value }),
                          `Renamed to ${e.target.value}.`
                        )
                      }
                      aria-label={`Name for staff ${s.id}`}
                      className={field}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={s.designation}
                      onChange={(e) =>
                        apply(
                          editStaff(staffRecords, s.id, { designation: e.target.value }),
                          `${s.name} is now ${e.target.value}.`
                        )
                      }
                      aria-label={`Designation for ${s.name}`}
                      className={field}
                    >
                      {[...new Set([...designations, s.designation])].map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="email"
                      defaultValue={s.email}
                      placeholder="optional"
                      onBlur={(e) =>
                        e.target.value !== s.email &&
                        apply(
                          editStaff(staffRecords, s.id, { email: e.target.value }),
                          `Email saved for ${s.name}.`
                        )
                      }
                      aria-label={`Email for ${s.name}`}
                      className={field}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="tel"
                      defaultValue={s.tel}
                      placeholder="082 123 4567"
                      onBlur={(e) =>
                        e.target.value !== s.tel &&
                        apply(
                          editStaff(staffRecords, s.id, { tel: e.target.value }),
                          `Number saved for ${s.name}.`
                        )
                      }
                      aria-label={`Telephone for ${s.name}`}
                      className={field}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={s.active}
                      onChange={(e) =>
                        apply(
                          setActive(staffRecords, s.id, e.target.checked),
                          `${s.name} is now ${e.target.checked ? "active" : "inactive"}.`
                        )
                      }
                      aria-label={`Active: ${s.name}`}
                      className="h-4 w-4 accent-[#6e6455]"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
        <p className="border-t border-hairline-soft px-4 py-2.5 text-xs text-mutedink">
          Staff are never deleted — past sales point at them. Turning someone inactive keeps their
          history and takes them out of the pickers.
        </p>
      </Card>

      <Card>
        <CardTitle right={<span className="text-xs text-mutedink">{designations.length}</span>}>
          Designations
        </CardTitle>

        <ul className="divide-y divide-hairline-soft">
          {designations.map((d) => {
            const inUse = staffRecords.filter((s) => s.designation === d).length;
            return (
              <li key={d} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                {renaming === d ? (
                  <>
                    <input
                      type="text"
                      value={renameTo}
                      onChange={(e) => setRenameTo(e.target.value)}
                      aria-label={`Rename ${d}`}
                      className="rounded border border-hairline bg-paper px-2 py-1 text-sm text-ink"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          applyDesignation(
                            renameDesignation(designations, staffRecords, d, renameTo),
                            `Renamed to ${renameTo}.`
                          )
                        ) {
                          setRenaming(null);
                        }
                      }}
                      className="rounded bg-taupe-deep px-2.5 py-1 text-xs font-semibold text-white"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenaming(null)}
                      className="text-xs text-mutedink"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-sm text-ink">{d}</span>
                    {inUse > 0 ? (
                      <Badge tone="neutral">{inUse} on this</Badge>
                    ) : (
                      <span className="text-xs text-mutedink">unused</span>
                    )}
                    <span className="ml-auto flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setRenaming(d);
                          setRenameTo(d);
                        }}
                        className="text-xs text-taupe-deep underline underline-offset-2"
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          applyDesignation(
                            removeDesignation(designations, staffRecords, d),
                            `Removed ${d}.`
                          )
                        }
                        className="text-xs text-mutedink underline underline-offset-2 hover:text-crit"
                      >
                        Remove
                      </button>
                    </span>
                  </>
                )}
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap items-center gap-2 border-t border-hairline-soft px-4 py-3">
          <input
            type="text"
            value={newDesignation}
            onChange={(e) => setNewDesignation(e.target.value)}
            placeholder="New designation, e.g. Colour technician"
            aria-label="New designation"
            className="min-w-56 flex-1 rounded border border-hairline bg-paper px-3 py-1.5 text-sm text-ink"
          />
          <button
            type="button"
            onClick={() => {
              if (
                applyDesignation(
                  addDesignation(designations, staffRecords, newDesignation),
                  `Added ${newDesignation}.`
                )
              ) {
                setNewDesignation("");
              }
            }}
            className="rounded bg-taupe-deep px-4 py-1.5 text-sm font-semibold text-white hover:bg-ink"
          >
            Add
          </button>
        </div>
      </Card>

      {message && (
        <p
          role="status"
          className={`rounded px-3 py-2 text-xs ${
            message.tone === "ok" ? "bg-good-soft text-good" : "bg-crit-soft text-crit"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
