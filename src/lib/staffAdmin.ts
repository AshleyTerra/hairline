/**
 * Staff administration: editing names, configurable designations, contact
 * details and an active/inactive status that never breaks past sales.
 */

export interface StaffRecord {
  /** Stable internal reference. Never the name — names change. */
  id: number;
  name: string;
  /** One of the configurable designations. */
  designation: string;
  email: string;
  tel: string;
  active: boolean;
}

export type StaffResult =
  | { ok: true; staff: StaffRecord[] }
  | { ok: false; error: string };

export type DesignationResult =
  | { ok: true; designations: string[]; staff: StaffRecord[] }
  | { ok: false; error: string };

/** Starting designations, matching how the salon already talks about roles. */
export const DEFAULT_DESIGNATIONS = [
  "Senior stylist",
  "Stylist",
  "Junior stylist",
  "Operator",
  "Apprentice",
  "Assistant",
  "Reception",
] as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** SA numbers: 10 digits locally, or +27 followed by 9. */
const TEL = /^(\+?27|0)\d{9}$/;

export function validateEmail(email: string): boolean {
  return email.trim() === "" || EMAIL.test(email.trim());
}

export function validateTel(tel: string): boolean {
  const digits = tel.replace(/[\s()-]/g, "");
  return digits === "" || TEL.test(digits);
}

/** Applies an edit, refusing anything that would leave a record unusable. */
export function editStaff(
  staff: readonly StaffRecord[],
  id: number,
  patch: Partial<Omit<StaffRecord, "id">>
): StaffResult {
  const target = staff.find((s) => s.id === id);
  if (!target) return { ok: false, error: "That staff member no longer exists." };

  const next = { ...target, ...patch };
  if (!String(next.name ?? "").trim()) {
    return { ok: false, error: "A staff member needs a name." };
  }
  if (!validateEmail(next.email)) {
    return { ok: false, error: `“${next.email}” does not look like an email address.` };
  }
  if (!validateTel(next.tel)) {
    return { ok: false, error: `“${next.tel}” does not look like a phone number.` };
  }

  return {
    ok: true,
    staff: staff.map((s) => (s.id === id ? { ...next, name: next.name.trim() } : s)),
  };
}

/** Adds a designation to the configurable list. */
export function addDesignation(
  designations: readonly string[],
  staff: readonly StaffRecord[],
  name: string
): DesignationResult {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Give the designation a name." };
  if (designations.some((d) => d.toLowerCase() === trimmed.toLowerCase())) {
    return { ok: false, error: `“${trimmed}” already exists.` };
  }
  return { ok: true, designations: [...designations, trimmed], staff: [...staff] };
}

/** Renames a designation, carrying every staff member on it across. */
export function renameDesignation(
  designations: readonly string[],
  staff: readonly StaffRecord[],
  from: string,
  to: string
): DesignationResult {
  const trimmed = to.trim();
  if (!trimmed) return { ok: false, error: "Give the designation a name." };
  if (!designations.includes(from)) return { ok: false, error: "That designation no longer exists." };
  if (
    trimmed.toLowerCase() !== from.toLowerCase() &&
    designations.some((d) => d.toLowerCase() === trimmed.toLowerCase())
  ) {
    return { ok: false, error: `“${trimmed}” already exists.` };
  }
  return {
    ok: true,
    designations: designations.map((d) => (d === from ? trimmed : d)),
    staff: staff.map((s) => (s.designation === from ? { ...s, designation: trimmed } : s)),
  };
}

/** Removes a designation, but never one still in use. */
export function removeDesignation(
  designations: readonly string[],
  staff: readonly StaffRecord[],
  name: string
): DesignationResult {
  const inUse = staff.filter((s) => s.designation === name);
  if (inUse.length > 0) {
    return {
      ok: false,
      error: `${inUse.length} staff member${inUse.length === 1 ? " is" : "s are"} still on “${name}”.`,
    };
  }
  return {
    ok: true,
    designations: designations.filter((d) => d !== name),
    staff: [...staff],
  };
}

/**
 * Turns a staff member on or off. Records are never deleted, because past sales
 * point at them.
 */
export function setActive(
  staff: readonly StaffRecord[],
  id: number,
  active: boolean
): StaffResult {
  if (!staff.some((s) => s.id === id)) {
    return { ok: false, error: "That staff member no longer exists." };
  }
  if (!active && staff.filter((s) => s.active).length === 1) {
    return { ok: false, error: "At least one staff member must stay active." };
  }
  return { ok: true, staff: staff.map((s) => (s.id === id ? { ...s, active } : s)) };
}

export const activeStaff = (staff: readonly StaffRecord[]): StaffRecord[] =>
  staff.filter((s) => s.active);
