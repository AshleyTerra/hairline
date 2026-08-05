# Hairline Prototype + Presentation Deck Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Vercel-deployable, Hairline-branded clickable prototype of Salon Manager loaded with real (client-pseudonymized) MySalon data — interactive till, browsable dashboard/clients/stock/staff/diary/cash-up/pricing — plus a branded HTML presentation deck served at `/deck`.

**Architecture:** Next.js (App Router, TypeScript, Tailwind v4) at the repo root, no backend: all data is static JSON generated once from the restored MySalon LocalDB by an extraction script (SQL → raw JSON in scratchpad, never committed) and a transform script (pseudonymize + shape → `src/data/*.json`, committed). Interactive till state lives in a pure, unit-tested reducer with localStorage persistence so the owner's play-invoices survive refresh. The deck is a standalone static HTML file in `public/deck/`.

**Tech Stack:** Next.js 15 + React 19 + TypeScript, Tailwind CSS v4, Vitest (till money logic), sqlcmd (LocalDB `(localdb)\MySalonRestore`, DB `MySalon`), Node script for transform. Charts = hand-rolled inline SVG (load `dataviz` skill first). Deck built with `frontend-slides` skill.

**Privacy invariants (apply to every task):**
- Raw extracts with real client PII stay in the scratchpad (`C:\temp\claude\...\scratchpad\extract\`) and are NEVER committed.
- Committed JSON contains: real services, prices, stock, revenue, staff first names + surname initial, real visit *patterns*; client names/phones/emails/notes replaced deterministically (seeded) with realistic South African stand-ins; birthdays shifted ±14 days; medical notes replaced with generic samples.
- `.gitignore` gets `*.raw.json` belt-and-braces.

**Demo-day concept:** the transform picks the busiest recent full trading day in the data as `meta.demoDate`. The app presents that day as "Today" (dashboard takings, till session, diary bookings synthesized from that day's real invoice patterns, cash-up sheet). All history keeps true dates.

---

## File structure (target)

```
/ (repo root = Next.js app)
├─ package.json / next.config.ts / tsconfig.json / postcss.config.mjs
├─ vitest.config.ts
├─ README.md                        # run + Vercel deploy steps
├─ public/
│  ├─ logo.png                      # from "hairline 2026/HAIRLINE LOGO/Hairline Logo - Transparent.png"
│  └─ deck/index.html               # presentation (Task 15)
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx                 # brand shell: sidebar nav, role switcher, fonts, metadata
│  │  ├─ globals.css                # design tokens (taupe/ink palette), Tailwind v4 @theme
│  │  ├─ page.tsx                   # Dashboard (owner)
│  │  ├─ till/page.tsx              # Interactive checkout
│  │  ├─ clients/page.tsx           # Search + list
│  │  ├─ clients/[id]/page.tsx      # Client file: history timeline, notes, flags
│  │  ├─ stock/page.tsx             # Retail | Back-bar | Reorder tabs
│  │  ├─ staff/page.tsx             # Team grid
│  │  ├─ staff/[id]/page.tsx        # Stylist portfolio: performance, tips, clock
│  │  ├─ diary/page.tsx             # Week view per stylist
│  │  ├─ cashup/page.tsx            # Denomination counter + day totals
│  │  └─ pricing/page.tsx           # Service menu + printable price list view
│  ├─ components/                   # one file per component, focused
│  │  ├─ Nav.tsx  RoleSwitcher.tsx  StatCard.tsx  Money.tsx
│  │  ├─ RevenueChart.tsx  Sparkline.tsx  (SVG, dataviz-skill-compliant)
│  │  ├─ ClientPicker.tsx  LineItemRow.tsx  PaymentPanel.tsx  TipDialog.tsx
│  │  └─ DenomCounter.tsx  DiaryGrid.tsx  HistoryTimeline.tsx
│  ├─ lib/
│  │  ├─ types.ts                   # all shared types
│  │  ├─ till.ts                    # PURE money logic (reducer + selectors) — unit tested
│  │  ├─ till.test.ts
│  │  ├─ store.tsx                  # React context: role, till state, localStorage persistence
│  │  ├─ data.ts                    # typed loaders over src/data/*.json
│  │  └─ format.ts                  # ZAR money, date, phone formatting
│  └─ data/                         # GENERATED, pseudonymized, committed
│     ├─ meta.json  staff.json  services.json  products.json
│     ├─ clients.json               # ~750 most recently active, each with visit history
│     ├─ demoday.json               # invoices of demo day + diary bookings + cashup seed
│     └─ analytics.json             # revenue by year/month, KPIs, top services/stylists
├─ tools/
│  ├─ extract.ps1                   # sqlcmd → scratchpad *.raw.json (PII, never committed)
│  └─ transform.mjs                 # raw → pseudonymized src/data/*.json (seeded RNG)
└─ docs/                            # existing spec/plan + Word doc (unchanged)
```

---

### Task 1: Scaffold Next.js app at repo root

**Files:** Create: `package.json`, `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `src/app/*` (via create-next-app), modify `.gitignore`.

- [ ] **Step 1:** From a temp dir run `npx create-next-app@latest hairline-app --ts --tailwind --eslint --app --src-dir --no-import-alias --use-npm --skip-install`, then move generated files into the repo root (keep existing `docs/`, `.git/`, `.gitignore` — merge ignore entries: `node_modules/`, `.next/`, `out/`, `*.raw.json`, `.vercel`).
- [ ] **Step 2:** `npm install` then `npm run build`. Expected: build succeeds with default page.
- [ ] **Step 3:** `npm install -D vitest @vitejs/plugin-react` and add `"test": "vitest run"` script.
- [ ] **Step 4:** Commit `chore: scaffold Next.js prototype app`.

### Task 2: Brand foundation (tokens, shell, role switcher)

**Files:** Create: `src/app/globals.css` (replace), `src/app/layout.tsx` (replace), `src/components/Nav.tsx`, `src/components/RoleSwitcher.tsx`, `src/lib/store.tsx`, `public/logo.png`.

- [ ] **Step 1:** Copy `hairline 2026/HAIRLINE LOGO/Hairline Logo - Transparent.png` → `public/logo.png`.
- [ ] **Step 2:** `globals.css` — Tailwind v4 `@theme` tokens mirroring the approved plan-page palette:

```css
@import "tailwindcss";
@theme {
  --color-taupe: #8A7F6F; --color-taupe-deep: #6E6455;
  --color-ink: #1A1816; --color-body: #3A362F; --color-mutedink: #7A7264;
  --color-paper: #FAF9F7; --color-card: #FFFFFF;
  --color-hairline: #E2DED7; --color-hairline-soft: #EDEAE4; --color-chip: #F1EEE8;
  --color-good: #4C7A5A; --color-warn: #A8762A; --color-crit: #A0433A;
  --font-sans: "Segoe UI", system-ui, sans-serif;
}
body { background: var(--color-paper); color: var(--color-body); }
```

(Light theme only — a deliberate choice for the demo; the salon till runs in a bright room.)
- [ ] **Step 3:** `store.tsx`: context providing `{ role, setRole, invoices, addInvoice }` — role ∈ `owner|reception|stylist`; play-invoices persisted to `localStorage("hairline-demo-invoices")`; hydrate-safe (read localStorage in `useEffect`).
- [ ] **Step 4:** `layout.tsx` + `Nav.tsx`: left sidebar (desktop) / bottom bar (mobile) with wordmark (logo.png), links: Dashboard, Till, Clients, Diary, Stock, Staff, Cash-up, Pricing; `RoleSwitcher.tsx` = segmented control in the top bar; nav items filter by role (Owner: all; Reception: Till/Clients/Diary/Stock/Cash-up; Stylist: Dashboard[own]/Diary/Clients-readonly). Demo banner strip: "Prototype — demo data, client names anonymised".
- [ ] **Step 5:** `npm run build` passes → commit `feat: brand shell, tokens, role switcher`.

### Task 3: Extract real data from LocalDB (raw, uncommitted)

**Files:** Create: `tools/extract.ps1`. Output: `<scratchpad>\extract\*.raw.json`.

- [ ] **Step 1:** Write `tools/extract.ps1` — for each query below run `sqlcmd -S "(localdb)\MySalonRestore" -d MySalon -y 0 -Q "<SQL> FOR JSON PATH" -o <out>` (files: staff, services, products, clients, invoices13m, analytics-year, analytics-month, demoday-candidates, cashup-recent, tips-12m, subs-12m, clock-recent):

```sql
-- staff.raw.json
SELECT StylistID id, FirstName firstName, Surname surname, CommencementDate startDate,
       IsReceptionst isReception FROM Stylists WHERE Active=1
-- services.raw.json (ServiceType 'S')
SELECT StockID id, DeptID deptId, Description name, RSP price, Cost cost, AppMins mins
FROM Stock WHERE ServiceType='S' AND RSP > 0
-- products.raw.json ('R' retail / 'Stock Item' back-bar)
SELECT StockID id, DeptID deptId, Description name, Vendor vendor, ServiceType kind,
       Cost cost, RSP price, QtyOnHand qty, ReorderLevel reorder, Barcode barcode, ml
FROM Stock WHERE ServiceType IN ('R','Stock Item')
-- clients.raw.json: 750 most recently active with real names (pseudonymized later)
SELECT TOP 750 c.ClientID id, c.FirstName fn, c.Surname sn, c.Tel1 tel, c.Email email,
       c.BirthDate bday, c.FirstVisit firstVisit, c.StylistID prefStylist, c.Notes notes,
       c.MedicalCondition med, x.lastVisit, x.visitCount, x.lifetimeSpend
FROM Clients c JOIN (SELECT ClientID, MAX([Date]) lastVisit, COUNT(*) visitCount,
       SUM(Total) lifetimeSpend FROM Invoices GROUP BY ClientID) x ON x.ClientID=c.ClientID
WHERE c.Active=1 ORDER BY x.lastVisit DESC
-- invoices13m.raw.json: line-level history for those clients, last 13 months
SELECT i.InvoiceID id, i.ClientID clientId, i.[Date] date, i.Total total,
       i.PaidCash cash, i.PaidCard card, i.PaidEFT eft, i.PaidToPay toPay, i.PaidVoucher voucher,
       ii.Item item, ii.Description descr, ii.Price price, ii.Qty qty, ii.Disc disc,
       ii.StylistID stylistId, ii.ServiceType kind
FROM Invoices i JOIN InvoiceItems ii ON ii.InvoiceID=i.InvoiceID
WHERE i.[Date] >= DATEADD(month,-13,(SELECT MAX([Date]) FROM Invoices))
-- analytics: revenue by year; by month (last 24m); top services/products 12m; per-stylist 12m
-- demo day: busiest day in last 60 full days:
SELECT TOP 1 CAST([Date] AS date) d, COUNT(*) n, SUM(Total) t FROM Invoices
WHERE [Date] < CAST(GETDATE() AS date) GROUP BY CAST([Date] AS date) ORDER BY t DESC
-- cashup-recent: last 30 Cashup rows; tips/subs last 12m per stylist; clock last 14 days
```

- [ ] **Step 2:** Run it. Verify each file is non-empty valid JSON (`node -e "JSON.parse(...)"` loop) and spot-check counts (services ≈ 100–200, clients = 750).

### Task 4: Transform + pseudonymize → committed JSON

**Files:** Create: `tools/transform.mjs`. Output: `src/data/*.json` (committed).

- [ ] **Step 1:** Write `tools/transform.mjs` (Node, no deps):
  - Seeded mulberry32 RNG (seed 20260805) → deterministic output.
  - Name pools (~120 SA-appropriate first names, ~120 surnames incl. Afrikaans/Zulu/Indian/English mix); `pseudo(clientId)` picks stable fake first+surname; collisions get surname letter suffix. Phones → `07x xxx xxxx` from RNG; emails → `first.sur@example.co.za`; birthdays shift ±14d; notes → pick from 12 generic salon note templates ("Prefers 20vol on regrowth", "Allergic — patch test before colour", …) only where source had a note/medical flag.
  - Staff → `{ id, name: "First S.", role: reception?"reception":"stylist" }` + attach 12m revenue/tips/subs aggregates + recent clock pairs (re-dated so latest day = demoDate).
  - Services grouped by department (Depts 1–8 map: General/Colour/Perm/Treatments/Brazilian/Extensions/MK Straighteners/Wella Straight); prune inactive-priced duplicates (keep highest StockID per identical name).
  - Products: split `retail` vs `backbar` by kind; compute `lowStock = qty <= reorder`.
  - Clients: merge invoice lines → per-client `visits[]` (date, stylist, lines, total) capped at 40 most recent; keep KPIs (lastVisit, visitCount, lifetimeSpend, avgTicket); `lapsed = lastVisit > 90d before demoDate`.
  - Demo day: that day's invoices → `demoday.json` `{ date, invoices[], bookings[] }` — bookings synthesized: for each demo-day invoice, a diary slot at its real time with its client, stylist, main service, duration from `mins||45`; cashup seed from real day totals.
  - Analytics: revenue by year (2015–2026), by month (24m), top 10 services + products by 12m revenue, per-stylist 12m totals, KPI block (avg ticket, visits/client/yr, retail % of revenue).
  - HARD CHECK in script: output must contain none of the top-200 real client surnames (assert), else exit 1.
- [ ] **Step 2:** Run `node tools/transform.mjs`. Verify: every file parses; `clients.json` names differ from raw; totals in `analytics.json` match the Task 3 SQL yearly numbers (2025 ≈ R7,525,091).
- [ ] **Step 3:** Commit `feat: pseudonymized demo dataset generated from MySalon` (src/data only — confirm `git status` shows no *.raw.json).

### Task 5: Types, loaders, formatting

**Files:** Create: `src/lib/types.ts`, `src/lib/data.ts`, `src/lib/format.ts`.

- [ ] **Step 1:** `types.ts` — `Staff`, `Service`, `Product`, `Client`, `Visit`, `VisitLine`, `DemoInvoice`, `Booking`, `Analytics`, `TillLine`, `TillState`, `Payment` (`method: 'cash'|'card'|'eft'|'topay'|'voucher'`, `amount`), `Role`. Exact shapes = whatever Task 4 emits (single source of truth; loaders typed against these).
- [ ] **Step 2:** `data.ts` — `import` each JSON with `as` typed exports + tiny index helpers (`clientById`, `staffById`, `servicesByDept`). `format.ts` — `zar(n)` (`R 1 234.56`), `shortDate`, `relDate(demoDate)`, `phone`.
- [ ] **Step 3:** `npm run build` passes → commit `feat: typed data layer`.

### Task 6: Till money logic — TDD

**Files:** Create: `src/lib/till.test.ts` then `src/lib/till.ts`, `vitest.config.ts`.

- [ ] **Step 1 (RED):** Write tests first:

```ts
import { describe, it, expect } from "vitest";
import { emptyTill, tillReduce, totals } from "./till";
// helpers: line(price, qty=1, discPct=0)
describe("till totals", () => {
  it("sums lines with qty and % discount", () => {
    let s = tillReduce(emptyTill(), { type: "add", line: line(350) });
    s = tillReduce(s, { type: "add", line: line(180, 2, 50) });
    expect(totals(s).subtotal).toBe(350 + 180 * 2 * 0.5);
  });
  it("VAT is 15/115 of inclusive total", () => {
    const s = tillReduce(emptyTill(), { type: "add", line: line(115) });
    expect(totals(s).vat).toBeCloseTo(15, 2);
  });
  it("split payments must cover total; change from cash only", () => {
    let s = tillReduce(emptyTill(), { type: "add", line: line(500) });
    s = tillReduce(s, { type: "pay", payment: { method: "card", amount: 300 } });
    s = tillReduce(s, { type: "pay", payment: { method: "cash", amount: 250 } });
    const t = totals(s);
    expect(t.paid).toBe(550); expect(t.change).toBe(50); expect(t.balance).toBe(0);
  });
  it("voucher redemption cannot exceed total", () => {
    let s = tillReduce(emptyTill(), { type: "add", line: line(200) });
    s = tillReduce(s, { type: "pay", payment: { method: "voucher", amount: 500 } });
    expect(totals(s).paid).toBe(200); // clamped
  });
  it("tip is tracked per stylist and excluded from invoice total", () => {
    let s = tillReduce(emptyTill(), { type: "add", line: line(300) });
    s = tillReduce(s, { type: "tip", stylistId: 7, amount: 40 });
    expect(totals(s).subtotal).toBe(300); expect(s.tips).toEqual([{ stylistId: 7, amount: 40 }]);
  });
  it("remove line and clear reset correctly", () => { /* add 2, remove 1, assert; clear → emptyTill */ });
});
```

- [ ] **Step 2:** `npm test` → expect FAIL (till.ts missing).
- [ ] **Step 3 (GREEN):** Implement `till.ts` — immutable reducer (`add|remove|setDisc|pay|unpay|tip|clear`), `totals()` selector returning `{ subtotal, vat, paid, balance, change }`; voucher/eft/card clamp to outstanding balance, cash may overpay → change; all arithmetic in cents internally.
- [ ] **Step 4:** `npm test` → PASS. **Step 5:** Commit `feat: till money logic (TDD)`.

### Task 7: Interactive Till screen

**Files:** Create: `src/app/till/page.tsx`, `src/components/ClientPicker.tsx`, `LineItemRow.tsx`, `PaymentPanel.tsx`, `TipDialog.tsx`.

- [ ] **Step 1:** Layout (desktop: 2 columns; mobile: stacked): LEFT = client picker (type-ahead over clients.json; walk-in default) + service quick-grid grouped by department + retail search-by-name/barcode. Each added line: description, stylist select (defaults to client's preferred), qty, % disc, price. RIGHT = running total card (subtotal/VAT/lines), tip button (per-stylist amounts), payment panel: method buttons enter amounts (cash keypad with note shortcuts 50/100/200), split visible, balance/change live, big "Complete Sale — R x" button disabled until balance ≤ 0.
- [ ] **Step 2:** On complete: `addInvoice` to store (localStorage), toast "Invoice #N saved — 00:23", reset till, stopwatch chip in header shows seconds since first line (proves the ≤30s target playfully).
- [ ] **Step 3:** Wire demo-day invoices + play-invoices into "Today so far" mini-strip on the till.
- [ ] **Step 4:** Manual check (`npm run dev`): full sale in <30s with keyboard+mouse; split payment; voucher clamp; tip. Build passes. Commit `feat: interactive till`.

### Task 8: Dashboard

**Files:** Create: `src/app/page.tsx`, `src/components/StatCard.tsx`, `RevenueChart.tsx`, `Sparkline.tsx`.

- [ ] **Step 1:** LOAD `dataviz` SKILL before writing chart code; follow its palette/mark rules with brand tokens.
- [ ] **Step 2:** Owner view: "Today" strip (demo-day takings live-updated with play-invoices, invoice count, avg ticket, cash-up status chip), 24-month revenue bar/line chart, KPI cards (2025 revenue, active clients, retail % of revenue, lapsed-client count → links to filtered client list), top services & top stylists tables (12m), stock alerts card (low-stock count → /stock). Stylist role sees only their own day + month vs target.
- [ ] **Step 3:** Build + visual check. Commit `feat: dashboard`.

### Task 9: Clients list + client file

**Files:** Create: `src/app/clients/page.tsx`, `clients/[id]/page.tsx`, `src/components/HistoryTimeline.tsx`.

- [ ] **Step 1:** List: instant search (name/phone), filter chips (All / Lapsed 90d+ / Birthdays this month), columns: name, preferred stylist, last visit, visits, lifetime spend. 750 rows client-side is fine.
- [ ] **Step 2:** Client file: header (name, phone, badges: medical flag, lapsed, VIP = top-decile spend), KPI row, notes card (technical/colour notes), visit timeline (date, stylist, lines with prices, total) — the "wow" screen: 11 years of history at a glance; "Send win-back SMS" button → mock composer dialog (template prefilled, marked demo-only).
- [ ] **Step 3:** Build + check deep links. Commit `feat: clients & history`.

### Task 10: Stock screens

**Files:** Create: `src/app/stock/page.tsx`.

- [ ] **Step 1:** Tabs: **Retail** | **Back-bar** | **What to order**. Retail/back-bar: search + brand (vendor) filter, columns: item, brand, size ml, cost, price, margin %, on-hand (low-stock rows tinted warn); value-on-hand total in header. "What to order": rows where `qty <= reorder`, grouped by vendor with suggested qty (`reorder*2 - qty`), mock "Create order" button → printable order sheet dialog.
- [ ] **Step 2:** Build + check. Commit `feat: stock control screens`.

### Task 11: Staff & portfolios

**Files:** Create: `src/app/staff/page.tsx`, `staff/[id]/page.tsx`.

- [ ] **Step 1:** Team grid: card per active staff (initials avatar in taupe, name, role, 12m revenue mini-sparkline). Owner sees revenue; reception sees only contact cards.
- [ ] **Step 2:** Portfolio: month revenue vs target bar, services vs retail split, tips (12m total + recent), subs list, clock card (this week's in/out pairs + hours), "their day today" (demo-day bookings for that stylist). This is each stylist's phone view when role = Stylist.
- [ ] **Step 3:** Build + check. Commit `feat: staff portfolios`.

### Task 12: Diary + Cash-up

**Files:** Create: `src/app/diary/page.tsx`, `src/components/DiaryGrid.tsx`, `src/app/cashup/page.tsx`, `src/components/DenomCounter.tsx`.

- [ ] **Step 1:** Diary: day view (demo date), columns per stylist (on-diary staff), 08:00–18:00 rows, bookings from `demoday.json` colored by department; click → popover (client link, service, duration); "walk-ins welcome" empty-slot affordance. Week toggle shows density only.
- [ ] **Step 2:** Cash-up: denomination counter (R200…5c steppers) live-summing, expected-vs-counted variance (expected = demo-day cash + play-invoice cash), card/EFT auto totals, float input, "Lock day" button → locked state banner (exactly the MySalon ritual, modernised).
- [ ] **Step 3:** Build + check. Commit `feat: diary and cash-up`.

### Task 13: Pricing & menu

**Files:** Create: `src/app/pricing/page.tsx`.

- [ ] **Step 1:** Menu editor view: departments accordion, rows: service, duration, cost, price, margin; "Schedule increase" mock dialog (effective date + %). "Print client menu" → clean print-CSS page generated from live data (the killer contrast to their Word docs — subtitle: "This menu is generated from the system, never retyped").
- [ ] **Step 2:** Build + check incl. print preview. Commit `feat: pricing & generated menu`.

### Task 14: Polish + verification pass

**Files:** Modify: all pages; Create: `README.md`, `src/app/icon.svg` (scissors mark in taupe).

- [ ] **Step 1:** Responsive audit at 390px/768px/1280px; empty states; focus-visible rings; `tabular-nums` on all money columns; loading-free (all static imports).
- [ ] **Step 2:** README: run (`npm i && npm run dev`), deploy ("Import GitHub repo in Vercel → framework auto-detected → Deploy", plus `npx vercel` alternative), privacy note about pseudonymized data.
- [ ] **Step 3:** `npm test` + `npm run build` + `npx next lint` all green. Commit `chore: polish, README, icons`.

### Task 15: Presentation deck

**Files:** Create: `public/deck/index.html` (self-contained single file).

- [ ] **Step 1:** LOAD `frontend-slides` SKILL; build a Hairline-branded deck (taupe/ink, wordmark, keyboard + click navigation, print-to-PDF friendly) with this narrative (~14 slides): 1 Title "Hairline Salon Manager" · 2 The brief (owner's ask) · 3 What we analysed (backup → 11 yrs, 90k invoices) · 4 What the data said (used daily vs never used) · 5 Industry research (checkout speed = adoption) · 6 The decision: build simple, Hairline-first, startup-ready · 7 The seven modules · 8 Live prototype (link + QR to Vercel URL placeholder, big "/") · 9 The till ≤30s story · 10 Client history wow · 11 Stock & staff views · 12 De-risked rollout (5 phases) · 13 What we're NOT building · 14 Decisions needed + next steps.
- [ ] **Step 2:** Verify slides render locally (open file), arrows/keys work, prints clean. Commit `feat: presentation deck at /deck`.

### Task 16: Ship

- [ ] **Step 1:** Full check: `npm test`, `npm run build`; click through every route in `npm run start`.
- [ ] **Step 2:** Push to GitHub `AshleyTerra/hairline` (pending the credential fix — Option 1/2 from earlier); if still blocked, deliver as local repo + zip and flag.
- [ ] **Step 3:** Hand the user Vercel import steps (README) — they publish; deck lands at `<vercel-url>/deck`.
- [ ] **Step 4:** Final commit if anything changed; report URLs + how to demo (suggested owner walkthrough script: Dashboard → Client history → Till sale in 30s → Cash-up → /deck).

---

## Self-review notes

- **Spec coverage:** till+cash-up (T6/7/12), clients+history (T9), pricing (T13), stock (T10), staff portfolios (T11), messaging (mock composer T9 — deliberate: demo-only), diary (T12), roles (T2), real data (T3/4), branding (T2), Vercel (T14/16), deck (T15). Vouchers exercised in till payment methods (T6/7). Offline queue intentionally OUT of prototype scope (demo runs online; plan doc covers it for production) — stated here so it's not read as a gap.
- **Placeholder scan:** clean — every task names exact files; code given where logic is non-obvious (SQL, tests); UI tasks specify exact content/behaviour.
- **Type consistency:** all shapes flow from Task 4 output → `types.ts` (T5) is the single source; till types defined in T5, used in T6/7.
