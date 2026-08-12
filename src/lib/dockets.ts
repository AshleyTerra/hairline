import type { TillState } from "./types";

/**
 * A docket is a sale in progress. Reception opens one per client as they arrive
 * — often before the work starts — adds to it through the visit, and finalises
 * it at the counter. Several are open at once on a busy Saturday.
 */
export interface Docket {
  /** Invoice number, allocated when the docket is opened, never reused. */
  number: number;
  openedAt: string;
  /**
   * The day this docket is for, YYYY-MM-DD. Usually today, but reception can
   * prepare one for an upcoming day. Older dockets have no value here and are
   * treated as belonging to the day they were opened.
   */
  forDate?: string;
  state: TillState;
}

/** The day a docket belongs to, tolerating dockets saved before forDate existed. */
export function docketDate(docket: Docket): string {
  return docket.forDate ?? docket.openedAt.slice(0, 10);
}

/** Dockets for one day. */
export function docketsOn(dockets: readonly Docket[], date: string): Docket[] {
  return dockets.filter((d) => docketDate(d) === date);
}

/** Invoice numbers carry on from the salon's existing sequence. */
export function nextNumber(dockets: readonly Docket[], lastUsed: number): number {
  const highest = dockets.reduce((max, d) => Math.max(max, d.number), lastUsed);
  return highest + 1;
}

export function openDocket(
  dockets: readonly Docket[],
  state: TillState,
  lastUsed: number,
  now: string,
  /** Which day the docket is for; defaults to the day it was opened. */
  forDate?: string
): { docket: Docket; dockets: Docket[] } {
  const docket: Docket = {
    number: nextNumber(dockets, lastUsed),
    openedAt: now,
    forDate: forDate ?? now.slice(0, 10),
    state,
  };
  return { docket, dockets: [...dockets, docket] };
}

/** Replaces a docket's contents, leaving its number and open time alone. */
export function saveDocket(
  dockets: readonly Docket[],
  number: number,
  state: TillState
): Docket[] {
  return dockets.map((d) => (d.number === number ? { ...d, state } : d));
}

export function closeDocket(dockets: readonly Docket[], number: number): Docket[] {
  return dockets.filter((d) => d.number !== number);
}

export function findDocket(dockets: readonly Docket[], number: number): Docket | undefined {
  return dockets.find((d) => d.number === number);
}

/** Total on a docket, used for the day list without recomputing the till. */
export function docketTotal(docket: Docket): number {
  const lines = docket.state.lines.reduce(
    (sum, l) => sum + l.price * (l.qty ?? 1) * (1 - (l.disc ?? 0) / 100),
    0
  );
  return Math.round(lines * 100) / 100;
}

/** True when nothing has been added yet, so it is safe to discard. */
export function isEmptyDocket(docket: Docket): boolean {
  return docket.state.lines.length === 0 && docket.state.payments.length === 0;
}
