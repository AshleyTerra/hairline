/** Signs in as each role from a clean profile and checks where they land. */
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9227;
const BASE = "http://localhost:3100";
const PROFILE = process.env.TEMP + "\\cdp-roles";

const results = [];

// innerText excludes placeholders and reflects CSS text-transform, so match
// against rendered copy only, case-insensitively.
for (const [user, expectPath, expectText] of [
  ["reception", "/till", "taken today"],
  ["owner", "/", "dashboard"],
  ["karin", "/", "my day"],
]) {
  rmSync(PROFILE, { recursive: true, force: true });
  const chrome = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars",
    `--remote-debugging-port=${PORT}`,
    "--user-data-dir=" + PROFILE,
    "--window-size=1280,860", "about:blank",
  ], { stdio: "ignore" });

  await sleep(2800);
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

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.navigate", { url: BASE + "/" });
  await sleep(3200);

  await evaluate(`(() => {
    const s=(el,v)=>{const d=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;d.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));};
    s(document.querySelector('input[autocomplete="username"]'),'${user}');
    s(document.querySelector('input[type="password"]'),'hairline2026');
    document.querySelector('form').requestSubmit();
  })()`);
  await sleep(2600);

  const path = await evaluate(`location.pathname`);
  const text = await evaluate(`document.body.innerText.replace(/\\s+/g,' ')`);
  const blocked = /isn't part of your role/i.test(text);
  const landed = path === expectPath;
  const rendered = text.toLowerCase().includes(expectText);

  results.push(
    `${!blocked && landed && rendered ? "PASS" : "FAIL"}  ${user.padEnd(10)} -> ${path.padEnd(8)} ` +
    `${blocked ? "BLOCKED " : ""}${rendered ? "" : "(expected text missing)"}`
  );

  ws.close();
  chrome.kill();
  await sleep(700);
}

console.log(results.join("\n"));
console.log(`\n${results.filter((r) => r.startsWith("PASS")).length}/${results.length} passed`);
