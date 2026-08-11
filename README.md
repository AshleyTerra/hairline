# Hairline Salon Manager — prototype

A clickable prototype of a replacement for Hairline's MySalon system, built on the salon's
own data so the owner and team can judge it against how the salon actually runs.

**Plan document:** [docs/superpowers/specs/2026-08-05-hairline-salon-manager-design.md](docs/superpowers/specs/2026-08-05-hairline-salon-manager-design.md)
**Presentation deck:** `/deck` once deployed (source: `public/deck/index.html`)

## Signing in

The prototype opens on a sign-in screen. Every account uses the password **`hairline2026`**:

| Username | Opens as | Sees |
|---|---|---|
| `owner` | Salon Owner | Everything — takings, reports, costs, stock, the team |
| `reception` | Reception | Till, clients, diary, stock, cash-up |
| `karin` | Karin M. | One stylist's own day, figures and tips |
| `meagan` | Meagan V. | A second stylist, to compare portfolios |

The accounts are listed on the sign-in screen itself and fill the form when clicked, so the
owner can move between roles without being told the passwords.

> **This is a demo gate, not authentication.** The prototype is a static site with no server,
> so the credentials are part of the page the browser downloads and a determined visitor can
> bypass them. It keeps the public link away from casual visitors and makes each role feel real.
> Production needs server-side accounts, hashed passwords and sessions — that's in the plan,
> not in this prototype.

## What's in it

| Screen | What it demonstrates |
|---|---|
| **Dashboard** | Owner's view: today's takings, 11 years of revenue, top stylists, retail share, what needs attention. Switches to a stylist's own figures when the role changes. |
| **Till** | Fully interactive. Pick a client, add services and products, discount, split the payment, capture tips, complete the sale. A stopwatch shows whether it beat 30 seconds. |
| **Clients** | 750 real client histories with search, lapsed and top-spender filters, and a full visit timeline per client. |
| **Diary** | The demo day's appointments per stylist, reconstructed from that day's real invoices. |
| **Stock** | Retail shelf and back bar tracked separately, margins, and a "what to order" list by supplier. |
| **Team** | Staff portfolios: turnover against target, tips, retail share, time clock. |
| **Cash-up** | Denomination counter with live variance against expected cash, then lock the day. |
| **Pricing** | The service menu with margins, a scheduled-increase preview, and a printable client price list generated from live data. |
| **Admin** | Users and passwords, a role-by-screen permission grid that drives the real menu, eight CSV exports, client import from a spreadsheet, and MySalon `.bak` validation. |

## Built from reception's feedback

The till follows what the admin user asked for after trying the first build, not a design mock:

| Asked for | Built |
|---|---|
| Services and retail in **list format**, most popular first, no durations | Lists ordered by how often each item was rung up in the last 13 months — `Cut - ladies` (818×) leads its department |
| Retail **tabs per vendor** | A tab per supplier, busiest first, products most-sold first inside each |
| Tips: **dropdown per operator**, added to the balance but not to stylist sales | Any operator can be tipped, assistants included; the tip raises what the client pays and is reported apart from turnover |
| A **docket per client**, loadable in advance | Several dockets open at once, each taking an invoice number on creation |
| **Invoice numbers** and **printable invoices** | Numbering carries on from the salon's sequence (93711 onward); the invoice carries salon, VAT, client, lines, stylist, tip and payment |
| **Add a new client** at the till | Captured mid-sale from the client slot |
| Rename to **Price Menu**, split service / retail / menu | Three tabs, with per-supplier retail pricing and scheduled increases on either |

Sales you ring up on the till persist in the browser and feed into the dashboard and
cash-up, so the demo hangs together as one day of trading.

## What Admin can genuinely do

The prototype is a static site, so each admin job is built to the limit that allows:

| Job | In the prototype |
|---|---|
| CSV exports | **Fully working.** Eight exports, real files, correct quoting so phone numbers keep their leading zero. |
| Client import | **Fully working.** Parses your CSV, validates every row, shows what will be skipped and why, then adds the good rows to the session. |
| Users and passwords | **Fully working.** Stored in the browser; the sign-in screen authenticates against them. |
| Roles and screens | **Fully working.** The permission grid is what the menu reads, so changes take effect immediately. |
| MySalon `.bak` restore | **Validation only.** The file's header is checked in the browser to confirm it is a genuine SQL Server backup, and the migration steps are shown. Restoring 148 MB of SQL Server data needs a server, which a static site does not have. |

Admin changes live in `localStorage`, so they never affect anyone else's demo.
**Reset the demo** on the Admin screen puts everything back to how a first-time visitor finds it.

## Privacy

Real: services, prices, costs, products, barcodes, revenue, visit patterns, staff first names.

Anonymised: **client names, phone numbers, e-mail addresses and birthdays** are deterministic
stand-ins generated by `tools/transform.mjs`. The transform refuses to write output if any
real client name or phone number survives into the dataset.

Raw extracts containing real personal data are written to a scratchpad directory outside this
repository and are never committed (`*.raw.json` is git-ignored).

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # till money logic — 18 tests
npm run build      # production build
```

## Deploying to Vercel

1. Push this repository to GitHub.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Framework preset is detected automatically (Next.js). No environment variables are needed —
   all data is static.
4. **Deploy.** The prototype is at the project URL and the deck at `<url>/deck`.

Alternatively, from this directory: `npx vercel` (then `npx vercel --prod`).

## Regenerating the data

Only needed if the MySalon backup changes. Requires the backup restored to a LocalDB
instance named `MySalonRestore`.

```powershell
./tools/extract.ps1      # SQL Server -> raw JSON in the scratchpad (contains real PII)
node tools/transform.mjs # raw -> anonymised src/data/*.json + public/data/visits/*.json
```

`extract.ps1` anchors every date window to the last real trading day, ignoring stray
future-dated invoices. `transform.mjs` is deterministic: the same backup always produces the
same anonymised dataset.

## Layout

```
src/app/          one folder per screen (App Router)
src/components/   shared UI, charts, and the till's parts
src/lib/          types, data loaders, formatting, and the till reducer
src/data/         generated dataset (committed, anonymised)
public/data/      per-client visit history, fetched on demand
tools/            extraction and transform scripts
```

The till's money logic lives in `src/lib/till.ts` as a pure reducer with no React in it, so
totals, VAT, split payments, change and tips are unit-tested independently of the interface.
