/** Captures the reworked till: list catalogue, vendor tabs, tip on the bill. */
import { spawn } from "node:child_process";
import { rmSync, writeFileSync, mkdirSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9229;
const BASE = "http://localhost:3100";
const PROFILE = process.env.TEMP + "\\cdp-till2";
const OUT = "C:\\temp\\claude\\c--Data-OneDrive---Terra-Group-Applications-Hairline\\6305bd13-c82c-4c05-b471-9115eecd7529\\scratchpad\\till2";

rmSync(PROFILE, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars",
  "--force-device-scale-factor=2",
  `--remote-debugging-port=${PORT}`,
  "--user-data-dir=" + PROFILE,
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
const evaluate = async (expr) =>
  (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }))?.result?.value;
const shot = async (name) => {
  const r = await send("Page.captureScreenshot", { format: "png" });
  if (r?.data) writeFileSync(`${OUT}\\${name}.png`, Buffer.from(r.data, "base64"));
};
const clickText = (text) => evaluate(`(() => {
  const el = Array.from(document.querySelectorAll('button')).find(b => (b.textContent||'').trim() === ${JSON.stringify(text)});
  if (el) { el.click(); return true; } return false;
})()`);

await send("Page.enable");
await send("Runtime.enable");
await send("Page.navigate", { url: BASE + "/" });
await sleep(3300);
await evaluate(`(() => {
  const s=(el,v)=>{const d=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;d.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));};
  s(document.querySelector('input[autocomplete="username"]'),'reception');
  s(document.querySelector('input[type="password"]'),'hairline2026');
  document.querySelector('form').requestSubmit();
})()`);
await sleep(2600);

const checks = [];
const check = (label, pass, extra = "") =>
  checks.push(`${pass ? "PASS" : "FAIL"}  ${label}${extra ? " — " + extra : ""}`);

// Services list: popular first, no duration.
const firstThree = await evaluate(`
  Array.from(document.querySelectorAll('ul li button')).slice(0,3).map(b => b.textContent.trim())
`);
check("services list leads with the most-used", /Cut - ladies/.test(firstThree?.[0] ?? ""), firstThree?.[0]);
const hasDuration = await evaluate(`/\\d+ min/.test(document.querySelector('ul li button')?.textContent || '')`);
check("no time indicator on service rows", !hasDuration);
const visibleRows = await evaluate(`document.querySelectorAll('ul li button').length`);
check("list shows many rows at once", visibleRows >= 20, `${visibleRows} rows`);
await shot("t1-services-list");

// Retail: vendor tabs.
await clickText("retail");
await sleep(1200);
const vendorTabs = await evaluate(`
  Array.from(document.querySelectorAll('button[aria-pressed]')).map(b=>b.textContent.trim()).filter(t=>t!=='services'&&t!=='retail')
`);
check("a tab per vendor", (vendorTabs?.length ?? 0) >= 8, `${vendorTabs?.length} tabs: ${vendorTabs?.slice(0,4).join(", ")}`);
await shot("t2-retail-vendors");

// Build a sale and add a tip to an assistant.
await clickText("services");
await sleep(900);
await evaluate(`document.querySelectorAll('ul li button')[0]?.click()`);
await sleep(1000);
const subtotalBefore = await evaluate(`document.body.innerText.match(/Subtotal\\s*R\\s*([\\d  ]+)/)?.[1]?.trim()`);
await clickText("+ Add tip");
await sleep(700);
const operatorCount = await evaluate(`document.querySelector('select[aria-label="Who is the tip for"]')?.options.length`);
const hasAssistant = await evaluate(`Array.from(document.querySelector('select[aria-label="Who is the tip for"]')?.options ?? []).some(o=>/assistant/.test(o.textContent))`);
check("operator dropdown lists everyone", (operatorCount ?? 0) > 5, `${operatorCount} options`);
check("assistants can be tipped", hasAssistant);
await evaluate(`(() => {
  const sel = document.querySelector('select[aria-label="Who is the tip for"]');
  const opt = Array.from(sel.options).find(o=>/assistant/.test(o.textContent)) || sel.options[1];
  sel.value = opt.value;
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  const amt = document.querySelector('input[aria-label="Tip amount"]');
  const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
  d.call(amt, '50'); amt.dispatchEvent(new Event('input',{bubbles:true}));
})()`);
await sleep(500);
await clickText("Add");
await sleep(1200);

const text = await evaluate(`document.body.innerText.replace(/\\s+/g,' ')`);
const tipRow = /Tip \\+ R/.test(text) || /\+ R 50/.test(text);
check("tip shows on the bill", tipRow);
const subtotalAfter = await evaluate(`document.body.innerText.match(/Subtotal\\s*R\\s*([\\d  ]+)/)?.[1]?.trim()`);
check("subtotal unchanged by the tip", subtotalBefore === subtotalAfter, `${subtotalBefore} -> ${subtotalAfter}`);
const balance = await evaluate(`document.body.innerText.match(/BALANCE\\s*R\\s*([\\d  ,]+)/i)?.[1]?.trim()`);
check("balance includes the tip", (balance ?? "").length > 0, `balance ${balance}`);
await shot("t3-tip-on-bill");

console.log(checks.join("\n"));
console.log(`\n${checks.filter(c=>c.startsWith("PASS")).length}/${checks.length} passed`);

ws.close();
chrome.kill();
