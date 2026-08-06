"use client";

import { clients, getStaff } from "@/lib/data";
import { initials } from "@/lib/format";

interface ClientPickerProps {
  clientId: number | null;
  clientName: string | null;
  /** Opens the top-bar search so a client can be chosen. */
  onChange: () => void;
  /** Voids the whole sale. Only offered once there is something to void. */
  onClear?: () => void;
}

/**
 * The receipt's client header. Keeps a fixed-height slot so the panel does not
 * reflow the moment a client is picked.
 */
export function ClientPicker({
  clientId,
  clientName,
  onChange,
  onClear,
}: ClientPickerProps) {
  const client = clientId != null ? clients.find((c) => c.id === clientId) : undefined;

  if (!clientName) {
    return (
      <div className="flex h-[70px] shrink-0 items-center gap-3 border-b border-edge-faint px-5">
        <button
          type="button"
          onClick={onChange}
          className="flex-1 rounded-[10px] bg-canvas px-4 py-2.5 text-left text-[14px] text-taupe-deep transition-colors hover:bg-chip"
        >
          Walk-in — pick a client
        </button>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 text-[12px] font-semibold text-faintink transition-colors hover:text-crit"
          >
            Clear
          </button>
        )}
      </div>
    );
  }

  const stylist = getStaff(client?.prefStylistId);

  return (
    <div className="shrink-0 border-b border-edge-faint px-5 py-4">
      <div className="flex items-center gap-[11px]">
        <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-taupe text-[13px] font-semibold text-white">
          {initials(clientName)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-[15px] font-semibold text-ink">{clientName}</span>
            {client?.vip && (
              <span className="rounded bg-chip px-1.5 py-px text-[10px] font-bold tracking-[0.04em] text-taupe-deep">
                VIP
              </span>
            )}
            {client?.medical && (
              <span className="rounded bg-crit-soft px-1.5 py-px text-[10px] font-bold tracking-[0.04em] text-crit">
                MEDICAL
              </span>
            )}
            {client?.lapsed && (
              <span className="rounded bg-warn-soft px-1.5 py-px text-[10px] font-bold tracking-[0.04em] text-warn">
                LAPSED
              </span>
            )}
          </div>
          <p className="truncate text-[12px] text-faintink">
            {client
              ? `${client.visitCount} visits${stylist ? ` · usually ${stylist.name}` : ""}`
              : "Walk-in — no client file"}
          </p>
        </div>

        <span className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={onChange}
            className="text-[12px] font-semibold text-taupe transition-colors hover:text-taupe-deep"
          >
            Change
          </button>
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="text-[12px] font-semibold text-faintink transition-colors hover:text-crit"
            >
              Clear
            </button>
          )}
        </span>
      </div>

      {client?.medical && (
        <p className="mt-2 rounded bg-crit-soft px-2.5 py-1.5 text-[11.5px] text-crit">
          {client.medical}
        </p>
      )}
    </div>
  );
}
