"use client";

import { useCallback, useMemo, useSyncExternalStore, type ReactNode } from "react";
import type { PlayInvoice, Role } from "./types";
import { type SignedInUser } from "./auth";
import type { Docket } from "./dockets";
import type { NewClient } from "./types";
import {
  DEFAULT_PERMISSIONS,
  reconcilePermissions,
  defaultUsers,
  type ImportedClient,
  type ManagedUser,
  type Permissions,
} from "./admin";

const INVOICE_KEY = "hairline-demo-invoices";
const ROLE_KEY = "hairline-demo-role";
const STYLIST_KEY = "hairline-demo-stylist";
const USER_KEY = "hairline-demo-user";
const USERS_KEY = "hairline-demo-users";
const PERMS_KEY = "hairline-demo-permissions";
const IMPORTED_KEY = "hairline-demo-imported-clients";
const DOCKETS_KEY = "hairline-demo-dockets";
/** Which screens existed when the permissions were last saved. */
const SCREENKEYS_KEY = "hairline-demo-screen-keys";
const NEWCLIENTS_KEY = "hairline-demo-new-clients";

interface DemoState {
  user: SignedInUser | null;
  role: Role;
  stylistId: number;
  invoices: PlayInvoice[];
  users: ManagedUser[];
  permissions: Permissions;
  importedClients: ImportedClient[];
  /** Sales in progress, one per client at the counter. */
  dockets: Docket[];
  /** Clients added at the till during the demo. */
  newClients: NewClient[];
  /** False until the client has read localStorage, so the shell can hold back. */
  hydrated: boolean;
}

const SERVER_STATE: DemoState = {
  user: null,
  role: "owner",
  stylistId: 0,
  invoices: [],
  users: defaultUsers(),
  permissions: DEFAULT_PERMISSIONS,
  importedClients: [],
  dockets: [],
  newClients: [],
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
        users: read<ManagedUser[]>(USERS_KEY, defaultUsers()),
        permissions: read<Permissions>(PERMS_KEY, DEFAULT_PERMISSIONS),
        importedClients: read<ImportedClient[]>(IMPORTED_KEY, []),
        dockets: read<Docket[]>(DOCKETS_KEY, []),
        newClients: read<NewClient[]>(NEWCLIENTS_KEY, []),
        hydrated: true,
      };

      // A stored permission list predates any screen added since it was saved,
      // which would hide the new screen even from the owner. Reconcile on load.
      const reconciled = reconcilePermissions(
        this.state.permissions,
        read<string[]>(SCREENKEYS_KEY, [])
      );
      if (reconciled.added.length > 0) {
        this.state = { ...this.state, permissions: reconciled.permissions };
        write(PERMS_KEY, reconciled.permissions);
      }
      write(SCREENKEYS_KEY, reconciled.knownKeys);
    }
    return this.state;
  };

  getServerSnapshot = (): DemoState => SERVER_STATE;

  private set(patch: Partial<DemoState>) {
    this.state = { ...this.getSnapshot(), ...patch };
    this.listeners.forEach((l) => l());
  }

  /** Returns the signed-in user, or null when the credentials do not match. */
  signIn(username: string, password: string): SignedInUser | null {
    const name = String(username ?? "").trim().toLowerCase();
    const account = this.getSnapshot().users.find((u) => u.username === name);
    if (!name || !password || !account || account.password !== password) return null;
    const user: SignedInUser = {
      username: account.username,
      role: account.role,
      staffId: account.staffId,
      displayName: account.displayName,
    };
    write(USER_KEY, user);
    this.set({
      user,
      role: user.role,
      stylistId: user.staffId ?? this.getSnapshot().stylistId,
    });
    return user;
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

  setDockets(dockets: Docket[]) {
    write(DOCKETS_KEY, dockets);
    this.set({ dockets });
  }

  /** Adds a client captured at the till and returns the record. */
  addClient(input: Omit<NewClient, "id">): NewClient {
    const existing = this.getSnapshot().newClients;
    // Negative ids keep these clear of the migrated client file.
    const id = -(existing.length + 1);
    const created: NewClient = { ...input, id };
    const newClients = [...existing, created];
    write(NEWCLIENTS_KEY, newClients);
    this.set({ newClients });
    return created;
  }

  setUsers(users: ManagedUser[]) {
    write(USERS_KEY, users);
    this.set({ users });
  }

  setPermissions(permissions: Permissions) {
    write(PERMS_KEY, permissions);
    this.set({ permissions });
  }

  addImportedClients(clients: ImportedClient[]) {
    const importedClients = [...this.getSnapshot().importedClients, ...clients];
    write(IMPORTED_KEY, importedClients);
    this.set({ importedClients });
  }

  clearImportedClients() {
    write(IMPORTED_KEY, []);
    this.set({ importedClients: [] });
  }

  /** Returns the demo to the state a first-time visitor sees. */
  resetDemo() {
    write(INVOICE_KEY, []);
    write(USERS_KEY, defaultUsers());
    write(PERMS_KEY, DEFAULT_PERMISSIONS);
    write(IMPORTED_KEY, []);
    write(DOCKETS_KEY, []);
    write(NEWCLIENTS_KEY, []);
    this.set({
      invoices: [],
      users: defaultUsers(),
      permissions: DEFAULT_PERMISSIONS,
      importedClients: [],
      dockets: [],
      newClients: [],
    });
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
  const setUsers = useCallback((users: ManagedUser[]) => store.setUsers(users), []);
  const setPermissions = useCallback((p: Permissions) => store.setPermissions(p), []);
  const addImportedClients = useCallback(
    (clients: ImportedClient[]) => store.addImportedClients(clients),
    []
  );
  const clearImportedClients = useCallback(() => store.clearImportedClients(), []);
  const resetDemo = useCallback(() => store.resetDemo(), []);
  const setDockets = useCallback((d: Docket[]) => store.setDockets(d), []);
  const addClient = useCallback(
    (input: Omit<NewClient, "id">) => store.addClient(input),
    []
  );

  return useMemo(
    () => ({
      user: state.user,
      role: state.role,
      stylistId: state.stylistId,
      invoices: state.invoices,
      users: state.users,
      permissions: state.permissions,
      importedClients: state.importedClients,
      dockets: state.dockets,
      newClients: state.newClients,
      hydrated: state.hydrated,
      signIn,
      signOut,
      setRole,
      setStylistId,
      addInvoice,
      clearInvoices,
      setUsers,
      setPermissions,
      addImportedClients,
      clearImportedClients,
      resetDemo,
      setDockets,
      addClient,
    }),
    [state, signIn, signOut, setRole, setStylistId, addInvoice, clearInvoices, setUsers,
     setPermissions, addImportedClients, clearImportedClients, resetDemo, setDockets, addClient]
  );
}
