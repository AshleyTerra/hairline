"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PlayInvoice, Role } from "./types";

const INVOICE_KEY = "hairline-demo-invoices";
const ROLE_KEY = "hairline-demo-role";
const STYLIST_KEY = "hairline-demo-stylist";

interface StoreValue {
  role: Role;
  setRole: (role: Role) => void;
  /** Which stylist the "Stylist" role is signed in as. */
  stylistId: number;
  setStylistId: (id: number) => void;
  invoices: PlayInvoice[];
  addInvoice: (invoice: Omit<PlayInvoice, "id" | "date">) => PlayInvoice;
  clearInvoices: () => void;
  hydrated: boolean;
}

const StoreContext = createContext<StoreValue | null>(null);

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function StoreProvider({
  children,
  defaultStylistId,
}: {
  children: ReactNode;
  defaultStylistId: number;
}) {
  const [role, setRoleState] = useState<Role>("owner");
  const [stylistId, setStylistIdState] = useState<number>(defaultStylistId);
  const [invoices, setInvoices] = useState<PlayInvoice[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Restore after mount so server and client render the same first paint.
  useEffect(() => {
    setRoleState(readJson<Role>(ROLE_KEY, "owner"));
    setStylistIdState(readJson<number>(STYLIST_KEY, defaultStylistId));
    setInvoices(readJson<PlayInvoice[]>(INVOICE_KEY, []));
    setHydrated(true);
  }, [defaultStylistId]);

  const persist = useCallback((key: string, value: unknown) => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage can be unavailable (private mode); the demo still works in-memory.
    }
  }, []);

  const setRole = useCallback(
    (next: Role) => {
      setRoleState(next);
      persist(ROLE_KEY, next);
    },
    [persist]
  );

  const setStylistId = useCallback(
    (next: number) => {
      setStylistIdState(next);
      persist(STYLIST_KEY, next);
    },
    [persist]
  );

  const addInvoice = useCallback(
    (invoice: Omit<PlayInvoice, "id" | "date">) => {
      const created: PlayInvoice = {
        ...invoice,
        id: Date.now(),
        date: new Date().toISOString(),
      };
      setInvoices((prev) => {
        const next = [created, ...prev];
        persist(INVOICE_KEY, next);
        return next;
      });
      return created;
    },
    [persist]
  );

  const clearInvoices = useCallback(() => {
    setInvoices([]);
    persist(INVOICE_KEY, []);
  }, [persist]);

  const value = useMemo(
    () => ({
      role,
      setRole,
      stylistId,
      setStylistId,
      invoices,
      addInvoice,
      clearInvoices,
      hydrated,
    }),
    [role, setRole, stylistId, setStylistId, invoices, addInvoice, clearInvoices, hydrated]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
