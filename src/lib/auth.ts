import type { Role } from "./types";

/**
 * Sign-in for the prototype.
 *
 * This is a demonstration gate, not real security: the app is a static site with
 * no server, so these credentials are part of the page the browser downloads.
 * It keeps the demo link away from casual visitors and lets the owner see each
 * role exactly as that person would. Real authentication belongs on the server
 * in the production build.
 */

export interface DemoAccount {
  username: string;
  password: string;
  role: Role;
  /** Which staff member a stylist account is signed in as. */
  staffId?: number;
  displayName: string;
  description: string;
}

export interface SignedInUser {
  username: string;
  role: Role;
  staffId?: number;
  displayName: string;
}

const SHARED_PASSWORD = "hairline2026";

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    username: "owner",
    password: SHARED_PASSWORD,
    role: "owner",
    displayName: "Salon Owner",
    description: "Everything: takings, reports, costs, stock and the team",
  },
  {
    username: "reception",
    password: SHARED_PASSWORD,
    role: "reception",
    displayName: "Reception",
    description: "Till, clients, diary, stock and cash-up",
  },
  {
    username: "karin",
    password: SHARED_PASSWORD,
    role: "stylist",
    staffId: 1,
    displayName: "Karin M.",
    description: "A stylist's own day, figures and tips",
  },
  {
    username: "meagan",
    password: SHARED_PASSWORD,
    role: "stylist",
    staffId: 6,
    displayName: "Meagan V.",
    description: "A second stylist, to compare portfolios",
  },
];

/**
 * Returns the signed-in user, or null when the credentials do not match.
 * Usernames are forgiving about case and spacing; passwords are not.
 */
export function authenticate(username: string, password: string): SignedInUser | null {
  const name = String(username ?? "").trim().toLowerCase();
  if (!name || !password) return null;

  const account = DEMO_ACCOUNTS.find((a) => a.username === name);
  if (!account || account.password !== password) return null;

  // The password never travels with the session.
  return {
    username: account.username,
    role: account.role,
    staffId: account.staffId,
    displayName: account.displayName,
  };
}
