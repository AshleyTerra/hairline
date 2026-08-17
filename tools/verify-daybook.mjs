/** Checks the Clients-today tab: date picking, ranges, and open dockets. */
import { spawn } from "node:child_process";
import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9233;
const BASE = process.argv[2] ?? "http://localhost:3100";
const PROFILE = process.env.TEMP + "\\cdp-daybook";
const OUT = "C:\\temp\\claude\\c--Data-OneDrive---Terra-Group-Applications-Hairline\\6305bd13-c82c-4c05-b471-9115eecd7529\\scratchpad\\daybook";

rmSync(PROFILE, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

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
async function until(expr, tries = 25) {
  for (let i = 0; i < tries; i += 1) {
    if (await ev(expr)) return true;
    await sleep(1000);
  }
  return false;
}
const clickExact = (t) => ev(`(() => {
  const el = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === ${JSON.stringify(t)});
  if (el) { el.click(); return true; } return false;
})()`);
const setDate = (label, v) => ev(`(() => {
  const el = document.querySelector('input[aria-label=${JSON.stringify(label)}]');
  if (!el) return false;
  const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
  d.call(el, ${JSON.stringify(v)}); el.dispatchEvent(new Event('input',{bubbles:true}));
  el.dispatchEvent(new Event('change',{bubbles:true}));
  return true;
})()`);
const rowCount = () => ev(`document.querySelectorAll('[data-daybook] li').length`);

const results = [];
const check = (l, p, x = "") => results.push(`${p ? "PASS" : "FAIL"}  ${l}${x ? " - " + x : ""}`);

await send("Page.enable");
await send("Runtime.enable");
await send("Page.navigate", { url: BASE + "/" });
await until(`!!document.querySelector('input[autocomplete="username"]')`);
await ev(`(() => {
  const s=(el,v)=>{const d=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;d.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));};
  s(document.querySelector('input[autocomplete="username"]'),'reception');
  s(document.querySelector('input[type="password"]'),'hairline2026');
  document.querySelector('form').requestSubmit();
})()`);
await until(`!document.querySelector('input[autocomplete="username"]')`);
await sleep(2200);

// Open the Clients today tab.
check("Clients today tab exists", await clickExact("Clients today"));
await sleep(1600);

check("a date picker is offered", await ev(`!!document.querySelector('input[type="date"]')`));
const today = await ev(`document.querySelector('input[aria-label="Date"]')?.value`);
check("defaults to the demo day", today === "2026-07-25", today);

const todayRows = await rowCount();
check("lists the day's clients", todayRows >= 30, `${todayRows} rows`);
const header = await ev(`document.body.innerText.match(/\\d+ clients?[^\\n]*R[^\\n]*/)?.[0]`);
check("shows a client count and takings", !!header, header);
await shot("d1-today");

// Step back a day with the arrow.
await ev(`document.querySelector('button[aria-label="Previous day"]').click()`);
await sleep(1500);
const prevDate = await ev(`document.querySelector('input[aria-label="Date"]')?.value`);
check("previous-day arrow moves the date", prevDate === "2026-07-24", prevDate);
const prevRows = await rowCount();
check("a past day shows its own clients", prevRows > 0 && prevRows !== todayRows, `${prevRows} rows`);
check("'Back to today' appears once you move", await ev(`document.body.innerText.includes('Back to today')`));
await shot("d2-past-day");

// Pick a specific date.
await setDate("Date", "2026-06-13");
await sleep(1500);
const pickedRows = await rowCount();
check("picking a date loads that day", pickedRows > 0, `13 Jun: ${pickedRows} rows`);

// Switch to a range.
check("range toggle exists", await clickExact("Date range"));
await sleep(1200);
check("a second date field appears", await ev(`!!document.querySelector('input[aria-label="To date"]')`));
await setDate("From date", "2026-06-01");
await sleep(600);
await setDate("To date", "2026-06-30");
await sleep(1800);
const rangeRows = await rowCount();
check("a range aggregates several days", rangeRows > pickedRows, `June: ${rangeRows} rows`);
const spanNote = await ev(`document.body.innerText.match(/over \\d+ days/)?.[0]`);
check("says how many days the range covers", !!spanNote, spanNote);
await shot("d3-range");

// Back to today, then check open dockets appear in the tab.
await clickExact("Back to today");
await sleep(1200);
/* Today's "+ New docket" was removed at the salon's request. A docket is now
   opened by ringing something up and parking it with Save. */
const pickTab = (name) => ev(`(() => {
  const t = Array.from(document.querySelectorAll('button[aria-pressed]'))
    .find(b => b.textContent.trim().toLowerCase().startsWith(${JSON.stringify(name)}));
  if (t) { t.click(); return true; } return false;
})()`);
await pickTab("services");
await sleep(1200);
await ev(`document.querySelectorAll('[data-catalogue] li button')[0]?.click(), true`);
await sleep(1200);
await clickExact("Save");
await sleep(1800);
await pickTab("clients today");
await sleep(1600);
check("open dockets listed in the tab", await ev(`!!document.querySelector('[data-open-dockets] li')`));
check("open section is labelled", await ev(`/awaiting payment/i.test(document.body.innerText)`));
const badge = await ev(`
  Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Clients today'))?.textContent.trim()
`);
check("tab badges the open count", /1/.test(badge ?? ""), badge);
await shot("d4-open-docket");


// --- Filters and docket view ---------------------------------------------
await clickExact("Back to today");
await sleep(1400);
const before = await rowCount();

// Client filter
await ev(`(() => {
  const el = document.querySelector('input[aria-label="Filter by client"]');
  const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
  d.call(el, 'a'); el.dispatchEvent(new Event('input',{bubbles:true})); return true;
})()`);
await sleep(1200);
const afterClient = await rowCount();
check("client filter narrows the list", afterClient > 0 && afterClient < before, `${before} -> ${afterClient}`);
const counter = await ev(`document.body.innerText.match(/\\d+ clients? of \\d+/)?.[0]`);
check("shows filtered-of-total", !!counter, counter);
check("offers Clear filters", await ev(`document.body.innerText.includes('Clear filters')`));
await ev(`(() => {
  const el = document.querySelector('input[aria-label="Filter by client"]');
  const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
  d.call(el, ''); el.dispatchEvent(new Event('input',{bubbles:true})); return true;
})()`);
await sleep(900);

// Stylist filter
const opts = await ev(`document.querySelector('select[aria-label="Filter by stylist"]')?.options.length`);
check("stylist filter lists the day's stylists", (opts ?? 0) > 2, `${opts} options`);
await ev(`(() => {
  const sel = document.querySelector('select[aria-label="Filter by stylist"]');
  sel.value = sel.options[1].value;
  sel.dispatchEvent(new Event('change',{bubbles:true}));
  return sel.options[1].textContent;
})()`);
await sleep(1300);
const afterStylist = await rowCount();
check("stylist filter narrows the list", afterStylist > 0 && afterStylist < before, `${before} -> ${afterStylist}`);
const names = await ev(`Array.from(document.querySelectorAll('[data-daybook] li')).map(li => li.innerText.split('\\n')[2] ?? '').slice(0,3)`);
check("only that stylist's rows remain", new Set(names?.filter(Boolean)).size <= 1, JSON.stringify(names));
await shot("d5-filters");

await clickExact("Clear filters");
await sleep(1200);
check("clearing filters restores the list", (await rowCount()) === before, `${await rowCount()} of ${before}`);

// Click a row to view its docket
await ev(`document.querySelectorAll('[data-daybook] li button')[0].click(), true`);
await sleep(1600);
const slipText = await ev(`document.querySelector('[aria-label^="Invoice"]')?.innerText.replace(/\\s+/g," ") ?? ''`);
check("clicking a row opens the docket", slipText.length > 0);
check("docket shows its line items", /ITEM QTY AMOUNT/i.test(slipText) || /Qty/i.test(slipText), slipText.slice(0, 70));
check("docket shows the client", /[A-Z][a-z]+ [A-Z]/.test(slipText));
check("docket shows how it was paid", /(Card|Cash|EFT|Voucher|On account)/i.test(slipText));
await shot("d6-view-docket");

// Historical docket too
await clickExact("Close");
await sleep(900);
await ev(`document.querySelector('button[aria-label="Previous day"]').click()`);
await sleep(1500);
await ev(`document.querySelectorAll('[data-daybook] li button')[0].click(), true`);
await sleep(1600);
const histSlip = await ev(`document.querySelector('[aria-label^="Invoice"]')?.innerText.replace(/\\s+/g," ") ?? ''`);
check("a past day's docket opens with its lines", histSlip.length > 0 && /Qty/i.test(histSlip), histSlip.slice(0, 60));
await shot("d7-historical-docket");
console.log(results.join("\n"));
console.log(`\n${results.filter(r=>r.startsWith("PASS")).length}/${results.length} passed on ${BASE}`);

ws.close();
chrome.kill();
