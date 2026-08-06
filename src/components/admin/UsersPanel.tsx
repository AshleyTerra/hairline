"use client";

import { useState } from "react";
import { Badge, Card, CardTitle, TableScroll } from "@/components/ui";
import { addUser, removeUser, setUserPassword, setUserRole, type Result } from "@/lib/admin";
import { earningStylists } from "@/lib/data";
import { useStore } from "@/lib/store";
import type { Role } from "@/lib/types";

const ROLES: { value: Role; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "reception", label: "Reception" },
  { value: "stylist", label: "Stylist" },
];

export function UsersPanel() {
  const { users, setUsers, user: current } = useStore();

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<Role>("reception");
  const [staffId, setStaffId] = useState<number | "">("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  function apply(result: Result, success: string) {
    if (result.ok) {
      setUsers(result.users);
      setMessage({ tone: "ok", text: success });
    } else {
      setMessage({ tone: "bad", text: result.error });
    }
    return result.ok;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const ok = apply(
      addUser(users, {
        username,
        displayName,
        role,
        password,
        staffId: role === "stylist" && staffId !== "" ? Number(staffId) : undefined,
      }),
      `${displayName || username} can now sign in.`
    );
    if (ok) {
      setUsername("");
      setDisplayName("");
      setPassword("");
      setStaffId("");
      setRole("reception");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <Card>
        <CardTitle right={<span className="text-xs text-mutedink">{users.length} users</span>}>
          Who can sign in
        </CardTitle>
        <TableScroll>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-[0.08em] text-mutedink">
                <th className="px-4 py-2.5 font-semibold">User</th>
                <th className="px-4 py-2.5 font-semibold">Role</th>
                <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.username} className="border-b border-hairline-soft last:border-0">
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-ink">{u.displayName}</span>
                    {u.username === current?.username && (
                      <span className="ml-2 align-middle">
                        <Badge tone="neutral">you</Badge>
                      </span>
                    )}
                    <span className="block font-mono text-[11px] text-mutedink">{u.username}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <select
                      value={u.role}
                      onChange={(e) =>
                        apply(
                          setUserRole(users, u.username, e.target.value as Role),
                          `${u.displayName} is now ${e.target.value}.`
                        )
                      }
                      aria-label={`Role for ${u.displayName}`}
                      className="rounded border border-hairline bg-paper px-2 py-1 text-xs text-ink"
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setResetting(resetting === u.username ? null : u.username);
                        setNewPassword("");
                      }}
                      className="text-xs text-taupe-deep underline underline-offset-2"
                    >
                      Password
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        apply(removeUser(users, u.username), `${u.displayName} was removed.`)
                      }
                      className="ml-3 text-xs text-mutedink underline underline-offset-2 hover:text-crit"
                    >
                      Remove
                    </button>

                    {resetting === u.username && (
                      <span className="mt-2 flex items-center justify-end gap-1.5">
                        <input
                          type="text"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="New password"
                          aria-label={`New password for ${u.displayName}`}
                          className="w-32 rounded border border-hairline bg-paper px-2 py-1 text-xs text-ink"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              apply(
                                setUserPassword(users, u.username, newPassword),
                                `Password changed for ${u.displayName}.`
                              )
                            ) {
                              setResetting(null);
                            }
                          }}
                          className="rounded bg-taupe-deep px-2 py-1 text-xs font-semibold text-white"
                        >
                          Save
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </Card>

      <Card>
        <CardTitle>Add someone</CardTitle>
        <form onSubmit={submit} className="flex flex-col gap-3 px-4 py-4">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-mutedink">
              Display name
            </span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Sipho Mabaso"
              className="w-full rounded border border-hairline bg-paper px-3 py-2 text-sm text-ink"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-mutedink">
              Username
            </span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoCapitalize="none"
              spellCheck={false}
              placeholder="sipho"
              className="w-full rounded border border-hairline bg-paper px-3 py-2 text-sm text-ink"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-mutedink">
              Role
            </span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="w-full rounded border border-hairline bg-paper px-3 py-2 text-sm text-ink"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>

          {role === "stylist" && (
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-mutedink">
                Which stylist
              </span>
              <select
                value={staffId}
                onChange={(e) => setStaffId(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full rounded border border-hairline bg-paper px-3 py-2 text-sm text-ink"
              >
                <option value="">Choose…</option>
                {earningStylists.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-mutedink">
              Password
            </span>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full rounded border border-hairline bg-paper px-3 py-2 text-sm text-ink"
            />
          </label>

          <button
            type="submit"
            className="mt-1 w-full rounded bg-taupe-deep px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink"
          >
            Add user
          </button>

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
        </form>
      </Card>
    </div>
  );
}
