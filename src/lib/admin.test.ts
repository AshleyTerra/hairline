import { describe, expect, it } from "vitest";
import {
  DEFAULT_PERMISSIONS,
  SCREENS,
  addUser,
  canAccess,
  defaultUsers,
  describeBackup,
  parseClientImport,
  removeUser,
  setUserRole,
  togglePermission,
} from "./admin";

const users = () => defaultUsers();

describe("adding a user", () => {
  it("adds a valid user", () => {
    const r = addUser(users(), {
      username: "sipho",
      displayName: "Sipho M.",
      role: "reception",
      password: "salon1234",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.users.some((u) => u.username === "sipho")).toBe(true);
  });

  it("lower-cases and trims the username", () => {
    const r = addUser(users(), {
      username: "  Sipho  ",
      displayName: "Sipho M.",
      role: "reception",
      password: "salon1234",
    });
    expect(r.ok && r.users.at(-1)?.username).toBe("sipho");
  });

  it("refuses a duplicate username", () => {
    const r = addUser(users(), {
      username: "owner",
      displayName: "Someone",
      role: "owner",
      password: "salon1234",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/already/i);
  });

  it("refuses a blank username or display name", () => {
    expect(addUser(users(), { username: " ", displayName: "X", role: "owner", password: "salon1234" }).ok).toBe(false);
    expect(addUser(users(), { username: "x", displayName: " ", role: "owner", password: "salon1234" }).ok).toBe(false);
  });

  it("refuses a short password", () => {
    const r = addUser(users(), {
      username: "sipho",
      displayName: "Sipho M.",
      role: "reception",
      password: "123",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/8 characters/i);
  });

  it("refuses a username with spaces or symbols", () => {
    const r = addUser(users(), {
      username: "si pho!",
      displayName: "Sipho",
      role: "reception",
      password: "salon1234",
    });
    expect(r.ok).toBe(false);
  });
});

describe("removing a user", () => {
  it("removes an added user", () => {
    const added = addUser(users(), {
      username: "sipho",
      displayName: "Sipho M.",
      role: "reception",
      password: "salon1234",
    });
    if (!added.ok) throw new Error("setup failed");
    const r = removeUser(added.users, "sipho");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.users.some((u) => u.username === "sipho")).toBe(false);
  });

  it("refuses to remove the last owner", () => {
    const onlyOwner = users().filter((u) => u.role === "owner");
    const r = removeUser(onlyOwner, "owner");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/last owner/i);
  });

  it("refuses to remove a user that does not exist", () => {
    expect(removeUser(users(), "ghost").ok).toBe(false);
  });
});

describe("changing a role", () => {
  it("changes the role of a user", () => {
    const r = setUserRole(users(), "reception", "owner");
    expect(r.ok && r.users.find((u) => u.username === "reception")?.role).toBe("owner");
  });

  it("refuses to demote the last owner", () => {
    const onlyOwner = users().filter((u) => u.role === "owner");
    const r = setUserRole(onlyOwner, "owner", "reception");
    expect(r.ok).toBe(false);
  });
});

describe("screen permissions", () => {
  it("gives the owner every screen by default", () => {
    for (const screen of SCREENS) {
      expect(canAccess(DEFAULT_PERMISSIONS, "owner", screen.key)).toBe(true);
    }
  });

  it("keeps the till away from a stylist by default", () => {
    expect(canAccess(DEFAULT_PERMISSIONS, "stylist", "till")).toBe(false);
  });

  it("toggles a screen off and back on", () => {
    let perms = togglePermission(DEFAULT_PERMISSIONS, "reception", "stock");
    expect(canAccess(perms, "reception", "stock")).toBe(false);
    perms = togglePermission(perms, "reception", "stock");
    expect(canAccess(perms, "reception", "stock")).toBe(true);
  });

  it("never lets the owner lose the admin screen", () => {
    const perms = togglePermission(DEFAULT_PERMISSIONS, "owner", "admin");
    expect(canAccess(perms, "owner", "admin")).toBe(true);
  });

  it("does not mutate the permissions it was given", () => {
    const before = JSON.stringify(DEFAULT_PERMISSIONS);
    togglePermission(DEFAULT_PERMISSIONS, "reception", "stock");
    expect(JSON.stringify(DEFAULT_PERMISSIONS)).toBe(before);
  });
});

describe("importing clients from a CSV", () => {
  it("reads well-formed rows", () => {
    const r = parseClientImport("Name,Phone,Email\nThandi Nkosi,082 123 4567,t@example.co.za");
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].name).toBe("Thandi Nkosi");
    expect(r.errors).toHaveLength(0);
  });

  it("accepts the common header spellings", () => {
    const r = parseClientImport("Client Name,Cell,Birthday\nSipho M,0821234567,1990-04-12");
    expect(r.rows[0].name).toBe("Sipho M");
    expect(r.rows[0].tel).toBe("0821234567");
    expect(r.rows[0].birthday).toBe("1990-04-12");
  });

  it("reports a row with no name", () => {
    const r = parseClientImport("Name,Phone\n,082 123 4567");
    expect(r.rows).toHaveLength(0);
    expect(r.errors[0]).toMatch(/row 2/i);
  });

  it("reports a phone number that is too short", () => {
    const r = parseClientImport("Name,Phone\nThandi,12");
    expect(r.errors[0]).toMatch(/phone/i);
  });

  it("flags duplicate phone numbers inside the file", () => {
    const r = parseClientImport("Name,Phone\nA,0821234567\nB,0821234567");
    expect(r.errors.some((e) => /duplicate/i.test(e))).toBe(true);
  });

  it("complains when the name column is missing entirely", () => {
    const r = parseClientImport("Phone\n0821234567");
    expect(r.errors[0]).toMatch(/name/i);
  });
});

describe("checking a MySalon backup file", () => {
  /** The first bytes of a real SQL Server .bak: the MTF "TAPE" descriptor. */
  function fakeBak(): Uint8Array {
    const bytes = new Uint8Array(1024);
    const write = (text: string, at: number) => {
      for (let i = 0; i < text.length; i += 1) bytes[at + i] = text.charCodeAt(i);
    };
    write("TAPE", 0);
    // SQL Server writes this marker as UTF-16.
    const marker = "Microsoft SQL Server";
    for (let i = 0; i < marker.length; i += 1) bytes[120 + i * 2] = marker.charCodeAt(i);
    return bytes;
  }

  it("recognises a SQL Server backup", () => {
    const r = describeBackup(fakeBak(), "MySalon.bak", 147875328);
    expect(r.valid).toBe(true);
    expect(r.summary).toMatch(/SQL Server/i);
  });

  it("rejects a file that is not a backup", () => {
    const r = describeBackup(new TextEncoder().encode("hello world"), "notes.txt", 11);
    expect(r.valid).toBe(false);
    expect(r.summary).toMatch(/not a SQL Server backup/i);
  });

  it("reports the file size in a readable form", () => {
    const r = describeBackup(fakeBak(), "MySalon.bak", 147875328);
    expect(r.sizeLabel).toBe("141 MB");
  });

  it("rejects an empty file", () => {
    expect(describeBackup(new Uint8Array(0), "empty.bak", 0).valid).toBe(false);
  });
});
