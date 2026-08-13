/** Verifies the wish-list items: dockets, new client, invoice numbers, print slip. */
import { spawn } from "node:child_process";
import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9230;
const BASE = "http://localhost:3100";
const PROFILE = process.env.TEMP + "\\cdp-wish";
const OUT = "C:\\temp\\claude\\c--Data-OneDrive---Terra-Group-Applications-Hairline\\6305bd13-c82c-4c05-b471-9115eecd7529\\scratchpad\\wish";

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
const click = (text) => ev(`(() => {
  const el = Array.from(document.querySelectorAll('button')).find(b => (b.textContent||'').trim().includes(${JSON.stringify(text)}));
  if (el) { el.click(); return true; } return false;
})()`);
const setV = (sel, v) => ev(`(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  if (!el) return false;
  const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
  d.call(el, ${JSON.stringify(v)}); el.dispatchEvent(new Event('input',{bubbles:true}));
  return true;
})()`);
const firstTile = () => ev(`document.querySelectorAll('[data-catalogue] li button')[0]?.click(), true`);

const checks = [];
const check = (l, p, x = "") => checks.push(`${p ? "PASS" : "FAIL"}  ${l}${x ? " â€” " + x : ""}`);

await send("Page.enable");
await send("Runtime.enable");
await send("Page.navigate", { url: BASE + "/" });
await sleep(3300);
await ev(`(() => {
  const s=(el,v)=>{const d=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;d.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));};
  s(document.querySelector('input[autocomplete="username"]'),'reception');
  s(document.querySelector('input[type="password"]'),'hairline2026');
  document.querySelector('form').requestSubmit();
})()`);
await sleep(2600);

// --- Dockets -------------------------------------------------------------
/** The till opens on Clients today, which is where dockets are started. */
const openServices = () => ev(`(() => {
  const t = Array.from(document.querySelectorAll('button[aria-pressed]'))
    .find(b => b.textContent.trim().toLowerCase().startsWith('services'));
  if (t) { t.click(); return true; } return false;
})()`);
const openClientsTab = () => ev(`(() => {
  const t = Array.from(document.querySelectorAll('button[aria-pressed]'))
    .find(b => b.textContent.trim().toLowerCase().startsWith('clients today'));
  if (t) { t.click(); return true; } return false;
})()`);

check("the day's tab offers a new docket", await ev(`
  Array.from(document.querySelectorAll('button')).some(b => b.textContent.trim() === '+ New docket')
`));

await click("+ New docket");
await sleep(1400);
const firstNo = await ev(`document.body.innerText.match(/#(\\d+)/)?.[1]`);
check("first docket carries on from the salon's numbering", Number(firstNo) === 93711, `#${firstNo}`);
await openServices();
await sleep(1200);
await firstTile();
await sleep(1000);

await openClientsTab();
await sleep(900);
await click("+ New docket");
await sleep(1400);
await openServices();
await sleep(1000);
const numbers = await ev(`Array.from(document.body.innerText.matchAll(/#(\\d+)/g)).map(m=>m[1])`);
check("two dockets open with different numbers", new Set(numbers).size >= 2, numbers?.join(", "));
await ev(`document.querySelectorAll('[data-catalogue] li button')[1]?.click(), true`);
await sleep(1000);
await shot("w1-two-dockets");

// Switch back: the first docket's work must still be there.
await ev(`(() => {
  const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.includes('#${firstNo}'));
  if (b) { b.click(); return true; } return false;
})()`);
await sleep(1400);
const backLines = await ev(`document.querySelectorAll('aside > div > ul > li').length`);
check("parked docket keeps its lines when reopened", backLines >= 1, `${backLines} line(s)`);
const docketLabel = await ev(`document.body.innerText.includes('Docket #${firstNo}') || document.body.innerText.match(/#${firstNo}/) !== null`);
check("the open docket is labelled on the receipt", docketLabel);

// --- New client ----------------------------------------------------------
await ev(`(() => { const el = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === '+ New'); if (el) { el.click(); return true; } return false; })()`);
await sleep(900);
const dialogOpen = await ev(`!!document.querySelector('[aria-label="Add a new client"]')`);
check("new-client dialog opens", dialogOpen);
await setV('input[type="text"]', "Thandi Nkosi");
await setV('input[type="tel"]', "082 123 4567");
await sleep(400);
await click("Save & use");
await sleep(1400);
const named = await ev(`document.body.innerText.includes('Thandi Nkosi')`);
const flagged = await ev(`document.body.innerText.includes('New client, added today')`);
check("client is captured and used on the sale", named);
check("receipt marks them as added today", flagged);
await shot("w2-new-client");

// --- Complete and print --------------------------------------------------
await click("Exact");
await sleep(700);
await ev(`(() => {
  const b = Array.from(document.querySelectorAll('button')).find(x => /^Take R/.test(x.textContent.trim()));
  if (b) { b.click(); return true; } return false;
})()`);
await sleep(1800);
const slip = await ev(`!!document.querySelector('[aria-label^="Invoice"]')`);
check("invoice slip appears after the sale", slip);
const slipText = await ev(`document.querySelector('[aria-label^="Invoice"]')?.innerText.replace(/\\s+/g,' ') ?? ''`);
check("slip carries the salon detail", /Stoneridge Centre/.test(slipText));
check("slip carries the VAT number", /4060268234/.test(slipText));
check("slip carries the client", /Thandi Nkosi/.test(slipText));
check("slip carries the invoice number", new RegExp(`#${firstNo}`).test(slipText), `#${firstNo}`);
check("slip has a print button", /Print/.test(slipText));
await shot("w3-invoice-slip");

// Docket closed after completing.
await click("Close");
await sleep(1000);
const stillOpen = await ev(`document.body.innerText.includes('#${firstNo}')`);
check("completed docket is closed out", !stillOpen);

// --- Price menu ----------------------------------------------------------
await send("Page.navigate", { url: BASE + "/pricing" });
await sleep(2400);
const pm = await ev(`document.body.innerText.replace(/\\s+/g,' ')`);
check("screen is titled Price menu", /price menu/i.test(pm));
check("has a service pricing tab", /Service pricing/.test(pm));
check("has a retail pricing tab", /Retail pricing/.test(pm));
check("has a client menu tab", /Client menu/.test(pm));
await shot("w4-price-menu");
await click("Retail pricing");
await sleep(1400);
const vendors = await ev(`Array.from(document.querySelectorAll('button[aria-pressed]')).map(b=>b.textContent.trim())`);
check("retail pricing has a tab per vendor", (vendors?.length ?? 0) >= 9, `${vendors?.length} tabs`);
await shot("w5-retail-pricing");
const navLabel = await ev(`document.querySelector('a[href="/pricing"]')?.innerText.trim()`);
check("menu item renamed", /price menu/i.test(navLabel ?? ""), navLabel);

console.log(checks.join("\n"));
console.log(`\n${checks.filter(c=>c.startsWith("PASS")).length}/${checks.length} passed`);

ws.close();
chrome.kill();
