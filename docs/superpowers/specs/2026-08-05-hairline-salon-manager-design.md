# Hairline Salon Manager — V1 Plan

**For review by:** Hairline owner
**Prepared:** 5 August 2026
**Status:** Draft for owner approval

---

## 1. What we're proposing

A modern, simple salon system built around the way Hairline actually works — replacing MySalon with something faster at the till, visible from your phone, and safe from load-shedding and PC failures.

It is deliberately **not** an everything-system. Eleven years of your own MySalon data tells us exactly which features Hairline uses every day and which were never touched. V1 focuses on the daily essentials done exceptionally well:

> **Invoicing & cash-up · Clients & history · Pricing & menus · Stock control · Staff & team portfolios · Client messaging · A simple diary**

If the team loves it, the same system is built so it can later be offered to other salons — but Hairline comes first.

## 2. Why replace MySalon now

- **It's 2005-era technology.** The database behind MySalon is a Microsoft SQL Server 2005 design. It runs on one PC in the salon; if that PC dies, trading stops until a backup is restored.
- **You can't see the business from outside the salon.** Takings, stock and staff performance are only visible at reception.
- **Price lists live in Word.** Every increase means retyping the client menu (we found five years of separate Word/PDF price lists being maintained by hand).
- **Paper-era workflow tax.** Reports print or stay on-screen; nothing reaches your phone; SMS works but is dated; WhatsApp isn't possible.

What MySalon got right — fast keyboard-driven invoicing, denomination cash-up, simple stock takes — we keep and improve. **The new till must be faster than the old one, or we have failed.**

## 3. What the data told us (your last 11 years)

| Fact | What it means for V1 |
|---|---|
| ~90,000 invoices since July 2015; R7.5m revenue in 2025 | Invoicing is the heart. It gets the most design attention. |
| 8,645 active clients on file | Client history is a major asset — all of it migrates. |
| 3,841 daily cash-ups with coin/note counts | Cash-up stays denomination-based, exactly as reception knows it. |
| 2,606 tip records, 1,872 staff subs | Tips and subs are daily practice — first-class features, not add-ons. |
| 218 stock takes (49,663 items counted) | Stock take flow must be quick and forgiving. |
| 11,069 fingerprint clock-ins | The team already accepts clocking in — we keep it (PIN/photo, no special hardware). |
| Thousands of SMSes sent | Client messaging matters — upgraded with templates and WhatsApp-ready. |
| Appointment diary: barely used. Payroll, loyalty, packages: never used | Payroll, loyalty and packages are left out of V1 entirely. The diary is included, but lightweight and optional. No clutter. |

## 4. The seven modules

### 4.1 Till & Invoicing — the heart of the system
- One screen: choose client → add services and products (each line tagged to the stylist who did the work) → discount if needed → take payment → done. Target: **under 30 seconds** for a routine sale.
- Payments exactly as today: Cash, Card, EFT, To-Pay (account), Voucher — split payments allowed.
- Tips captured per stylist at payment time.
- Gift and comp vouchers: sell, redeem, track balances and expiry.
- Credit notes and invoice corrections with a full audit trail (every change is recorded — nothing silently disappears).
- **Daily cash-up as you know it**: count notes and coins by denomination, card/EFT totals auto-filled from the day's invoices, float and cash-drop, then locked.
- **Load-shedding-proof**: if internet drops, the till keeps invoicing; sales sync automatically when the connection returns. With a laptop or UPS at reception, trading never stops.

### 4.2 Clients & History
- Instant search (name, phone, barcode). Full visit history back to 2015 — every service, product, price, stylist.
- Technical notes and colour formulas per client; medical flags; birthday; preferred stylist.
- "Lapsed clients" list (e.g. no visit in 90 days) ready for a win-back message.
- POPIA-respectful: consent flags for messaging, opt-outs honoured automatically.

### 4.3 Pricing & Service Menu
- One service menu with **price tiers per stylist level** (senior/junior — as Hairline prices today).
- Price increases are scheduled with an effective date — change once, everywhere.
- The **printed/PDF client price menu is generated from the system** — no more retyping Word documents every year.
- Service costs tracked so you can see margin per service, not just turnover.

### 4.4 Stock Control
- Retail shelf and professional back-bar tracked **separately** (matching your existing Kerastase/Schwarzkopf/Wella retail-vs-stock departments) — industry best practice.
- Barcode scanning at the till and at stock take.
- Reorder levels with a simple **"what to order" list** per supplier; orders and receiving recorded so cost prices stay current.
- Stock takes with variance reports (counted vs expected), quick to do in sections.
- Staff purchases at cost handled cleanly (your existing practice, formalised).

### 4.5 Staff & Team Portfolios
- Staff profiles: roles, contact, start date, targets.
- **Each stylist gets their own login on their phone**: today's clients, month-to-date performance vs target, tips earned. Their numbers, visible to them — a genuine team buy-in feature.
- Tips summary and staff subs (advances/deductions) per person, per period.
- Time clock: PIN or photo clock-in on a salon device (replaces the fingerprint reader — no special hardware).
- Leave recording and public holidays.

### 4.6 Client Messaging
- SMS from day one (South African gateway); WhatsApp added once the business account is approved.
- Ready-made templates: birthday wishes, price-increase notice, win-back, thank-you/rebooking nudge.
- Every message logged against the client. Opt-outs automatic.

### 4.7 Appointment Diary (lightweight)
- Simple day/week view per stylist; walk-ins remain first-class — **invoicing never requires a booking**.
- Designed so that if the team adopts it, V2 can add client self-booking online. If they don't, it stays out of the way.

### Owner dashboard (across everything)
On your phone, any time: today's takings so far, cash-up status, this month vs last, top stylists, stock value on hand, VAT-ready sales figures for the accountant.

## 5. Who sees what

| Role | Can do / see |
|---|---|
| **Owner/Manager** | Everything: reports, costs, margins, staff data, settings. |
| **Reception** | Till, cash-up, clients, diary, stock receiving and stock takes. No profit reports, no staff pay data. |
| **Stylist** | Their own dashboard only: their day, their performance, their tips; client history/notes for clients they serve. |

Every user has their own login; every sensitive action is logged.

## 6. Your data comes with

One-time migration from the MySalon backup, tested in advance, finalised on go-live weekend:

- All **10,125 clients** (details, notes, history flags)
- All **~90,000 invoices** with line items — 11 years of client history, searchable
- Full **stock file** with cost prices, selling prices and barcodes
- **Staff records**, service menu, departments, payment methods

MySalon stays available read-only afterwards as a safety net. Nothing is lost.

## 7. How we go live without risk

| Phase | What happens | Duration (indicative) |
|---|---|---|
| **1. Build the heart** | Till + invoicing + cash-up + clients, loaded with your real migrated data | 6–8 weeks |
| **2. Shadow run** | Reception runs the new till **alongside** MySalon; daily totals must match to the cent | 2 weeks |
| **3. Go-live** | Cut over invoicing and cash-up; MySalon goes read-only | 1 weekend |
| **4. Stock & staff** | Stock control, orders, stock take; staff portfolios and time clock | +4–6 weeks |
| **5. Messaging & diary** | SMS/WhatsApp templates; lightweight diary; stylist phone dashboards | +3–4 weeks |

Stylist dashboards arrive **after** the till is already trusted — so the team's first impression of the system is reception loving it, not change being forced on everyone at once.

## 8. What we are deliberately NOT building in V1

| Left out | Why |
|---|---|
| Payroll | Never used in MySalon; your current payroll process continues. Exports provided. |
| Loyalty points | Unused in 11 years. Revisit in V2 if wanted. |
| Online self-booking | Only makes sense after the diary is adopted internally. V2 candidate. |
| Multi-branch screens | Architecture supports it later; no UI clutter now. |
| Accounting integration | Clean CSV/report exports for the accountant instead. |

Every feature left out is a screen reception doesn't have to learn.

## 9. What success looks like

- Routine sale rung up in **≤ 30 seconds**; cash-up done in **≤ 5 minutes**.
- Shadow-run totals match MySalon **to the cent** for two weeks.
- Reception says they **prefer the new till** within a month of go-live.
- You check the day's takings **on your phone** instead of phoning the salon.
- Zero data loss; every historic client visit still findable.

## 10. Decisions we'd like from the owner

1. **Name**: happy with "Hairline Salon Manager" as the working name, or is there a preferred name?
2. **Price tiers**: confirm current stylist levels for pricing (e.g. Senior / Junior — any others?).
3. **Card machine**: keep standalone card terminals (amount typed in, as today), or explore integrated payments later?
4. **WhatsApp**: shall we register a WhatsApp Business account for the salon number?
5. **Diary ambition**: is the team expected to use the diary from day one, or introduce it gently after go-live?

---

## Appendix A — Technical architecture (for the technical reader)

- **Platform**: single web application (TypeScript end-to-end; Next.js/React front end), responsive for desktop till, tablet and phone. Installable as a PWA on the reception machine.
- **Database**: PostgreSQL, cloud-hosted, with `salon_id` (tenant key) on every table from day one — Hairline first, multi-salon capable without a rewrite.
- **Offline till**: service worker + local cache of clients/menu/stock; invoices created offline queue locally (surviving restarts) and sync with conflict-safe, idempotent writes; cash-up blocks/warns while unsynced invoices exist.
- **Auth & roles**: per-user accounts; role-based access (Owner / Reception / Stylist); sensitive actions audited (invoice edits follow MySalon's audit-trail precedent — 368k audit rows prove the need).
- **Money integrity**: all totals, VAT (15% SA), stock movements and commission figures computed and validated server-side; soft deletes everywhere; immutable audit log on financial records.
- **Messaging**: SA SMS gateway (BulkSMS/Clickatell class) with delivery logging; WhatsApp Business API phase-in.
- **Hosting & ops**: managed cloud platform; automated nightly backups, point-in-time recovery, periodic restore drills; encrypted in transit and at rest; POPIA-conscious data handling.
- **Final stack versions** are confirmed in the implementation plan (next document), following current LTS releases.

## Appendix B — Data migration inventory

| MySalon source | Rows (July 2026 backup) | Destination |
|---|---|---|
| Clients | 10,125 (8,645 active) | Clients |
| Invoices / InvoiceItems | 90,183 / 180,744 | Sales history (read-optimised) |
| Stock | 3,981 items | Products (retail + back-bar) |
| Stylists | 46 (13 active) | Staff profiles |
| Departments / Categories | 29 / 5 | Product & service grouping |
| PaymentMethods | 5 | Payment types |
| StylistTips / StaffSubs | 2,606 / 1,872 | Tips & subs history |
| Vouchers (invoice-embedded) | — | Voucher register (open balances) |
| SMS history | 3,844 batch items | Client message log (reference) |
| Cashup | 3,841 | Historic cash-up archive (reference) |

Excluded (empty or obsolete in source): payroll tables, loyalty, packages, proforma invoices, bank recon, fingerprints (template data is hardware-specific).

## Appendix C — Evidence base

- MySalon database restored and analysed from `MySalon_2026-07-29.zip` (SQL Server backup, schema version 611 = SQL Server 2005).
- Usage findings and revenue by year derived from `Invoices`, `Cashup`, `StylistTips`, `StaffSubs`, `StockTake`, `FingerprintClock`, `Diary` tables.
- Industry practice references: salon software adoption hinges on checkout speed and minimal training ([Boulevard](https://www.joinblvd.com/blog/best-pos-systems-for-salons), [The Retail Exec](https://theretailexec.com/tools/best-salon-pos-software/)); retention driven by client history, rebooking and win-back flows ([Zenoti](https://www.zenoti.com/thecheckin/salon-management-best-practices-for-growth)); back-bar vs retail separation with reorder thresholds ([Square](https://squareup.com/au/en/the-bottom-line/operating-your-business/manage-inventory-beauty-salon), [Salon Spa Connection](https://salonspaconnection.com/salon-inventory-management-make-the-most-from-salon-back-bar-retail/), [Suplery](https://suplery.com/blog/inventory-control-differences-across-salons-spas-and-barbershops/)).
