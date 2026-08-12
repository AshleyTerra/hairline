/**
 * Reproduces the reported fault: a browser holding permissions saved before
 * Reports existed. The menu must recover on load rather than hiding the screen.
 */
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9236;
const BASE = process.argv[2] ?? "http://localhost:3100";
const PROFILE = process.env.TEMP + "\\cdp-migrate";

rmSync(PROFILE, { recursive: true, force: true });
const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars",
  `--remote-debugging-port=${PORT}`, "--user-data-dir=" + PROFILE,
  "--window-size=1280,900", "about:blank",
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
async function until(expr, tries = 25) {
  for (let i = 0; i < tries; i += 1) { if (await ev(expr)) return true; await sleep(1000); }
  return false;
}

const results = [];
const check = (l, p, x = "") => results.push(`${p ? "PASS" : "FAIL"}  ${l}${x ? " - " + x : ""}`);

await send("Page.enable");
await send("Runtime.enable");

// Load once so the origin exists, then plant yesterday's stored state.
await send("Page.navigate", { url: BASE + "/" });
await until(`!!document.querySelector('input[autocomplete="username"]')`);

const OLD_SCREENS = ["dashboard", "till", "clients", "diary", "stock", "staff", "cashup", "pricing", "admin"];
await ev(`(() => {
  localStorage.setItem('hairline-demo-permissions', JSON.stringify({
    owner: ${JSON.stringify(OLD_SCREENS)},
    reception: ["till","clients","diary","stock","cashup","pricing","admin"],
    stylist: ["dashboard","clients","diary"]
  }));
  localStorage.setItem('hairline-demo-screen-keys', JSON.stringify(${JSON.stringify(OLD_SCREENS)}));
  localStorage.setItem('hairline-demo-user', JSON.stringify({
    username: 'owner', role: 'owner', displayName: 'Salon Owner'
  }));
  return true;
})()`);

// Reload as a returning owner with the stale list.
await send("Page.navigate", { url: BASE + "/" });
await sleep(4000);

const inMenu = await ev(`!!document.querySelector('a[href="/reports"]')`);
check("Reports appears for a returning owner", inMenu);

const stored = await ev(`JSON.parse(localStorage.getItem('hairline-demo-permissions')).owner.join(',')`);
check("stored permissions repaired on disk", (stored ?? "").includes("reports"), stored);

const keys = await ev(`JSON.parse(localStorage.getItem('hairline-demo-screen-keys') || '[]').length`);
check("screen list recorded for next time", keys >= 10, `${keys} keys`);

// The screen itself must open, not just the link.
await send("Page.navigate", { url: BASE + "/reports" });
await sleep(3000);
const text = await ev(`document.body.innerText.replace(/\\s+/g," ")`);
check("Reports screen opens", /Staff turnover/i.test(text) && !/isn't part of your role/i.test(text));

// Reception must still be excluded, since reports carry wage figures.
const recStored = await ev(`JSON.parse(localStorage.getItem('hairline-demo-permissions')).reception.join(',')`);
check("reception was not silently granted reports", !(recStored ?? "").includes("reports"), recStored);

console.log(results.join("\n"));
console.log(`\n${results.filter(r=>r.startsWith("PASS")).length}/${results.length} passed`);

ws.close();
chrome.kill();
