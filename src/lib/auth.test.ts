import { describe, expect, it } from "vitest";
import { DEMO_ACCOUNTS, authenticate } from "./auth";

describe("authenticate", () => {
  it("signs in a known user with the right password", () => {
    const user = authenticate("owner", "hairline2026");
    expect(user?.role).toBe("owner");
    expect(user?.username).toBe("owner");
  });

  it("ignores case and surrounding spaces in the username", () => {
    expect(authenticate("  Owner  ", "hairline2026")?.role).toBe("owner");
  });

  it("treats the password as case sensitive", () => {
    expect(authenticate("owner", "Hairline2026")).toBeNull();
  });

  it("rejects a wrong password", () => {
    expect(authenticate("owner", "wrong")).toBeNull();
  });

  it("rejects an unknown username", () => {
    expect(authenticate("nobody", "hairline2026")).toBeNull();
  });

  it("rejects empty credentials", () => {
    expect(authenticate("", "")).toBeNull();
    expect(authenticate("owner", "")).toBeNull();
  });

  it("never returns the password on the signed-in user", () => {
    const user = authenticate("reception", "hairline2026");
    expect(user).not.toBeNull();
    expect(Object.keys(user as object)).not.toContain("password");
  });

  it("gives every stylist account a staff member to sign in as", () => {
    for (const account of DEMO_ACCOUNTS.filter((a) => a.role === "stylist")) {
      expect(account.staffId).toBeTypeOf("number");
    }
  });

  it("has a unique username per account", () => {
    const names = DEMO_ACCOUNTS.map((a) => a.username);
    expect(new Set(names).size).toBe(names.length);
  });
});
