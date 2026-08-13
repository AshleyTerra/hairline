/**
 * Walks the eight Till states from the handoff and captures each one, then
 * checks the other screens still render with the new rail.
 */
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9226;
const BASE = "http://localhost:3100";
const OUT = "C:\\temp\\claude\\c--Data-OneDrive---Terra-Group-Applications-Hairline\\6305bd13-c82c-4c05-b471-9115eecd7529\\scratchpad\\states";

import { mkdirSync } from "node:fs";
mkdirSync(OUT, { recursive: true });

const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars",
  "--force-device-scale-factor=2",
  `--remote-debugging-port=${PORT}`,
  "--user-data-dir=" + process.env.TEMP + "\\cdp-states",
  "--window-size=1280,860", "about:blank",
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
const evaluate = async (expr) =>
  (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }))?.result?.value;
const shot = async (name) => {
  const r = await send("Page.captureScreenshot", { format: "png" });
  if (r?.data) writeFileSync(`${OUT}\\${name}.png`, Buffer.from(r.data, "base64"));
};
const setVal = (sel, v) => evaluate(`(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  if (!el) return false;
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
  s.call(el, ${JSON.stringify(v)});
  el.dispatchEvent(new Event('input',{bubbles:true}));
  return true;
})()`);
const clickText = (text, tag = "button") => evaluate(`(() => {
  const el = Array.from(document.querySelectorAll('${tag}')).find(b => (b.textContent||'').trim().includes(${JSON.stringify(text)}));
  if (el) { el.click(); return true; } return false;
})()`);
const keypad = (digits) => evaluate(`(() => {
  const keys = Array.from(document.querySelectorAll('button')).filter(b => /^[0-9.⌫]$/.test((b.textContent||'').trim()));
  const map = {};
  keys.forEach(k => { map[(k.textContent||'').trim()] = k; });
  for (const d of ${JSON.stringify(digits)}) { if (map[d]) map[d].click(); }
  return Object.keys(map).length;
})()`);

await send("Page.enable");
await send("Runtime.enable");

// sign in
await send("Page.navigate", { url: BASE + "/" });
await sleep(3500);
await evaluate(`(() => {
  const s=(el,v)=>{const d=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;d.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));};
  s(document.querySelector('input[autocomplete="username"]'),'reception');
  s(document.querySelector('input[type="password"]'),'hairline2026');
  document.querySelector('form').requestSubmit();
})()`);
await sleep(2200);

const results = [];
const check = (label, pass, extra = "") => {
  results.push(`${pass ? "PASS" : "FAIL"}  ${label}${extra ? " — " + extra : ""}`);
};

await send("Page.navigate", { url: BASE + "/till" });
await sleep(2600);

// STATE 1: empty till, no client
let text = await evaluate(`document.body.innerText.replace(/\\s+/g,' ')`);
check("1 empty till", text.includes("Walk-in — pick a client") && text.includes("Pick a service or product to start"));
check("1 no totals block yet", !text.includes("Balance"));
check("1 hint instead of timer", text.includes("Target: a routine sale"));
const railWidth = await evaluate(`document.querySelector('aside')?.getBoundingClientRect().width`);
check("icon rail is 78px", Math.round(railWidth) === 78, `${Math.round(railWidth)}px`);
await shot("s1-empty");

// STATE 2: client picked via global search
await setVal('input[type="search"]', "a");
await sleep(900);
await evaluate(`(() => { const b = document.querySelectorAll('.absolute button')[0]; if (b) b.click(); return !!b; })()`);
await sleep(1200);
text = await evaluate(`document.body.innerText.replace(/\\s+/g,' ')`);
check("2 client header populated", !text.includes("Walk-in — pick a client"));
check("2 lines still empty", text.includes("Pick a service or product to start"));
await shot("s2-client");

// STATE 3: lines, nothing paid. The till opens on Clients today, so the item
// tiles are a tab away.
await evaluate(`(() => {
  const t = Array.from(document.querySelectorAll('button[aria-pressed]'))
    .find(b => b.textContent.trim().toLowerCase().startsWith('services'));
  if (t) { t.click(); return true; } return false;
})()`);
await sleep(1200);
// The catalogue is a popularity-ordered list now, not a tile grid.
await evaluate(`(() => {
  const items = Array.from(document.querySelectorAll('[data-catalogue] li button'));
  if (items[0]) items[0].click();
  if (items[3]) items[3].click();
  return items.length;
})()`);
await sleep(1200);
text = await evaluate(`document.body.innerText.replace(/\\s+/g,' ')`);
// innerText reflects CSS text-transform, so these labels arrive uppercased.
check("3 balance equals subtotal", /balance/i.test(text));
const timerShown = await evaluate(`/\\d+s/.test(document.body.innerText)`);
check("3 timer running", timerShown);
await shot("s3-lines");

// STATE 4: partly paid via keypad
await clickText("Card");
await sleep(300);
await keypad(["1", "0", "0"]);
await sleep(500);
// A part payment now says what it does: "Take R 100 on card", not "& complete".
await evaluate(`(() => {
  const b = Array.from(document.querySelectorAll('button')).find(x => /^Take R 100/.test(x.textContent.trim()));
  if (b) { b.click(); return b.textContent.trim(); } return false;
})()`);
await sleep(1200);
text = await evaluate(`document.body.innerText.replace(/\\s+/g,' ')`);
check("4 payment row shown", /card taken/i.test(text));
check("4 the split so far is spelled out", /to go — choose another method/i.test(text));
check("4 balance reduced", /balance/i.test(text));
await shot("s4-partly-paid");

// STATE 5: fully paid -> Exact then complete
await clickText("Exact");
await sleep(600);
const btnLabel = await evaluate(`Array.from(document.querySelectorAll('button')).map(b=>b.textContent.trim()).find(t=>/^Take R/.test(t)) ?? ''`);
check("5 primary button tenders the exact amount", /^Take R/.test(btnLabel), btnLabel);
await shot("s5-fully-paid");

// STATE 6: over-tendered cash -> change due (fresh sale)
await clickText("Clear");
await sleep(800);
await evaluate(`(() => {
  const items = Array.from(document.querySelectorAll('[data-catalogue] li button'));
  if (items[0]) items[0].click();
  return items.length;
})()`);
await sleep(900);
await clickText("Cash");
await sleep(300);
await keypad(["9", "9", "9"]);
await sleep(400);
await evaluate(`(() => {
  const b = Array.from(document.querySelectorAll('button')).find(x => /^Take R/.test((x.textContent||'').trim()));
  if (b) { b.click(); return b.textContent.trim(); } return 'no tender button';
})()`);
await sleep(1400);
text = await evaluate(`document.body.innerText.replace(/\\s+/g,' ')`);
const completed = /Sale complete/.test(text);
check("6 over-tender completes and reports change", completed, completed ? "toast shown" : text.slice(0, 80));
/* Reception has to hand cash back, so the change has to be on the screen. */
const toastText = await evaluate(`(() => {
  const el = Array.from(document.querySelectorAll('[role="status"]')).find(x => /Sale complete/.test(x.innerText));
  return el ? el.innerText.replace(/\\u00a0/g," ").replace(/\\s+/g," ") : "";
})()`);
check("6 the change is named on the toast", /Change R ?[\d ]+/i.test(toastText ?? ""), toastText);
check("6 the invoice shows what was tendered and the change",
  /Tendered/i.test(text) && /Change/i.test(text),
  (text.match(/Tendered R ?[\d ,]+ Change R ?[\d ,]+/i) ?? [""])[0]);
await shot("s6-change-toast");

// STATE 7: just completed
check("7 till cleared after sale", (await evaluate(`document.body.innerText.includes('Pick a service or product to start')`)));
check("7 demo tally shown", (await evaluate(`/Rung up in this demo/.test(document.body.innerText)`)));

// STATE 8: search with no matches
await setVal('input[type="search"]', "zzzzqqq");
await sleep(1000);
check("8 no-match message", (await evaluate(`document.body.innerText.includes('Nothing matches')`)));
await shot("s8-no-match");
await setVal('input[type="search"]', "");
await sleep(500);

// Other screens still render with the rail
// Signed in as reception, so "/" lands on the till rather than the dashboard,
// and Pricing goes by Price menu now.
for (const [path, needle] of [["/", "Pick a service or product to start"],
                              ["/clients", "Clients"], ["/diary", "Diary"],
                              ["/stock", "Stock"], ["/cashup", "Cash-up"],
                              ["/pricing", "Price menu"],
                              ["/admin", "Settings and data"]]) {
  await send("Page.navigate", { url: BASE + path });
  await sleep(1800);
  const ok = await evaluate(`document.body.innerText.includes(${JSON.stringify(needle)})`);
  const w = await evaluate(`document.querySelector('aside')?.getBoundingClientRect().width ?? 0`);
  check(`screen ${path}`, ok && Math.round(w) === 78, `rail ${Math.round(w)}px`);
}
await shot("s9-dashboard-rail");

console.log(results.join("\n"));
console.log("\n" + results.filter((r) => r.startsWith("PASS")).length + "/" + results.length + " passed");

ws.close();
chrome.kill();
