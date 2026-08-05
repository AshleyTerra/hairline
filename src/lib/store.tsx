"use client";

import { useCallback, useMemo, useSyncExternalStore, type ReactNode } from "react";
import type { PlayInvoice, Role } from "./types";

const INVOICE_KEY = "hairline-demo-invoices";
const ROLE_KEY = "hairline-demo-role";
const STYLIST_KEY = "hairline-demo-stylist";

interface DemoState {
  role: Role;
  stylistId: number;
  invoices: PlayInvoice[];
}

const SERVER_STATE: DemoState = { role: "owner", stylistId: 0, invoices: [] };

/**
 * The demo's state lives outside React in a tiny observable store, read through
 * useSyncExternalStore. The server always sees SERVER_STATE, so the first paint
 * matches on both sides and localStorage is only touched on the client.
 */
class DemoStore {
  private state: DemoState = SERVER_STATE;
  private loaded = false;
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Returns a referentially stable snapshot, hydrating from storage once. */
  getSnapshot = (): DemoState => {
    if (!this.loaded) {
      this.loaded = true;
      this.state = {
        role: read<Role>(ROLE_KEY, SERVER_STATE.role),
        stylistId: read<number>(STYLIST_KEY, SERVER_STATE.stylistId),
        invoices: read<PlayInvoice[]>(INVOICE_KEY, []),
      };
    }
    return this.state;
  };

  getServerSnapshot = (): DemoState => SERVER_STATE;

  private set(patch: Partial<DemoState>) {
    this.state = { ...this.getSnapshot(), ...patch };
    this.listeners.forEach((l) => l());
  }

  setRole(role: Role) {
    write(ROLE_KEY, role);
    this.set({ role });
  }

  setStylistId(stylistId: number) {
    write(STYLIST_KEY, stylistId);
    this.set({ stylistId });
  }

  addInvoice(invoice: Omit<PlayInvoice, "id" | "date">): PlayInvoice {
    const created: PlayInvoice = { ...invoice, id: Date.now(), date: new Date().toISOString() };
    const invoices = [created, ...this.getSnapshot().invoices];
    write(INVOICE_KEY, invoices);
    this.set({ invoices });
    return created;
  }

  clearInvoices() {
    write(INVOICE_KEY, []);
    this.set({ invoices: [] });
  }
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable in private mode; the demo still works in memory.
  }
}

const store = new DemoStore();

/** Kept as a component so the app tree reads the same as before. */
export function StoreProvider({
  children,
  defaultStylistId,
}: {
  children: ReactNode;
  defaultStylistId: number;
}) {
  SERVER_STATE.stylistId ||= defaultStylistId;
  return <>{children}</>;
}

export function useStore() {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  const setRole = useCallback((role: Role) => store.setRole(role), []);
  const setStylistId = useCallback((id: number) => store.setStylistId(id), []);
  const addInvoice = useCallback(
    (invoice: Omit<PlayInvoice, "id" | "date">) => store.addInvoice(invoice),
    []
  );
  const clearInvoices = useCallback(() => store.clearInvoices(), []);

  return useMemo(
    () => ({
      role: state.role,
      stylistId: state.stylistId,
      invoices: state.invoices,
      setRole,
      setStylistId,
      addInvoice,
      clearInvoices,
    }),
    [state, setRole, setStylistId, addInvoice, clearInvoices]
  );
}
