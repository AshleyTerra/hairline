/** Phase 1 acceptance checks against Karin's specification. */
import { spawn } from "node:child_process";
import { rmSync, mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9235;
const BASE = process.argv[2] ?? "http://localhost:3100";
const PROFILE = process.env.TEMP + "\\cdp-p1";
const OUT = "C:\\temp\\claude\\c--Data-OneDrive---Terra-Group-Applications-Hairline\\6305bd13-c82c-4c05-b471-9115eecd7529\\scratchpad\\phase1";
const DL = OUT + "\\downloads";

rmSync(PROFILE, { recursive: true, force: true });
rmSync(DL, { recursive: true, force: true });
mkdirSync(DL, { recursive: true });

const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=2",
  `--remote-debugging-port=${PORT}`, "--user-data-dir=" + PROFILE,
  "--window-size=1440,1000", "about:blank",
], { stdio: "ignore" });

await sleep(3000);
const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));

let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m.error); pending.delete(m.id); }
};
const send = (method, params = {}) =>
  new Promise((res) => { const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });
const ev = async (expr) =>
  (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }))?.result?.value;
const shot = async (name) => {
  const r = await send("Page.captureScreenshot", { format: "png" });
  if (r?.data) writeFileSync(`${OUT}\\${name}.png`, Buffer.from(r.data, "base64"));
};
const text = () => ev(`document.body.innerText.replace(/\\u00a0/g," ").replace(/\\s+/g," ")`);
async function until(expr, tries = 25) {
  for (let i = 0; i < tries; i += 1) { if (await ev(expr)) return true; await sleep(1000); }
  return false;
}
const clickStartsWith = (t) => ev(`(() => {
  const el = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().toLowerCase().startsWith(String(${JSON.stringify(t)}).toLowerCase()));
  if (el) { el.click(); return true; } return false;
})()`);
const setInput = (label, v) => ev(`(() => {
  const el = document.querySelector('[aria-label=${JSON.stringify(label)}]');
  if (!el) return false;
  const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
  d.call(el, ${JSON.stringify(v)});
  el.dispatchEvent(new Event('input',{bubbles:true}));
  el.dispatchEvent(new Event('change',{bubbles:true}));
  return true;
})()`);
const setSelect = (label, valueMatch) => ev(`(() => {
  const sel = document.querySelector('select[aria-label=${JSON.stringify(label)}]');
  if (!sel) return false;
  const opt = Array.from(sel.options).find(o => o.value === ${JSON.stringify(valueMatch)} || o.textContent.includes(${JSON.stringify(valueMatch)}));
  if (!opt) return false;
  sel.value = opt.value;
  sel.dispatchEvent(new Event('change',{bubbles:true}));
  return opt.textContent.trim();
})()`);

const results = [];
const check = (l, p, x = "") => results.push(`${p ? "PASS" : "FAIL"}  ${l}${x ? " - " + x : ""}`);

await send("Page.enable");
await send("Runtime.enable");
await send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: DL });

// ---- sign in as owner (reports are owner-only)
await send("Page.navigate", { url: BASE + "/" });
await until(`!!document.querySelector('input[autocomplete="username"]')`);
await ev(`(() => {
  const s=(el,v)=>{const d=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;d.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));};
  s(document.querySelector('input[autocomplete="username"]'),'owner');
  s(document.querySelector('input[type="password"]'),'hairline2026');
  document.querySelector('form').requestSubmit();
})()`);
await until(`!document.querySelector('input[autocomplete="username"]')`);
await sleep(2500);

// ---- B-01 logo: one "l", not two
const mark = await ev(`document.querySelector('[aria-label="Hairline"]')?.innerText.replace(/\\s+/g,"")`);
check("B-01 wordmark reads Hairline with one l", mark === "HAIRline", JSON.stringify(mark));
check("B-01 no double-l anywhere", !/HAIRlline/i.test(await text()));

// ---- FR-010 dashboard date selection
check("FR-010 dashboard has a date picker", await ev(`!!document.querySelector('[aria-label="Date"]')`));
const todayTake = (await text()).match(/Taken so far R ?[\d ]+/)?.[0];
check("FR-010 shows today by default", /Today/.test(await text()), todayTake);
await shot("p1-dashboard-today");
await setInput("Date", "2026-06-13");
await sleep(1600);
const otherDay = await text();
check("FR-010 a chosen date changes the figures", !otherDay.includes(todayTake ?? "zzz"),
  (otherDay.match(/Taken R ?[\d ]+/) ?? [""])[0]);
check("FR-010 offers Back to today", /Back to today/.test(otherDay));
// The dashboard's grain buttons call it Range; the daybook calls it Date range.
await clickStartsWith("Range");
await sleep(900);
await setInput("From date", "2026-06-01");
await sleep(500);
await setInput("To date", "2026-06-30");
await sleep(1600);
const ranged = await text();
check("FR-010 a range aggregates trading days", /trading days/.test(ranged),
  (ranged.match(/\d+ trading days/) ?? [""])[0]);
await shot("p1-dashboard-range");

// ---- FR-006 Reports menu exists
check("FR-006 Reports in the menu", await ev(`!!document.querySelector('a[href="/reports"]')`));
await send("Page.navigate", { url: BASE + "/reports" });
await sleep(2600);
const rep = await text();
check("FR-007 report type selector", await ev(`!!document.querySelector('select[aria-label="Report type"]')`));
check("FR-007 start and end dates", await ev(`
  !!document.querySelector('[aria-label="Start date"]') && !!document.querySelector('[aria-label="End date"]')
`));
/* The staff picker is a dropdown now, so Select all sits inside the panel. */
await ev(`document.querySelector('button[aria-label="Staff"]')?.click(), true`);
await sleep(700);
const picker = await text();
check("FR-009 staff multi-select with Select all",
  /Select all/i.test(picker) && /Deselect all/i.test(picker));
await ev(`document.querySelector('button[aria-label="Staff"]')?.click(), true`);
await sleep(400);
/* "Salon stock" became "Stock Sales" on 14 August, at the salon's request for
   one familiar label everywhere. */
check("FR-009 columns show services, retail and Stock Sales",
  /services/i.test(rep) && /retail/i.test(rep) && /stock sales/i.test(rep));
check("FR-009 both excl and incl VAT", /excl vat/i.test(rep) && /incl vat/i.test(rep));
check("FR-009 period stated on the report", /to \d|August|July/.test(rep));
check("FR-011 print button offered", /Print \/ save as PDF/.test(rep));
check("FR-008 Excel and CSV offered", /Excel/.test(rep) && /CSV/.test(rep));
const totalRow = await ev(`document.querySelector('tfoot')?.innerText.replace(/\\s+/g," ")`);
check("FR-009 totals row present", /Total/.test(totalRow ?? ""), (totalRow ?? "").slice(0, 60));
await shot("p1-reports-staff");

// ---- FR-008 exports actually produce files
/* Wait for the file rather than a fixed number of seconds: a slow write made
   this read an empty directory and report a working export as broken. A partial
   download lands as .crdownload, so those do not count as finished. */
const waitForFile = async (ext, tries = 20) => {
  for (let i = 0; i < tries; i += 1) {
    const found = existsSync(DL)
      ? readdirSync(DL).filter((f) => f.endsWith(ext) && !f.endsWith(".crdownload"))
      : [];
    if (found.length > 0) return found;
    await sleep(500);
  }
  return [];
};

await clickStartsWith("Excel");
const xlsx = await waitForFile(".xlsx");
check("FR-008 Excel workbook downloads", xlsx.length > 0, xlsx[0] ?? "none");
await clickStartsWith("CSV");
const csv = await waitForFile(".csv");
check("FR-008 CSV downloads", csv.length > 0, csv[0] ?? "none");

// ---- second report type
const picked = await setSelect("Report type", "Daily staff turnover");
await sleep(1800);
const daily = await text();
check("FR-009 daily-per-staff report available", !!picked, picked || "not found");
check("daily report switches to a single staff picker",
  await ev(`!!document.querySelector('select[aria-label="Staff member"]')`));
check("daily report lists dates", /\d{1,2} \w+ 2026/.test(daily));
await shot("p1-reports-daily");

// ---- date validation
await setInput("Start date", "2026-07-25");
await sleep(400);
await setInput("End date", "2026-07-01");
await sleep(1400);
check("start after end is refused", /start date is after the end date/i.test(await text()));

// ---- FR-001/002/003 till
await send("Page.navigate", { url: BASE + "/till" });
await sleep(2800);
const till = await text();
check("FR-001 till opens on Clients today", /awaiting payment|clients today|No dockets open|Nothing rung up/i.test(till)
  && !!(await ev(`!!document.querySelector('[data-daybook], [data-open-dockets]')`)));
check("FR-002 day and week views offered", /\bDay\b/.test(till) && /\bWeek\b/.test(till));
await shot("p1-till-clients-today");

await clickStartsWith("Week");
await sleep(1700);
const weekText = await text();
check("FR-002 week view spans several days", /over \d+ days/.test(weekText),
  (weekText.match(/over \d+ days/) ?? [""])[0]);
await shot("p1-till-week");

await clickStartsWith("Day");
await sleep(1200);
// Move to a future date and prepare a docket
await setInput("Date", "2026-07-28");
await sleep(1600);
const future = await text();
check("FR-003 future date is reachable", /in the future/.test(future));
check("FR-003 offers a docket for that day", /Docket for/.test(future),
  (future.match(/\+ Docket for [^\n]{0,14}/) ?? [""])[0]);
await clickStartsWith("+ Docket for");
await sleep(1800);
const afterFuture = await text();
check("FR-003 the future docket is saved", /Saved/.test(afterFuture) || /awaiting payment/i.test(afterFuture));
const onFutureDay = await ev(`!!document.querySelector('[data-open-dockets] li')`);
check("FR-003 it appears on that future day", onFutureDay);
await shot("p1-till-future-docket");

// and NOT on the demo day
await setInput("Date", "2026-07-25");
await sleep(1700);
const backToday = await ev(`document.querySelector('[data-open-dockets]')?.innerText ?? ''`);
check("FR-003 future docket does not clutter today", backToday.length === 0, backToday.slice(0, 40));

console.log(results.join("\n"));
console.log(`\n${results.filter(r=>r.startsWith("PASS")).length}/${results.length} passed on ${BASE}`);

ws.close();
chrome.kill();
