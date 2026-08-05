"use client";

import { useCallback, useMemo, useSyncExternalStore, type ReactNode } from "react";
import type { PlayInvoice, Role } from "./types";
import { authenticate, type SignedInUser } from "./auth";

const INVOICE_KEY = "hairline-demo-invoices";
const ROLE_KEY = "hairline-demo-role";
const STYLIST_KEY = "hairline-demo-stylist";
const USER_KEY = "hairline-demo-user";

interface DemoState {
  user: SignedInUser | null;
  role: Role;
  stylistId: number;
  invoices: PlayInvoice[];
  /** False until the client has read localStorage, so the shell can hold back. */
  hydrated: boolean;
}

const SERVER_STATE: DemoState = {
  user: null,
  role: "owner",
  stylistId: 0,
  invoices: [],
  hydrated: false,
};

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
      const user = read<SignedInUser | null>(USER_KEY, null);
      this.state = {
        user,
        role: user?.role ?? read<Role>(ROLE_KEY, SERVER_STATE.role),
        stylistId: user?.staffId ?? read<number>(STYLIST_KEY, SERVER_STATE.stylistId),
        invoices: read<PlayInvoice[]>(INVOICE_KEY, []),
        hydrated: true,
      };
    }
    return this.state;
  };

  getServerSnapshot = (): DemoState => SERVER_STATE;

  private set(patch: Partial<DemoState>) {
    this.state = { ...this.getSnapshot(), ...patch };
    this.listeners.forEach((l) => l());
  }

  /** Returns true when the credentials matched and the session started. */
  signIn(username: string, password: string): boolean {
    const user = authenticate(username, password);
    if (!user) return false;
    write(USER_KEY, user);
    this.set({
      user,
      role: user.role,
      stylistId: user.staffId ?? this.getSnapshot().stylistId,
    });
    return true;
  }

  signOut() {
    write(USER_KEY, null);
    this.set({ user: null });
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

/** Exported for tests; components should use useStore(). */
export const demoStore = store;

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
  const signIn = useCallback(
    (username: string, password: string) => store.signIn(username, password),
    []
  );
  const signOut = useCallback(() => store.signOut(), []);

  return useMemo(
    () => ({
      user: state.user,
      role: state.role,
      stylistId: state.stylistId,
      invoices: state.invoices,
      hydrated: state.hydrated,
      signIn,
      signOut,
      setRole,
      setStylistId,
      addInvoice,
      clearInvoices,
    }),
    [state, signIn, signOut, setRole, setStylistId, addInvoice, clearInvoices]
  );
}
