/**
 * Verifies adding and editing staff from Admin, and the period filters on the
 * Team screen and a stylist's portfolio.
 */
import { spawn } from "node:child_process";
import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9243;
const BASE = process.argv[2] ?? "http://localhost:3100";
const PROFILE = process.env.TEMP + "\\cdp-staff";
const OUT =
  "C:\\temp\\claude\\c--Data-OneDrive---Terra-Group-Applications-Hairline\\6305bd13-c82c-4c05-b471-9115eecd7529\\scratchpad\\staff";

rmSync(PROFILE, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=2",
    `--remote-debugging-port=${PORT}`,
    "--user-data-dir=" + PROFILE,
    "--window-size=1440,1000",
    "about:blank",
  ],
  { stdio: "ignore" }
);

await sleep(3000);
const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));

let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m.result ?? m.error);
    pending.delete(m.id);
  }
};
const send = (method, params = {}) =>
  new Promise((res) => {
    const n = ++id;
    pending.set(n, res);
    ws.send(JSON.stringify({ id: n, method, params }));
  });
const ev = async (expr) =>
  (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }))
    ?.result?.value;
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
const clickLabel = (label) => ev(`(() => {
  const el = document.querySelector('[aria-label=' + JSON.stringify(${JSON.stringify(label)}) + ']');
  if (el) { el.click(); return true; } return false;
})()`);
/** React needs the native setter plus a bubbling input event. */
const fill = (label, value) => ev(`(() => {
  const el = document.querySelector('[aria-label=' + JSON.stringify(${JSON.stringify(label)}) + ']');
  if (!el) return false;
  const proto = el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  return true;
})()`);
const text = () => ev(`document.body.innerText.replace(/\\u00a0/g," ").replace(/\\s+/g," ")`);
/** Grain buttons are the aria-pressed row inside the period bar. */
const clickGrain = (t) => ev(`(() => {
  const el = Array.from(document.querySelectorAll('button[aria-pressed]'))
    .find(b => b.textContent.trim() === ${JSON.stringify(t)});
  if (el) { el.click(); return true; } return false;
})()`);

const results = [];
const check = (l, p, x = "") => results.push(`${p === true ? "PASS" : "FAIL"}  ${l}${x ? " — " + x : ""}`);

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
await sleep(2400);

// ------------------------------------------------------------------ adding staff
await send("Page.navigate", { url: BASE + "/admin" });
await until(`!!document.querySelector('button[aria-pressed]')`);
await sleep(1400);
await ev(`(() => {
  const t = Array.from(document.querySelectorAll('button[aria-pressed]')).find(b => /staff/i.test(b.textContent));
  if (t) { t.click(); return true; } return false;
})()`);
await sleep(1200);
const before = await ev(`document.querySelectorAll('table tbody tr').length`);
check("staff table lists the salon's people", before > 5, `${before} rows`);
check("an Add staff button is offered", await clickExact("+ Add staff"));
await sleep(800);
check("the add dialog opens", await ev(`!!document.querySelector('[role="dialog"][aria-label="Add a staff member"]')`));
await shot("s1-add-dialog");

await fill("Staff name", "Nomsa Dlamini");
await fill("Staff designation", "Stylist");
await fill("Staff email", "nope");
await fill("Staff telephone", "082 555 1234");
await clickExact("Add staff member");
await sleep(900);
check("a malformed email is refused", await ev(`
  !!document.querySelector('[role="alert"]') &&
  !!document.querySelector('[role="dialog"]')
`), (await text()).match(/does not look like[^.]{0,40}/)?.[0] ?? "");
await shot("s2-add-validation");

await fill("Staff email", "nomsa@example.co.za");
await clickExact("Add staff member");
await sleep(1200);
check("the dialog closes once the details are good",
  (await ev(`!document.querySelector('[role="dialog"]')`)) === true);
const after = await ev(`document.querySelectorAll('table tbody tr').length`);
check("the new person is on the table", after === before + 1, `${before} → ${after} rows`);
const rowText = await ev(`(() => {
  const tr = Array.from(document.querySelectorAll('table tbody tr')).find(r => /Nomsa Dlamini/.test(r.innerText));
  return tr ? tr.innerText.replace(/\\s+/g,' ') : '';
})()`);
check("their row carries designation and contact details",
  /Stylist/.test(rowText) && /nomsa@example\.co\.za/.test(rowText) && /082 555 1234/.test(rowText),
  rowText);
check("they are numbered on from the highest in use", /^\s*8[2-9]|^\s*\d{2,}/.test(rowText), rowText.slice(0, 12));
check("the change is confirmed on screen", /Nomsa Dlamini added/.test(await text()));
await shot("s3-added");

// ----------------------------------------------------------------- editing staff
check("each row offers Edit", await clickLabel("Edit Nomsa Dlamini"));
await sleep(800);
check("the edit dialog opens with their name",
  await ev(`!!document.querySelector('[role="dialog"][aria-label="Edit Nomsa Dlamini"]')`));
check("the form arrives filled in",
  (await ev(`document.querySelector('[aria-label="Staff name"]').value`)) === "Nomsa Dlamini");
check("the staff number is shown as fixed", /it stays with them/i.test(await text()));
await shot("s4-edit-dialog");
await fill("Staff name", "Nomsa D.");
await fill("Staff designation", "Apprentice");
await clickExact("Save changes");
await sleep(1200);
const edited = await ev(`(() => {
  const tr = Array.from(document.querySelectorAll('table tbody tr')).find(r => /Nomsa D\\./.test(r.innerText));
  return tr ? tr.innerText.replace(/\\s+/g,' ') : '';
})()`);
check("the edit lands on the table", /Nomsa D\./.test(edited) && /Apprentice/.test(edited), edited);
check("the row count is unchanged by an edit",
  (await ev(`document.querySelectorAll('table tbody tr').length`)) === after);
await shot("s5-edited");

// --------------------------------------------------- period filters on the team
await send("Page.navigate", { url: BASE + "/staff" });
await until(`!!document.querySelector('button[aria-pressed]')`);
await sleep(1600);
const grains = await ev(`Array.from(document.querySelectorAll('button[aria-pressed]')).map(b=>b.textContent.trim())`);
check("the team screen offers period grains",
  ["12 months", "Day", "Week", "Month", "Range"].every((g) => grains.includes(g)),
  JSON.stringify(grains));
const twelve = await text();
check("it opens on the last twelve months", /Last 12 months/.test(twelve));
const twelveMoney = (twelve.match(/R [\d ]{4,}/g) ?? []).slice(0, 3).join(" | ");
await shot("s6-team-twelve");

await clickGrain("Day");
await sleep(1500);
const day = await text();
check("switching to Day relabels the tiles", /Today/.test(day), (day.match(/Today[^·]{0,30}/) ?? [""])[0]);
const dayMoney = (day.match(/R [\d ]{4,}/g) ?? []).slice(0, 3).join(" | ");
check("the takings change with the period", dayMoney !== twelveMoney, `${twelveMoney} → ${dayMoney}`);
check("a date picker comes with the day grain",
  await ev(`!!document.querySelector('input[type="date"][aria-label="Date"]')`));
await shot("s7-team-day");

await clickGrain("Month");
await sleep(1500);
check("Month offers a month picker",
  await ev(`!!document.querySelector('input[type="month"]')`));
const month = await text();
check("the month is named on screen", /July 2026/.test(month), (month.match(/[A-Z][a-z]+ 2026/) ?? [""])[0]);
await shot("s8-team-month");

// --------------------------------------------- period filters on the portfolio
const href = await ev(`(() => {
  const a = Array.from(document.querySelectorAll('a[href^="/staff/"]'))[0];
  return a ? a.getAttribute('href') : '';
})()`);
check("a stylist portfolio is reachable from the team screen", !!href, href);
await send("Page.navigate", { url: BASE + href });
await until(`!!document.querySelector('button[aria-pressed]')`);
await sleep(1600);
const pGrains = await ev(`Array.from(document.querySelectorAll('button[aria-pressed]')).map(b=>b.textContent.trim())`);
check("the portfolio offers period grains",
  ["Day", "Week", "Month", "Range", "12 months"].every((g) => pGrains.includes(g)),
  JSON.stringify(pGrains));
const pDay = await text();
const pDayMoney = (pDay.match(/R [\d ]{3,}/g) ?? []).slice(0, 2).join(" | ");
await shot("s9-portfolio-day");
await clickGrain("12 months");
await sleep(1500);
const pTwelve = await text();
check("the portfolio period label follows the choice", /Last 12 months/.test(pTwelve));
const pTwelveMoney = (pTwelve.match(/R [\d ]{3,}/g) ?? []).slice(0, 2).join(" | ");
check("the portfolio figures follow the period", pDayMoney !== pTwelveMoney,
  `${pDayMoney} → ${pTwelveMoney}`);
await shot("s10-portfolio-twelve");

console.log(results.join("\n"));
console.log(
  `\n${results.filter((r) => r.startsWith("PASS")).length}/${results.length} passed on ${BASE}`
);

ws.close();
chrome.kill();
