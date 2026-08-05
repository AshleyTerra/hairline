const ZAR = new Intl.NumberFormat("en-ZA", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const ZAR0 = new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 0 });

/** R 1 234.56 */
export function zar(value: number): string {
  return `R ${ZAR.format(value ?? 0)}`;
}

/** R 1 235 — for dashboard tiles where cents are noise. */
export function zar0(value: number): string {
  return `R ${ZAR0.format(Math.round(value ?? 0))}`;
}

/** R 1.2m / R 845k / R 620 — for axis labels and dense tiles. */
export function zarCompact(value: number): string {
  const v = value ?? 0;
  if (Math.abs(v) >= 1_000_000) return `R ${(v / 1_000_000).toFixed(1)}m`;
  if (Math.abs(v) >= 1_000) return `R ${Math.round(v / 1_000)}k`;
  return `R ${Math.round(v)}`;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function parse(iso: string): Date {
  return new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
}

/** 4 Jul 2026 */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = parse(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Saturday, 4 July 2026 */
export function longDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = parse(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const month = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ][d.getUTCMonth()];
  return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${month} ${d.getUTCFullYear()}`;
}

/** Jul 25 — for month-series axis labels ("2025-07"). */
export function monthLabel(ym: string): string {
  const [y, m] = String(ym).split("-");
  return `${MONTHS[Number(m) - 1]} ${String(y).slice(2)}`;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parse(to).getTime() - parse(from).getTime()) / 86_400_000);
}

/** "3 days ago" / "5 months ago" relative to the demo date. */
export function relativeToDemo(iso: string | null, demoDate: string): string {
  if (!iso) return "never";
  const days = daysBetween(iso, demoDate);
  // A handful of visits fall in the few days after the demo trading day; read
  // those as "today" rather than the nonsensical "upcoming".
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 31) return `${days} days ago`;
  const months = Math.round(days / 30.44);
  if (months < 24) return `${months} month${months === 1 ? "" : "s"} ago`;
  return `${Math.round(days / 365.25)} years ago`;
}

/** 082 123 4567 */
export function phone(value: string | null | undefined): string {
  if (!value) return "—";
  const digits = String(value).replace(/\D/g, "");
  if (digits.length === 10) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  return String(value);
}

export function initials(name: string): string {
  return String(name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function pct(value: number, digits = 0): string {
  return `${(value ?? 0).toFixed(digits)}%`;
}
