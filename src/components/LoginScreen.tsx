"use client";

import { useState } from "react";
import { DEMO_ACCOUNTS } from "@/lib/auth";
import { meta } from "@/lib/data";
import { useStore } from "@/lib/store";
import { Wordmark } from "./Wordmark";

export function LoginScreen() {
  const { signIn } = useStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!signIn(username, password)) {
      setError("That username and password don't match. Check the demo sign-ins below.");
      setPassword("");
    }
  }

  /** Fills the form from a demo account so the owner can get in with one click. */
  function fillFrom(name: string) {
    setUsername(name);
    setPassword("hairline2026");
    setError(null);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4 py-10">
      <div className="w-full max-w-4xl">
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-12">
          {/* Sign in */}
          <div className="flex flex-col justify-center">
            <div className="mb-6 text-4xl">
              <Wordmark />
            </div>
            <h1 className="mb-1 text-2xl font-light text-ink">Salon Manager</h1>
            <p className="mb-6 text-sm text-mutedink">
              Sign in to open the prototype. Built on Hairline&apos;s own data — client names are
              anonymised.
            </p>

            <form onSubmit={submit} className="flex flex-col gap-3">
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-mutedink">
                  Username
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError(null);
                  }}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="w-full rounded border border-hairline bg-card px-3 py-2.5 text-sm text-ink placeholder:text-mutedink"
                  placeholder="owner"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-mutedink">
                  Password
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  autoComplete="current-password"
                  className="w-full rounded border border-hairline bg-card px-3 py-2.5 text-sm text-ink"
                  placeholder="••••••••"
                />
              </label>

              {error && (
                <p role="alert" className="rounded bg-crit-soft px-3 py-2 text-xs text-crit">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="mt-1 w-full rounded bg-taupe-deep px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-ink"
              >
                Sign in
              </button>
            </form>
          </div>

          {/* Demo sign-ins */}
          <div className="flex flex-col justify-center">
            <div className="rounded border border-hairline bg-card p-4">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-taupe">
                Demo sign-ins
              </p>
              <p className="mb-3 text-xs text-mutedink">
                Each one opens the system as that person sees it. Password for all:{" "}
                <code className="rounded bg-chip px-1.5 py-0.5 font-mono text-[11px] text-taupe-deep">
                  hairline2026
                </code>
              </p>

              <ul className="flex flex-col gap-1.5">
                {DEMO_ACCOUNTS.map((a) => (
                  <li key={a.username}>
                    <button
                      type="button"
                      onClick={() => fillFrom(a.username)}
                      className="flex w-full items-center justify-between gap-3 rounded border border-hairline-soft px-3 py-2 text-left transition-colors hover:border-taupe hover:bg-chip"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-ink">
                          {a.displayName}
                        </span>
                        <span className="block text-[11px] text-mutedink">{a.description}</span>
                      </span>
                      <code className="shrink-0 rounded bg-paper px-2 py-1 font-mono text-[11px] text-taupe-deep">
                        {a.username}
                      </code>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-mutedink">
              <strong className="text-body">A note on this sign-in.</strong> The prototype is a
              static site with no server, so this screen keeps the demo link away from casual
              visitors — it is not real security. Proper accounts and passwords live on the server
              in the production build.
            </p>
          </div>
        </div>

        <p className="mt-8 text-center text-[11px] text-mutedink">
          Hairline · Shop 30, Stoneridge Centre, Greenstone Park · Demo data to{" "}
          {meta.dataAsOf.split("-").reverse().join("/")}
        </p>
      </div>
    </div>
  );
}
