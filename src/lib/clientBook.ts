/**
 * The client base as reception sees it.
 *
 * Eleven years of migrated files, plus anyone captured at the counter today.
 * The two used to live apart, which meant a client added mid-sale was written to
 * the browser and then never seen again — not in the client list, not in the
 * till's own search. Everything that looks a client up now goes through here, so
 * there is one directory and no way for a capture to fall out of it.
 */
import type { Client, NewClient } from "./types";

export type ClientKind = "service" | "walkin";

/** What the capture form collects, before it is checked. */
export interface ClientInput {
  name: string;
  tel: string;
  email: string;
  /** As typed: "1".."31", or empty. */
  birthDay: string;
  /** As typed: "1".."12", or empty. */
  birthMonth: string;
  notes: string;
}

export type ClientValidation =
  | { ok: true; client: Omit<NewClient, "id"> }
  | { ok: false; field: "name" | "tel" | "email" | "birthday"; error: string };

// --------------------------------------------------------------- mobile

/**
 * South African mobile numbers, stored the way the salon already writes them:
 * "076 408 9755". A landline is refused rather than quietly accepted — the
 * number exists so the salon can send a message, and 99.5% of the client base
 * has a mobile, so there is no reason to settle for less.
 */
export function normaliseMobile(raw: string): string | null {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.startsWith("27")) digits = "0" + digits.slice(2);
  if (digits.length !== 10) return null;
  if (!/^0[678]/.test(digits)) return null;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

/** Deliberately forgiving: one @, something either side, a dot in the domain. */
const looksLikeEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** "--MM-DD", the recurring-date form, so no meaningless year is invented. */
const monthDay = (month: number, day: number): string =>
  `--${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

// ----------------------------------------------------------- validation

/**
 * Checks a captured client. A service client needs enough on file to be worth
 * having — a name, a mobile to reach them on, an email and a birthday. A walk-in
 * is deliberately simpler: a name is enough, and the record is marked so nobody
 * later mistakes it for a complete file.
 */
export function validateClient(input: ClientInput, kind: ClientKind): ClientValidation {
  const name = String(input.name ?? "").trim();
  if (!name) {
    return { ok: false, field: "name", error: "A name is needed before the sale can be filed." };
  }

  const telRaw = String(input.tel ?? "").trim();
  const walkIn = kind === "walkin";

  let tel = "";
  if (telRaw) {
    const mobile = normaliseMobile(telRaw);
    if (!mobile) {
      return {
        ok: false,
        field: "tel",
        error: "That is not a mobile number we can send to. Try 076 408 9755 or +27 76 408 9755.",
      };
    }
    tel = mobile;
  } else if (!walkIn) {
    return { ok: false, field: "tel", error: "A mobile number is needed to reach this client." };
  }

  const email = String(input.email ?? "").trim().toLowerCase();
  if (!walkIn) {
    if (!email) {
      return { ok: false, field: "email", error: "An email address is needed for a client file." };
    }
    if (!looksLikeEmail(email)) {
      return { ok: false, field: "email", error: "That email address is missing something." };
    }
  } else if (email && !looksLikeEmail(email)) {
    return { ok: false, field: "email", error: "That email address is missing something." };
  }

  const day = Number(input.birthDay);
  const month = Number(input.birthMonth);
  const hasBirthday = String(input.birthDay ?? "") !== "" && String(input.birthMonth ?? "") !== "";

  let birthday = "";
  if (hasBirthday) {
    const valid =
      Number.isInteger(day) &&
      Number.isInteger(month) &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= DAYS_IN_MONTH[month - 1];
    if (!valid) {
      return { ok: false, field: "birthday", error: "That day and month is not a date." };
    }
    birthday = monthDay(month, day);
  } else if (!walkIn) {
    return {
      ok: false,
      field: "birthday",
      error: "A birthday is needed — the day and month, not the year.",
    };
  }

  return {
    ok: true,
    client: { name, tel, email, birthday, notes: String(input.notes ?? "").trim(), walkIn },
  };
}

// ---------------------------------------------------------------- the book

/** A captured client as a file: real details, and no history yet. */
export function asClient(added: NewClient): Client {
  const parts = added.name.trim().split(/\s+/);
  return {
    id: added.id,
    name: added.name,
    firstName: parts[0] ?? added.name,
    surname: parts.slice(1).join(" "),
    tel: added.tel,
    email: added.email || null,
    birthday: added.birthday || null,
    firstVisit: null,
    lastVisit: null,
    visitCount: 0,
    lifetimeSpend: 0,
    avgTicket: 0,
    prefStylistId: null,
    lapsed: false,
    vip: false,
    medical: null,
    notes: added.notes || null,
  };
}

/**
 * Everyone, newest capture first — reception has just typed that name in, so it
 * is the one they are about to look for.
 */
export function clientBook(
  migrated: readonly Client[],
  addedToday: readonly NewClient[]
): Client[] {
  const captured = [...addedToday].reverse().map(asClient);
  return [...captured, ...migrated];
}

export const findClient = (book: readonly Client[], id: number): Client | undefined =>
  book.find((c) => c.id === id);

/** Name or number, the two things reception has to hand. */
export function searchBook(book: readonly Client[], query: string, limit = 60): Client[] {
  const q = String(query ?? "").trim().toLowerCase();
  if (!q) return [];
  const digits = q.replace(/\D/g, "");
  return book
    .filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (digits.length >= 3 && c.tel.replace(/\D/g, "").includes(digits))
    )
    .slice(0, limit);
}

/**
 * The day and month of a birthday, from either form: "--MM-DD" as captured
 * here, or the migrated "YYYY-MM-DD" whose year means nothing.
 */
export function birthdayOf(birthday: string | null): { day: number; month: number } | null {
  if (!birthday) return null;
  const m = /^(?:\d{4}|-)?-(\d{2})-(\d{2})$/.exec(birthday);
  if (!m) return null;
  return { day: Number(m[2]), month: Number(m[1]) };
}
