/** Verifies Save parks a sale as awaiting payment and can be settled later. */
import { spawn } from "node:child_process";
import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9234;
const BASE = process.argv[2] ?? "http://localhost:3100";
const PROFILE = process.env.TEMP + "\\cdp-save";
const OUT = "C:\\temp\\claude\\c--Data-OneDrive---Terra-Group-Applications-Hairline\\6305bd13-c82c-4c05-b471-9115eecd7529\\scratchpad\\save";

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
/** The tab label carries a badge count, so match on its start, not equality. */
const clickTab = (t) => ev(`(() => {
  const el = Array.from(document.querySelectorAll('button[aria-pressed]'))
    .find(b => b.textContent.trim().startsWith(${JSON.stringify(t)}));
  if (el) { el.click(); return true; } return false;
})()`);
/** Money uses non-breaking spaces, so match buttons by prefix. */
const clickStartsWith = (t) => ev(`(() => {
  const el = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().startsWith(${JSON.stringify(t)}));
  if (el) { el.click(); return true; } return false;
})()`);
// Normalise non-breaking spaces so money comparisons behave.
const text = () => ev(`document.body.innerText.replace(/\\u00a0/g," ").replace(/\\s+/g," ")`);

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
await sleep(2400);

// Build a sale with no docket open, straight off the service list.
await ev(`document.querySelectorAll('[data-catalogue] li button')[0]?.click(), true`);
await sleep(1400);
check("Save button offered next to the primary", await ev(`
  Array.from(document.querySelectorAll('button')).some(b => b.textContent.trim() === 'Save')
`));
check("explains where Save puts it", /awaiting payment/i.test(await text()));
const primary = await ev(`
  Array.from(document.querySelectorAll('button')).map(b=>b.textContent.trim()).find(t=>/still owing|^Take R/.test(t))
`);
check("primary still shows the amount owing", !!primary, primary);
await shot("s1-before-save");

// Save it.
await clickExact("Save");
await sleep(1800);
const afterSave = await text();
check("confirms what was saved", /Saved —/.test(afterSave) || /Saved/.test(afterSave),
  (afterSave.match(/Saved[^.]{0,70}/) ?? [""])[0]);
check("says it is awaiting payment", /awaiting payment under Clients today/i.test(afterSave));
check("till is cleared for the next client", /Pick a service or product to start/.test(afterSave));
check("a docket chip now shows", await ev(`!!document.querySelector('[data-dockets] li')`));
await shot("s2-after-save");

// It must appear under Clients today as awaiting payment.
await clickTab("Clients today");
await sleep(1600);
// Assert against the tab's own list, not the page-wide text, so the toast
// cannot make these pass by accident.
const openList = await ev(`document.querySelector('[data-open-dockets]')?.parentElement.innerText.replace(/\\u00a0/g," ").replace(/\\s+/g," ") ?? ''`);
check("tab actually switched to Clients today", openList.length > 0, openList.slice(0, 60));
check("listed under Awaiting payment", /awaiting payment/i.test(openList));
check("row marked 'to pay'", /to pay/i.test(openList), openList.slice(0, 80));
check("pending total shown on the section header", /R\s?600/.test(openList));
const takingsUnchanged = /R 42 790/.test(await text());
check("day's takings not inflated by the pending sale", takingsUnchanged);
await shot("s3-clients-today");

// Reopen it and settle.
await ev(`(() => {
  const b = document.querySelector('[data-open-dockets] li button');
  if (b) { b.click(); return true; } return false;
})()`);
await sleep(1800);
const back = await text();
check("reopening restores the saved lines", /Cut - ladies/i.test(back) || /R 600/.test(back));
check("docket number shown on the receipt", /Docket #/i.test(back) || /#937/.test(back));
await shot("s4-reopened");

check("exact-tender button offered", await clickStartsWith("Exact R"));
await sleep(900);
await ev(`(() => {
  const b = Array.from(document.querySelectorAll('button')).find(x => /^Take R/.test(x.textContent.trim()));
  if (b) { b.click(); return true; } return false;
})()`);
await sleep(2400);
const done = await text();
check("settling it completes the sale", /Sale complete/i.test(done) || /Invoice #/i.test(done));
await shot("s5-settled");
await clickExact("Close");
await sleep(1000);
await clickTab("Clients today");
await sleep(1500);
const cleared = await text();
check("no longer awaiting payment once settled", !/awaiting payment ·/i.test(cleared));
await shot("s6-after-settle");

console.log(results.join("\n"));
console.log(`\n${results.filter(r=>r.startsWith("PASS")).length}/${results.length} passed on ${BASE}`);

ws.close();
chrome.kill();
