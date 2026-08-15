import { describe, expect, it } from "vitest";
import {
  DEFAULT_PERMISSIONS,
  SCREENS,
  SCREEN_KEYS,
  ABILITY_KEYS,
  canDo,
  DEFAULT_ABILITIES,
  reconcileAbilities,
  reconcilePermissions,
  toggleAbility,
  type Abilities,
  addUser,
  canAccess,
  defaultUsers,
  describeBackup,
  homeFor,
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

  it("lands each role on a screen it is actually allowed to open", () => {
    for (const role of ["owner", "reception", "stylist"] as const) {
      const href = homeFor(DEFAULT_PERMISSIONS, role);
      const screen = SCREENS.find((s) => s.href === href);
      expect(screen, `no screen for ${role} home ${href}`).toBeDefined();
      expect(canAccess(DEFAULT_PERMISSIONS, role, screen!.key)).toBe(true);
    }
  });

  it("sends reception to the till, not the dashboard they cannot open", () => {
    expect(homeFor(DEFAULT_PERMISSIONS, "reception")).toBe("/till");
  });

  it("falls back to the root when a role has no screens at all", () => {
    expect(homeFor({ ...DEFAULT_PERMISSIONS, stylist: [] }, "stylist")).toBe("/");
  });

  it("grants a newly added screen to roles whose defaults include it", () => {
    // A stored list written before "reports" existed.
    const stored = {
      owner: SCREENS.map((s) => s.key).filter((k) => k !== "reports"),
      reception: ["till", "clients"],
      stylist: ["dashboard"],
    };
    const known = stored.owner;
    const { permissions, added } = reconcilePermissions(stored, known);
    expect(added).toContain("reports");
    expect(canAccess(permissions, "owner", "reports")).toBe(true);
  });

  it("does not grant a new screen to a role whose defaults exclude it", () => {
    const stored = {
      owner: SCREENS.map((s) => s.key).filter((k) => k !== "reports"),
      reception: ["till", "clients"],
      stylist: ["dashboard"],
    };
    const { permissions } = reconcilePermissions(stored, stored.owner);
    // Reports are owner-only by default, so reception must not gain them.
    expect(canAccess(permissions, "reception", "reports")).toBe(false);
  });

  it("leaves deliberate choices alone", () => {
    const stored = {
      owner: SCREEN_KEYS.filter((k) => k !== "reports"),
      // The owner previously took Stock away from reception; that must stick.
      reception: ["till", "clients"],
      stylist: ["dashboard"],
    };
    const { permissions } = reconcilePermissions(stored, stored.owner);
    expect(canAccess(permissions, "reception", "stock")).toBe(false);
  });

  it("does nothing when nothing new has been added", () => {
    const { permissions, added } = reconcilePermissions(DEFAULT_PERMISSIONS, SCREEN_KEYS);
    expect(added).toEqual([]);
    expect(permissions).toBe(DEFAULT_PERMISSIONS);
  });

  it("reports the current screen list so it can be stored for next time", () => {
    const { knownKeys } = reconcilePermissions(DEFAULT_PERMISSIONS, ["till"]);
    expect(knownKeys).toEqual([...SCREEN_KEYS]);
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

describe("abilities — what a role may do, not just open", () => {
  it("gives the owner everything", () => {
    for (const a of ABILITY_KEYS) {
      expect(canDo(DEFAULT_ABILITIES, "owner", a)).toBe(true);
    }
  });

  it("lets reception price a line, because they work the counter", () => {
    expect(canDo(DEFAULT_ABILITIES, "reception", "costPrice")).toBe(true);
    expect(canDo(DEFAULT_ABILITIES, "reception", "priceOverride")).toBe(true);
  });

  it("withholds both from stylists", () => {
    expect(canDo(DEFAULT_ABILITIES, "stylist", "costPrice")).toBe(false);
    expect(canDo(DEFAULT_ABILITIES, "stylist", "priceOverride")).toBe(false);
  });

  it("says no to an ability nobody defined", () => {
    expect(canDo(DEFAULT_ABILITIES, "owner", "launchTheMissiles")).toBe(false);
  });

  it("toggles one ability without disturbing the others", () => {
    const next = toggleAbility(DEFAULT_ABILITIES, "reception", "costPrice");
    expect(canDo(next, "reception", "costPrice")).toBe(false);
    expect(canDo(next, "reception", "priceOverride")).toBe(true);
    expect(canDo(next, "owner", "costPrice")).toBe(true);
  });

  it("toggles back", () => {
    const off = toggleAbility(DEFAULT_ABILITIES, "reception", "costPrice");
    expect(canDo(toggleAbility(off, "reception", "costPrice"), "reception", "costPrice")).toBe(true);
  });

  it("never mutates what it was given", () => {
    const before = JSON.stringify(DEFAULT_ABILITIES);
    toggleAbility(DEFAULT_ABILITIES, "owner", "costPrice");
    expect(JSON.stringify(DEFAULT_ABILITIES)).toBe(before);
  });

  it("grants an ability added since the browser last saved, following the defaults", () => {
    const stored: Abilities = { owner: [], reception: [], stylist: [] };
    const { abilities, added } = reconcileAbilities(stored, []);
    expect(added).toEqual([...ABILITY_KEYS]);
    expect(canDo(abilities, "owner", "costPrice")).toBe(true);
    expect(canDo(abilities, "stylist", "costPrice")).toBe(false);
  });

  it("leaves a deliberate choice alone once the ability is known", () => {
    const stored: Abilities = { owner: ["costPrice"], reception: [], stylist: [] };
    const { abilities } = reconcileAbilities(stored, [...ABILITY_KEYS]);
    expect(canDo(abilities, "owner", "priceOverride")).toBe(false);
    expect(canDo(abilities, "reception", "costPrice")).toBe(false);
  });

  it("reports nothing added when everything is already known", () => {
    expect(reconcileAbilities(DEFAULT_ABILITIES, ABILITY_KEYS).added).toEqual([]);
  });
});
