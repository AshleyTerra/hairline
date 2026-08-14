"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { Badge, Card, CardTitle, PageHeader } from "@/components/ui";
import { StatTile } from "@/components/charts";
import { getClient, getStaff, loadVisits, meta } from "@/lib/data";
import { asClient } from "@/lib/clientBook";
import { longDate, phone, relativeToDemo, shortDate, zar, zar0 } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Visit } from "@/lib/types";

export default function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  /* Captures carry a negative id and are not in the migrated file, so look
     there too — otherwise a client added at the till has no file to open. */
  const { newClients } = useStore();
  const captured = newClients.find((c) => c.id === Number(id));
  const client = getClient(Number(id)) ?? (captured ? asClient(captured) : undefined);

  /* A client captured today has no history to fetch, so start them at "none"
     rather than at "still loading" — nothing will ever arrive. */
  const isCapture = Number(id) < 0;
  const [visits, setVisits] = useState<Visit[] | null>(isCapture ? [] : null);
  const [messageOpen, setMessageOpen] = useState(false);

  useEffect(() => {
    if (isCapture) return;
    let active = true;
    loadVisits(Number(id)).then((v) => {
      if (active) setVisits(v);
    });
    return () => {
      active = false;
    };
  }, [id, isCapture]);

  if (!client) notFound();

  const stylist = getStaff(client.prefStylistId);
  const yearsWithUs = client.firstVisit
    ? Math.max(1, new Date(meta.demoDate).getFullYear() - new Date(client.firstVisit).getFullYear())
    : null;

  return (
    <>
      <p className="mb-3 text-xs">
        <Link href="/clients" className="text-taupe-deep underline underline-offset-2">
          ← All clients
        </Link>
      </p>

      <PageHeader
        eyebrow={client.vip ? "Top spender" : "Client file"}
        title={client.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{phone(client.tel)}</span>
            {stylist && <span>Usually with {stylist.name}</span>}
            {client.firstVisit && (
              <span>
                Client since {shortDate(client.firstVisit)}
                {yearsWithUs ? ` · ${yearsWithUs} years` : ""}
              </span>
            )}
          </span>
        }
        actions={
          <>
            {client.vip && <Badge tone="accent">VIP</Badge>}
            {client.lapsed && <Badge tone="warn">Lapsed</Badge>}
            {client.medical && <Badge tone="crit">Medical note</Badge>}
            <button
              type="button"
              onClick={() => setMessageOpen(true)}
              className="rounded border border-taupe px-3 py-1.5 text-xs font-semibold text-taupe-deep hover:bg-chip"
            >
              Send message
            </button>
          </>
        }
      />

      {client.medical && (
        <p className="mb-4 rounded border border-crit bg-crit-soft px-4 py-2.5 text-sm text-crit">
          <strong>Medical note:</strong> {client.medical}
        </p>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Visits" value={String(client.visitCount)} hint="Since joining" />
        <StatTile label="Lifetime spend" value={zar0(client.lifetimeSpend)} />
        <StatTile label="Average visit" value={zar0(client.avgTicket)} />
        <StatTile
          label="Last seen"
          value={relativeToDemo(client.lastVisit, meta.demoDate)}
          hint={client.lastVisit ? shortDate(client.lastVisit) : undefined}
          tone={client.lapsed ? "warn" : "neutral"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardTitle
            right={
              <span className="text-xs text-mutedink">
                {visits ? `${visits.length} most recent` : "Loading…"}
              </span>
            }
          >
            Visit history
          </CardTitle>

          {visits === null && (
            <p className="px-4 py-10 text-center text-sm text-mutedink">Loading history…</p>
          )}

          {visits?.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-mutedink">
              No detailed history in the last 13 months. Older visits are counted in the totals
              above and migrate in full from MySalon.
            </p>
          )}

          {visits && visits.length > 0 && (
            <ol className="divide-y divide-hairline-soft">
              {visits.map((v) => (
                <li key={v.id} className="px-4 py-3">
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="text-sm font-semibold text-ink">
                      {longDate(v.date.slice(0, 10))}
                    </span>
                    <span className="tnum text-sm font-semibold text-ink">{zar(v.total)}</span>
                  </div>
                  <ul className="flex flex-col gap-0.5">
                    {v.lines.map((l, i) => (
                      <li
                        key={`${v.id}-${i}`}
                        className="flex items-baseline justify-between gap-3 text-xs"
                      >
                        <span className="min-w-0 text-body">
                          {l.descr}
                          {l.qty > 1 && ` ×${l.qty}`}
                          {l.disc > 0 && (
                            <span className="ml-1 text-warn">−{l.disc}%</span>
                          )}
                          <span className="ml-1.5 text-mutedink">
                            {getStaff(l.stylistId)?.name ?? ""}
                          </span>
                        </span>
                        <span className="tnum shrink-0 text-mutedink">{zar(l.price * l.qty)}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardTitle>Stylist notes</CardTitle>
            <div className="px-4 py-3">
              {client.notes ? (
                <p className="text-sm text-body">{client.notes}</p>
              ) : (
                <p className="text-sm text-mutedink">
                  No notes yet. In the new system every stylist can add colour formulas and
                  preferences here, and they travel with the client.
                </p>
              )}
            </div>
          </Card>

          <Card>
            <CardTitle>Details</CardTitle>
            <dl className="divide-y divide-hairline-soft text-sm">
              <div className="flex justify-between px-4 py-2">
                <dt className="text-mutedink">Phone</dt>
                <dd className="text-ink">{phone(client.tel)}</dd>
              </div>
              <div className="flex justify-between px-4 py-2">
                <dt className="text-mutedink">E-mail</dt>
                <dd className="text-ink">{client.email ?? "Not on file"}</dd>
              </div>
              <div className="flex justify-between px-4 py-2">
                <dt className="text-mutedink">Birthday</dt>
                <dd className="text-ink">
                  {client.birthday ? shortDate(client.birthday) : "Not on file"}
                </dd>
              </div>
              <div className="flex justify-between px-4 py-2">
                <dt className="text-mutedink">First visit</dt>
                <dd className="text-ink">{shortDate(client.firstVisit)}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>

      {messageOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Send a message"
          onClick={() => setMessageOpen(false)}
        >
          <div
            className="w-full max-w-md rounded border border-hairline bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-1 text-lg font-semibold text-ink">Message {client.firstName}</h2>
            <p className="mb-3 text-xs text-mutedink">
              Prototype preview — no message is actually sent.
            </p>
            <label className="mb-2 block text-xs">
              <span className="mb-1 block font-semibold uppercase tracking-[0.1em] text-mutedink">
                Template
              </span>
              <select className="w-full rounded border border-hairline bg-paper px-2 py-2 text-sm text-ink">
                <option>Win-back — we miss you</option>
                <option>Birthday wishes</option>
                <option>Price increase notice</option>
                <option>Thank you and rebook</option>
              </select>
            </label>
            <label className="mb-4 block text-xs">
              <span className="mb-1 block font-semibold uppercase tracking-[0.1em] text-mutedink">
                Message
              </span>
              <textarea
                rows={4}
                defaultValue={`Hi ${client.firstName}, it's been a while since we saw you at Hairline. We'd love to have you back — reply to book with ${stylist?.name ?? "your stylist"}.`}
                className="w-full rounded border border-hairline bg-paper px-2 py-2 text-sm text-body"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMessageOpen(false)}
                className="rounded px-3 py-2 text-sm text-mutedink hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setMessageOpen(false)}
                className="rounded bg-taupe-deep px-3 py-2 text-sm font-semibold text-white"
              >
                Send SMS
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
