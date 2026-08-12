import { DEMO_ACCOUNTS } from "./auth";
import { parseCsv } from "./csv";
import type { Role } from "./types";

// ------------------------------------------------------------------- users

export interface ManagedUser {
  username: string;
  displayName: string;
  role: Role;
  password: string;
  staffId?: number;
  /** Seeded demo accounts are marked so the interface can label them. */
  builtIn: boolean;
}

export interface NewUser {
  username: string;
  displayName: string;
  role: Role;
  password: string;
  staffId?: number;
}

export type Result =
  | { ok: true; users: ManagedUser[] }
  | { ok: false; error: string };

const USERNAME_PATTERN = /^[a-z0-9._-]+$/;
const MIN_PASSWORD = 8;

export function defaultUsers(): ManagedUser[] {
  return DEMO_ACCOUNTS.map((a) => ({
    username: a.username,
    displayName: a.displayName,
    role: a.role,
    password: a.password,
    staffId: a.staffId,
    builtIn: true,
  }));
}

const ownerCount = (users: readonly ManagedUser[]) =>
  users.filter((u) => u.role === "owner").length;

export function addUser(users: readonly ManagedUser[], input: NewUser): Result {
  const username = String(input.username ?? "").trim().toLowerCase();
  const displayName = String(input.displayName ?? "").trim();
  const password = String(input.password ?? "");

  if (!username) return { ok: false, error: "Give the user a username." };
  if (!USERNAME_PATTERN.test(username)) {
    return {
      ok: false,
      error: "Usernames can only use letters, numbers, dots, dashes and underscores.",
    };
  }
  if (!displayName) return { ok: false, error: "Give the user a display name." };
  if (password.length < MIN_PASSWORD) {
    return { ok: false, error: `Passwords need at least ${MIN_PASSWORD} characters.` };
  }
  if (users.some((u) => u.username === username)) {
    return { ok: false, error: `The username “${username}” is already taken.` };
  }

  return {
    ok: true,
    users: [
      ...users,
      { username, displayName, role: input.role, password, staffId: input.staffId, builtIn: false },
    ],
  };
}

export function removeUser(users: readonly ManagedUser[], username: string): Result {
  const target = users.find((u) => u.username === username);
  if (!target) return { ok: false, error: "That user no longer exists." };
  if (target.role === "owner" && ownerCount(users) === 1) {
    return { ok: false, error: "You cannot remove the last owner — someone must keep the keys." };
  }
  return { ok: true, users: users.filter((u) => u.username !== username) };
}

export function setUserRole(
  users: readonly ManagedUser[],
  username: string,
  role: Role
): Result {
  const target = users.find((u) => u.username === username);
  if (!target) return { ok: false, error: "That user no longer exists." };
  if (target.role === "owner" && role !== "owner" && ownerCount(users) === 1) {
    return { ok: false, error: "You cannot change the last owner's role." };
  }
  return {
    ok: true,
    users: users.map((u) => (u.username === username ? { ...u, role } : u)),
  };
}

export function setUserPassword(
  users: readonly ManagedUser[],
  username: string,
  password: string
): Result {
  if (String(password).length < MIN_PASSWORD) {
    return { ok: false, error: `Passwords need at least ${MIN_PASSWORD} characters.` };
  }
  if (!users.some((u) => u.username === username)) {
    return { ok: false, error: "That user no longer exists." };
  }
  return {
    ok: true,
    users: users.map((u) => (u.username === username ? { ...u, password } : u)),
  };
}

// ------------------------------------------------------------- permissions

export interface ScreenDef {
  key: string;
  label: string;
  href: string;
  description: string;
}

export const SCREENS: readonly ScreenDef[] = [
  { key: "dashboard", label: "Dashboard", href: "/", description: "Takings, trends and alerts" },
  { key: "till", label: "Till", href: "/till", description: "Ring up sales and take payment" },
  { key: "clients", label: "Clients", href: "/clients", description: "Client files and history" },
  { key: "diary", label: "Diary", href: "/diary", description: "Appointments by stylist" },
  { key: "stock", label: "Stock", href: "/stock", description: "Retail, back bar and ordering" },
  { key: "staff", label: "Team", href: "/staff", description: "Staff profiles and portfolios" },
  { key: "cashup", label: "Cash-up", href: "/cashup", description: "Count the drawer, close the day" },
  {
    key: "pricing",
    label: "Price menu",
    href: "/pricing",
    description: "Service and retail pricing, and the printed client menu",
  },
  {
    key: "reports",
    label: "Reports",
    href: "/reports",
    description: "Staff turnover and sales reports, printable or to Excel",
  },
  { key: "admin", label: "Admin", href: "/admin", description: "Users, data and imports" },
];

export type Permissions = Record<Role, string[]>;

export const DEFAULT_PERMISSIONS: Permissions = {
  owner: SCREENS.map((s) => s.key),
  // Reports carry wage figures, so they stay with the owner by default.
  reception: ["till", "clients", "diary", "stock", "cashup", "pricing", "admin"],
  stylist: ["dashboard", "clients", "diary"],
};

/** The owner must never be able to lock themselves out of Admin. */
const LOCKED: { role: Role; screen: string }[] = [{ role: "owner", screen: "admin" }];

export function canAccess(perms: Permissions, role: Role, screen: string): boolean {
  return (perms[role] ?? []).includes(screen);
}

export function togglePermission(perms: Permissions, role: Role, screen: string): Permissions {
  if (LOCKED.some((l) => l.role === role && l.screen === screen)) return perms;
  const current = perms[role] ?? [];
  const next = current.includes(screen)
    ? current.filter((s) => s !== screen)
    : [...current, screen];
  return { ...perms, [role]: next };
}

export function isLocked(role: Role, screen: string): boolean {
  return LOCKED.some((l) => l.role === role && l.screen === screen);
}

/**
 * Where a role should land. Reception has no dashboard, so sending everyone to
 * "/" would drop them on a screen their own role forbids.
 */
export function homeFor(perms: Permissions, role: Role): string {
  return SCREENS.find((s) => canAccess(perms, role, s.key))?.href ?? "/";
}

// ---------------------------------------------------------- client import

export interface ImportedClient {
  name: string;
  tel: string;
  email: string;
  birthday: string;
  notes: string;
}

export interface ClientImportResult {
  rows: ImportedClient[];
  errors: string[];
}

/** Header spellings a salon is likely to have in an exported spreadsheet. */
const HEADERS: Record<keyof ImportedClient, string[]> = {
  name: ["name", "client name", "client", "full name", "customer"],
  tel: ["phone", "cell", "cellphone", "mobile", "tel", "telephone", "contact", "phone number"],
  email: ["email", "e-mail", "email address"],
  birthday: ["birthday", "birth date", "birthdate", "dob", "date of birth"],
  notes: ["notes", "note", "comments"],
};

function findHeader(headers: string[], candidates: string[]): string | null {
  const lower = headers.map((h) => h.toLowerCase());
  for (const candidate of candidates) {
    const i = lower.indexOf(candidate);
    if (i !== -1) return headers[i];
  }
  return null;
}

export function parseClientImport(text: string): ClientImportResult {
  const raw = parseCsv(text);
  const errors: string[] = [];

  if (raw.length === 0) {
    return { rows: [], errors: ["That file has no rows under its header."] };
  }

  const headers = Object.keys(raw[0]);
  const map = {
    name: findHeader(headers, HEADERS.name),
    tel: findHeader(headers, HEADERS.tel),
    email: findHeader(headers, HEADERS.email),
    birthday: findHeader(headers, HEADERS.birthday),
    notes: findHeader(headers, HEADERS.notes),
  };

  if (!map.name) {
    return {
      rows: [],
      errors: [
        "No name column found. Add a column called Name (or Client Name) and try again.",
      ],
    };
  }

  const rows: ImportedClient[] = [];
  const seenPhones = new Map<string, number>();

  raw.forEach((record, i) => {
    const line = i + 2; // header is row 1
    const name = (map.name ? record[map.name] : "").trim();
    const tel = (map.tel ? record[map.tel] : "").trim();

    if (!name) {
      errors.push(`Row ${line}: no client name, so the row was skipped.`);
      return;
    }

    const digits = tel.replace(/\D/g, "");
    if (tel && digits.length < 9) {
      errors.push(`Row ${line} (${name}): “${tel}” is too short to be a phone number.`);
      return;
    }
    if (digits) {
      const first = seenPhones.get(digits);
      if (first !== undefined) {
        errors.push(`Row ${line} (${name}): duplicate phone number, already used on row ${first}.`);
        return;
      }
      seenPhones.set(digits, line);
    }

    rows.push({
      name,
      tel,
      email: (map.email ? record[map.email] : "").trim(),
      birthday: (map.birthday ? record[map.birthday] : "").trim(),
      notes: (map.notes ? record[map.notes] : "").trim(),
    });
  });

  return { rows, errors };
}

// --------------------------------------------------------- backup checking

export interface BackupCheck {
  valid: boolean;
  summary: string;
  sizeLabel: string;
  detail: string[];
}

function humanSize(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} bytes`;
}

/**
 * Inspects the first bytes of an uploaded file to confirm it really is a SQL
 * Server backup. A genuine .bak opens with the Microsoft Tape Format "TAPE"
 * descriptor and carries a UTF-16 "Microsoft SQL Server" marker soon after.
 */
export function describeBackup(head: Uint8Array, filename: string, size: number): BackupCheck {
  const sizeLabel = humanSize(size);

  if (head.length === 0) {
    return { valid: false, summary: "That file is empty.", sizeLabel, detail: [] };
  }

  const ascii = String.fromCharCode(...head.slice(0, 4));
  const hasTape = ascii === "TAPE";

  // The marker is UTF-16, so every second byte is zero.
  let utf16 = "";
  for (let i = 0; i < head.length; i += 2) {
    const code = head[i];
    utf16 += code >= 32 && code < 127 ? String.fromCharCode(code) : " ";
  }
  const hasMarker = utf16.includes("Microsoft SQL Server");

  if (!hasTape) {
    return {
      valid: false,
      summary: `“${filename}” is not a SQL Server backup — it does not start with the expected header.`,
      sizeLabel,
      detail: ["Export a fresh backup from MySalon and upload the .bak file it produces."],
    };
  }

  return {
    valid: true,
    summary: `“${filename}” looks like a valid Microsoft SQL Server backup.`,
    sizeLabel,
    detail: [
      `Tape header found${hasMarker ? " with the SQL Server marker" : ""}.`,
      `File size ${sizeLabel}.`,
    ],
  };
}
