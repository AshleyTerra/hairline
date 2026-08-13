/**
 * Verifies that the team screens follow the staff records kept in Admin: a
 * person added there shows up, a designation changed there is what the rest of
 * the app calls them, and someone turned inactive drops off the floor.
 */
import { spawn } from "node:child_process";
import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9245;
const BASE = process.argv[2] ?? "http://localhost:3100";
const PROFILE = process.env.TEMP + "\\cdp-roster";
const OUT =
  "C:\\temp\\claude\\c--Data-OneDrive---Terra-Group-Applications-Hairline\\6305bd13-c82c-4c05-b471-9115eecd7529\\scratchpad\\roster";

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
const fill = (label, value) => ev(`(() => {
  const el = document.querySelector('[aria-label=' + JSON.stringify(${JSON.stringify(label)}) + ']');
  if (!el) return false;
  const proto = el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  return true;
})()`);
const text = () => ev(`document.body.innerText.replace(/\\u00a0/g," ").replace(/\\s+/g," ")`);
/** The card for one person on the team screen, as one line of text. */
const cardFor = (name) => ev(`(() => {
  const a = Array.from(document.querySelectorAll('a[href^="/staff/"]'))
    .find(x => x.innerText.includes(${JSON.stringify(name)}));
  return a ? a.innerText.replace(/\\u00a0/g," ").replace(/\\s+/g," ") : "";
})()`);
const openAdminStaff = async () => {
  await send("Page.navigate", { url: BASE + "/admin" });
  await until(`!!document.querySelector('button[aria-pressed]')`);
  await sleep(1200);
  await ev(`(() => {
    const t = Array.from(document.querySelectorAll('button[aria-pressed]')).find(b => /staff/i.test(b.textContent));
    if (t) { t.click(); return true; } return false;
  })()`);
  await sleep(1000);
};

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

// ---------------------------------------- a designation changed in Admin carries
await openAdminStaff();
check("Karin's record can be edited", await clickLabel("Edit Karin M."));
await sleep(800);
await fill("Staff designation", "Senior stylist");
await clickExact("Save changes");
await sleep(1200);
check("Admin shows the new designation", /Karin M\. Senior stylist/.test(await text()));

await send("Page.navigate", { url: BASE + "/staff" });
await until(`!!document.querySelector('a[href^="/staff/"]')`);
await sleep(1600);
const karin = await cardFor("Karin M.");
check("the team screen calls her what Admin calls her", /Senior stylist/.test(karin), karin);
check("it does not fall back to the old role label", !/^Karin M\. Stylist/.test(karin), karin);

await send("Page.navigate", { url: BASE + "/staff/1" });
await until(`!!document.querySelector('h1, [class*="text-2xl"]')`);
await sleep(1400);
check("her portfolio follows the designation too",
  /SENIOR STYLIST PORTFOLIO|Senior stylist portfolio/i.test(await text()));
await shot("r1-designation-carries");

// ------------------------------------------------- a new stylist appears at once
await openAdminStaff();
await clickExact("+ Add staff");
await sleep(800);
await fill("Staff name", "Thandi Nkosi");
await fill("Staff designation", "Junior stylist");
await fill("Staff email", "thandi@example.co.za");
await fill("Staff telephone", "083 456 7890");
await clickExact("Add staff member");
await sleep(1400);
check("the new stylist is on the Admin table", /Thandi Nkosi/.test(await text()));

await send("Page.navigate", { url: BASE + "/staff" });
await until(`!!document.querySelector('a[href^="/staff/"]')`);
await sleep(1600);
const thandi = await cardFor("Thandi Nkosi");
check("she shows on the team screen", thandi.length > 0, thandi);
check("with the designation she was given", /Junior stylist/.test(thandi), thandi);
check("and no turnover invented for her", /Newly on the books/.test(thandi) || /R 0/.test(thandi),
  thandi);
check("she is grouped with the stylists, not with support", await ev(`(() => {
  const heads = Array.from(document.querySelectorAll('h2'));
  const support = heads.find(h => /Assistants and reception/i.test(h.textContent));
  if (!support) return 'no support heading';
  const card = Array.from(document.querySelectorAll('a[href^="/staff/"]'))
    .find(x => x.innerText.includes('Thandi Nkosi'));
  if (!card) return 'no card';
  return card.compareDocumentPosition(support) & Node.DOCUMENT_POSITION_FOLLOWING ? true : 'below support';
})()`));
check("the headcount counts her", /1[3-9] active on the books/.test(await text()),
  (await text()).match(/\d+ active on the books[^.]*/)?.[0] ?? "");
await shot("r2-new-stylist-on-team");

// Her portfolio must open rather than 404, with nothing invented on it.
const href = await ev(`(() => {
  const a = Array.from(document.querySelectorAll('a[href^="/staff/"]'))
    .find(x => x.innerText.includes('Thandi Nkosi'));
  return a ? a.getAttribute('href') : '';
})()`);
check("her card links somewhere", !!href, href);
await send("Page.navigate", { url: BASE + href });
await sleep(2500);
const portfolio = await text();
check("her portfolio opens instead of 404",
  /Thandi Nkosi/.test(portfolio) && !/404|could not be found/i.test(portfolio),
  portfolio.slice(0, 90));
check("it says plainly that she has no history yet",
  /Newly on the books/i.test(portfolio));
await shot("r3-new-stylist-portfolio");

// ------------------------------------------ the till can credit and tip her now
await send("Page.navigate", { url: BASE + "/till" });
await until(`!!document.querySelector('button[aria-pressed]')`);
await sleep(1500);
await ev(`(() => {
  const t = Array.from(document.querySelectorAll('button[aria-pressed]'))
    .find(b => b.textContent.trim().toLowerCase().startsWith('services'));
  if (t) { t.click(); return true; } return false;
})()`);
await until(`!!document.querySelector('[data-catalogue] li button')`);
await sleep(900);
await ev(`document.querySelectorAll('[data-catalogue] li button')[0]?.click(), true`);
await sleep(1200);
// Open the line editor, which carries the stylist dropdown.
const opened = await ev(`(() => {
  const b = document.querySelector('button[title="Change the stylist, quantity or discount"]');
  if (b) { b.click(); return true; }
  return false;
})()`);
check("a line opens for editing", opened);
await sleep(900);
const stylistOptions = await ev(`(() => {
  const sel = Array.from(document.querySelectorAll('select'))
    .find(s => (s.getAttribute('aria-label') ?? '').startsWith('Stylist for'));
  return sel ? Array.from(sel.options).map(o => o.textContent.trim()) : [];
})()`);
check("the till can credit a line to her", (stylistOptions ?? []).includes("Thandi Nkosi"),
  JSON.stringify((stylistOptions ?? []).slice(-4)));
// Crediting the line must show her name on it, not "No stylist".
await ev(`(() => {
  const sel = Array.from(document.querySelectorAll('select'))
    .find(s => (s.getAttribute('aria-label') ?? '').startsWith('Stylist for'));
  if (!sel) return false;
  const opt = Array.from(sel.options).find(o => o.textContent.trim() === 'Thandi Nkosi');
  if (!opt) return false;
  Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(sel, opt.value);
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()`);
await sleep(1000);
const credited = await text();
check("the line shows her name once credited to her",
  /Thandi Nkosi/.test(credited) && !/No stylist/.test(credited),
  (credited.match(/Thandi Nkosi · Qty \d+/) ?? [""])[0] || "not on the line");
const tipOptions = await ev(`(() => {
  const sel = document.querySelector('[aria-label="Who is the tip for"]');
  if (!sel) {
    const add = Array.from(document.querySelectorAll('button')).find(b => /tip/i.test(b.textContent));
    if (add) add.click();
  }
  const s = document.querySelector('[aria-label="Who is the tip for"]');
  return s ? Array.from(s.options).map(o => o.textContent.trim()) : [];
})()`);
await sleep(700);
const tipsNow = await ev(`(() => {
  const s = document.querySelector('[aria-label="Who is the tip for"]');
  return s ? Array.from(s.options).map(o => o.textContent.trim()) : [];
})()`);
const tipList = (tipsNow?.length ? tipsNow : tipOptions) ?? [];
check("she can be tipped", tipList.some((t) => t.startsWith("Thandi Nkosi")),
  JSON.stringify(tipList.slice(-4)));
check("reception is still kept out of the tip list",
  !tipList.some((t) => /Ann K\./.test(t)), JSON.stringify(tipList.slice(0, 3)));
await shot("r4-till-pickers");

// --------------------------------------------- turning someone off takes them off
await openAdminStaff();
await ev(`(() => {
  const box = document.querySelector('[aria-label="Active: Thandi Nkosi"]');
  if (!box) return false;
  box.click();
  return true;
})()`);
await sleep(1200);
check("Admin confirms she is inactive", /Thandi Nkosi is now inactive/i.test(await text()));
await send("Page.navigate", { url: BASE + "/staff" });
await until(`!!document.querySelector('a[href^="/staff/"]')`);
await sleep(1600);
check("she is off the team screen once inactive", (await cardFor("Thandi Nkosi")) === "");
check("the rest of the team is untouched", (await cardFor("Karin M.")).includes("Senior stylist"));
await shot("r5-inactive-drops-off");

console.log(results.join("\n"));
console.log(
  `\n${results.filter((r) => r.startsWith("PASS")).length}/${results.length} passed on ${BASE}`
);

ws.close();
chrome.kill();
