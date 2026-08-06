import { beforeEach, describe, expect, it, vi } from "vitest";

/** Minimal localStorage so the store can be exercised outside a browser. */
class MemoryStorage {
  private map = new Map<string, string>();
  getItem = (k: string) => this.map.get(k) ?? null;
  setItem = (k: string, v: string) => void this.map.set(k, v);
  removeItem = (k: string) => void this.map.delete(k);
  clear = () => this.map.clear();
}

vi.stubGlobal("window", { localStorage: new MemoryStorage() });

const { demoStore } = await import("./store");

describe("sign in", () => {
  beforeEach(() => {
    demoStore.signOut();
  });

  it("starts signed out", () => {
    expect(demoStore.getSnapshot().user).toBeNull();
  });

  it("signs the owner in and switches the role", () => {
    // signIn returns the user so the caller can route them to their own home.
    expect(demoStore.signIn("owner", "hairline2026")?.role).toBe("owner");
    const state = demoStore.getSnapshot();
    expect(state.user?.displayName).toBe("Salon Owner");
    expect(state.role).toBe("owner");
  });

  it("signs a stylist in as their own staff record", () => {
    expect(demoStore.signIn("karin", "hairline2026")?.staffId).toBe(1);
    const state = demoStore.getSnapshot();
    expect(state.role).toBe("stylist");
    expect(state.stylistId).toBe(1);
  });

  it("switching stylist accounts moves to the other staff member", () => {
    demoStore.signIn("karin", "hairline2026");
    demoStore.signIn("meagan", "hairline2026");
    expect(demoStore.getSnapshot().stylistId).toBe(6);
  });

  it("refuses a wrong password and stays signed out", () => {
    expect(demoStore.signIn("owner", "nope")).toBeNull();
    expect(demoStore.getSnapshot().user).toBeNull();
  });

  it("signing out clears the user", () => {
    demoStore.signIn("reception", "hairline2026");
    demoStore.signOut();
    expect(demoStore.getSnapshot().user).toBeNull();
  });

  it("notifies subscribers when the session changes", () => {
    const listener = vi.fn();
    const unsubscribe = demoStore.subscribe(listener);
    demoStore.signIn("owner", "hairline2026");
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it("keeps play invoices across a sign out", () => {
    demoStore.signIn("reception", "hairline2026");
    demoStore.addInvoice({
      clientId: null,
      clientName: "Walk-in",
      total: 350,
      lines: [],
      payments: [],
      tips: [],
      seconds: 20,
    });
    demoStore.signOut();
    expect(demoStore.getSnapshot().invoices).toHaveLength(1);
    demoStore.clearInvoices();
  });
});
