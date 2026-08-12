/** Checks the dashboard's day/week/month/year/range filters and the card share. */
import { spawn } from "node:child_process";
import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9239;
const BASE = process.argv[2] ?? "http://localhost:3100";
const PROFILE = process.env.TEMP + "\\cdp-grain";
const OUT = "C:\\temp\\claude\\c--Data-OneDrive---Terra-Group-Applications-Hairline\\6305bd13-c82c-4c05-b471-9115eecd7529\\scratchpad\\grain";

rmSync(PROFILE, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=2",
  `--remote-debugging-port=${PORT}`, "--user-data-dir=" + PROFILE,
  "--window-size=1500,1000", "about:blank",
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
const click = (t) => ev(`(() => {
  const el = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().toLowerCase() === ${JSON.stringify(t)}.toLowerCase());
  if (el) { el.click(); return true; } return false;
})()`);
const setVal = (label, v) => ev(`(() => {
  const el = document.querySelector('[aria-label=${JSON.stringify(label)}]');
  if (!el) return false;
  const proto = el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
  const d = Object.getOwnPropertyDescriptor(proto, 'value').set;
  d.call(el, ${JSON.stringify(v)});
  el.dispatchEvent(new Event('input',{bubbles:true}));
  el.dispatchEvent(new Event('change',{bubbles:true}));
  return true;
})()`);
/** The headline "Taken" figure. */
const taken = async () =>
  ev(`(() => {
    const label = Array.from(document.querySelectorAll('p'))
      .find(p => /^taken/i.test(p.textContent.trim()));
    if (!label) return null;
    const value = label.nextElementSibling?.textContent ?? '';
    return value.replace(/[^0-9]/g, '') || null;
  })()`);
const cardPct = async () => {
  const t = await text();
  const m = t.match(/PAID BY CARD (\d+)%/i);
  return m ? Number(m[1]) : null;
};

const results = [];
const check = (l, p, x = "") => results.push(`${p ? "PASS" : "FAIL"}  ${l}${x ? " - " + x : ""}`);

await send("Page.enable");
await send("Runtime.enable");
await send("Page.navigate", { url: BASE + "/" });
await until(`!!document.querySelector('input[autocomplete="username"]')`);
await ev(`(() => {
  const s=(el,v)=>{const d=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;d.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));};
  s(document.querySelector('input[autocomplete="username"]'),'owner');
  s(document.querySelector('input[type="password"]'),'hairline2026');
  document.querySelector('form').requestSubmit();
})()`);
await until(`!document.querySelector('input[autocomplete="username"]')`);
await sleep(2600);

// The reported bug: card share must be a real percentage.
const card = await cardPct();
check("card share is a sensible percentage, not 1%", card !== null && card > 50,
  card === null ? "not found" : `${card}%`);

// All five grains offered.
for (const g of ["Day", "Week", "Month", "Year", "Range"]) {
  check(`${g} filter offered`, await ev(`
    Array.from(document.querySelectorAll('button')).some(b => b.textContent.trim() === ${JSON.stringify(g)})
  `));
}
const dayTaken = await taken();
check("day view shows the trading day", /Today/.test(await text()), `R${dayTaken}`);
await shot("g1-day");

// Week
await click("Week");
await sleep(1600);
const weekTaken = await taken();
check("week totals more than the day", Number(weekTaken) > Number(dayTaken), `R${weekTaken}`);
check("week shows a span label and trading days", /trading days/.test(await text()));
await shot("g2-week");

// Month
await click("Month");
await sleep(1600);
const monthTaken = await taken();
check("month offers a month picker", await ev(`!!document.querySelector('input[type="month"]')`));
check("month totals more than the week", Number(monthTaken) > Number(weekTaken), `R${monthTaken}`);
check("month is labelled by name", /July 2026/i.test(await text()));
await shot("g3-month");

// A month before the day book still shows figures.
await setVal("Month", "2025-12");
await sleep(1800);
const decTaken = await taken();
check("an older month still reports real figures", Number(decTaken) > 0, `Dec 2025: R${decTaken}`);
check("older periods label the card share honestly", /salon average/i.test(await text()));
await shot("g4-old-month");

// Year
await click("Year");
await sleep(1700);
check("year offers a year picker", await ev(`!!document.querySelector('select[aria-label="Year"]')`));
await setVal("Year", "2025");
await sleep(1800);
const yearTaken = await taken();
check("2025 matches the figure the deck quotes", yearTaken === "7525091", `R${yearTaken}`);
check("year view counts months or years, not days", /months|years/.test(await text()));
await shot("g5-year");

// Range
await click("Range");
await sleep(1500);
check("range offers two dates", await ev(`
  !!document.querySelector('[aria-label="From date"]') && !!document.querySelector('[aria-label="To date"]')
`));
await setVal("From date", "2026-07-01");
await sleep(500);
await setVal("To date", "2026-07-25");
await sleep(1800);
const rangeTaken = await taken();
check("a custom range reports its own total", Number(rangeTaken) > 0, `R${rangeTaken}`);
await shot("g6-range");

// Stepping and returning
await click("Day");
await sleep(1300);
await ev(`document.querySelector('button[aria-label="Previous period"]').click(), true`);
await sleep(1500);
check("stepping back changes the day", !/Today/.test(await text()));
check("Back to today offered", /back to today/i.test(await text()));
await click("Back to today");
await sleep(1500);
check("Back to today returns to the trading day", /Today/.test(await text()));
check("and restores the day's figure", (await taken()) === dayTaken, `R${await taken()}`);

console.log(results.join("\n"));
console.log(`\n${results.filter(r=>r.startsWith("PASS")).length}/${results.length} passed`);

ws.close();
chrome.kill();
