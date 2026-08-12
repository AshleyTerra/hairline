/** Checks the staff picker is a dropdown with Select all, and still filters. */
import { spawn } from "node:child_process";
import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9237;
const BASE = process.argv[2] ?? "http://localhost:3100";
const PROFILE = process.env.TEMP + "\\cdp-dd";
const OUT = "C:\\temp\\claude\\c--Data-OneDrive---Terra-Group-Applications-Hairline\\6305bd13-c82c-4c05-b471-9115eecd7529\\scratchpad\\dropdown";

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
  for (let i = 0; i < tries; i += 1) { if (await ev(expr)) return true; await sleep(1000); }
  return false;
}
const clickText = (t) => ev(`(() => {
  const el = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().toLowerCase().startsWith(${JSON.stringify(t)}.toLowerCase()));
  if (el) { el.click(); return true; } return false;
})()`);
const trigger = () => ev(`!!document.querySelector('button[aria-label="Staff"]')`);
const triggerText = () => ev(`document.querySelector('button[aria-label="Staff"]')?.innerText.replace(/\\s+/g," ").trim()`);
const clickTrigger = () => ev(`document.querySelector('button[aria-label="Staff"]')?.click(), true`);
const bodyRows = () => ev(`document.querySelectorAll('tbody tr').length`);

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
await send("Page.navigate", { url: BASE + "/reports" });
await sleep(3000);

// Closed by default, summarising the selection.
check("staff picker is a dropdown control", (await trigger()) === true);
const closed = await triggerText();
check("closed state summarises the choice", /All staff \(\d+\)/.test(closed ?? ""), closed);
check("checkbox list is hidden until opened",
  (await ev(`document.querySelectorAll('input[type="checkbox"]').length`)) === 0);
const criteriaHeight = await ev(`
  Math.round(document.querySelector('[aria-label="Report type"]').closest('div.flex').getBoundingClientRect().height)
`);
check("criteria row is compact", criteriaHeight < 110, `${criteriaHeight}px tall`);
await shot("dd1-closed");

// Open it.
await clickTrigger();
await sleep(900);
const boxes = await ev(`document.querySelectorAll('input[type="checkbox"]').length`);
check("opens to a checkbox list", boxes > 5, `${boxes} staff`);
check("offers Select all and Deselect all", await ev(`
  const t = document.body.innerText;
  /Select all/i.test(t) && /Deselect all/i.test(t)
`));
await shot("dd2-open");

// Deselect all, then Select all.
await clickText("Deselect all");
await sleep(1000);
const noneText = await triggerText();
check("deselect all clears the choice", /No staff chosen/i.test(noneText ?? ""), noneText);
const warned = await ev(`/at least one staff member/i.test(document.body.innerText)`);
check("warns when nothing is chosen", warned);

await clickText("Select all");
await sleep(1000);
check("select all restores everyone", /All staff \(\d+\)/.test((await triggerText()) ?? ""),
  await triggerText());
const allRows = await bodyRows();

// Choose one only, and confirm the report narrows.
await clickText("Deselect all");
await sleep(700);
await ev(`(() => {
  const cb = document.querySelector('input[aria-label="Karin M."]');
  if (!cb) return false;
  cb.click();
  return true;
})()`);
await sleep(1000);
const oneText = await triggerText();
check("choosing one shows that name", /Karin/.test(oneText ?? ""), oneText);
await ev(`document.querySelector('button[aria-label="Staff"]').click(), true`);
await sleep(1200);
const oneRows = await bodyRows();
check("report narrows to the chosen staff", oneRows === 1 && allRows > 1, `${allRows} -> ${oneRows}`);
await shot("dd3-one-staff");

// Closes on outside click.
await clickTrigger();
await sleep(600);
await ev(`document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })), true`);
await sleep(700);
check("closes when you click away",
  (await ev(`document.querySelectorAll('input[type="checkbox"]').length`)) === 0);

console.log(results.join("\n"));
console.log(`\n${results.filter(r=>r.startsWith("PASS")).length}/${results.length} passed`);

ws.close();
chrome.kill();
