import metaJson from "@/data/meta.json";
import staffJson from "@/data/staff.json";
import servicesJson from "@/data/services.json";
import productsJson from "@/data/products.json";
import clientsJson from "@/data/clients.json";
import demodayJson from "@/data/demoday.json";
import analyticsJson from "@/data/analytics.json";

import type {
  Analytics,
  Client,
  DemoDay,
  Meta,
  ProductData,
  Service,
  Staff,
  Visit,
} from "./types";

export const meta = metaJson as Meta;
export const staff = staffJson as Staff[];
export const services = servicesJson as Service[];
export const products = productsJson as ProductData;
export const clients = clientsJson as Client[];
export const demoday = demodayJson as DemoDay;
export const analytics = analyticsJson as Analytics;

// ------------------------------------------------------------------ indexes

const staffById = new Map(staff.map((s) => [s.id, s]));
const clientById = new Map(clients.map((c) => [c.id, c]));

export function getStaff(id: number | null | undefined): Staff | undefined {
  return id == null ? undefined : staffById.get(id);
}

export function staffName(id: number | null | undefined, fallback = "—"): string {
  return getStaff(id)?.name ?? fallback;
}

export function getClient(id: number | null | undefined): Client | undefined {
  return id == null ? undefined : clientById.get(id);
}

/** Stylists and assistants who appear on the appointment diary. */
export const diaryStaff = staff
  .filter((s) => s.role === "stylist")
  .sort((a, b) => b.totalRevenue - a.totalRevenue);

export const earningStylists = staff
  .filter((s) => s.role === "stylist" && s.totalRevenue > 0)
  .sort((a, b) => b.totalRevenue - a.totalRevenue);

export const serviceDepts = [...new Set(services.map((s) => s.dept))].sort();

export function servicesInDept(dept: string): Service[] {
  return services.filter((s) => s.dept === dept);
}

/** Visit history ships separately so it stays out of the main bundle. */
export async function loadVisits(clientId: number): Promise<Visit[]> {
  const all = (await import("@/data/visits.json")).default as Record<string, Visit[]>;
  return all[String(clientId)] ?? [];
}

// -------------------------------------------------------------- derivations

export const lapsedClients = clients
  .filter((c) => c.lapsed)
  .sort((a, b) => b.lifetimeSpend - a.lifetimeSpend);

export const vipClients = clients
  .filter((c) => c.vip)
  .sort((a, b) => b.lifetimeSpend - a.lifetimeSpend);

/** Clients whose (shifted) birthday falls in the demo month. */
export const birthdayClients = clients.filter((c) => {
  if (!c.birthday) return false;
  return c.birthday.slice(5, 7) === meta.demoDate.slice(5, 7);
});

export const lowStockItems = [...products.retail, ...products.backbar]
  .filter((p) => p.lowStock || p.needsCount)
  .sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name));

export const retailValueOnHand = products.retail
  .filter((p) => p.qty > 0)
  .reduce((sum, p) => sum + p.qty * p.cost, 0);

export const backbarValueOnHand = products.backbar
  .filter((p) => p.qty > 0)
  .reduce((sum, p) => sum + p.qty * p.cost, 0);
