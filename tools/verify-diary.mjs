/**
 * Verifies the diary as a booking page: pick a day, filter to a stylist, click a
 * free slot to book, refuse a double booking, take the client to the till as a
 * docket, and cancel — with and without a charge.
 */
import { spawn } from "node:child_process";
import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9246;
const BASE = process.argv[2] ?? "http://localhost:3100";
const PROFILE = process.env.TEMP + "\\cdp-diary";
const OUT =
  "C:\\temp\\claude\\c--Data-OneDrive---Terra-Group-Applications-Hairline\\6305bd13-c82c-4c05-b471-9115eecd7529\\scratchpad\\diary";

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
    "--window-size=1600,1100",
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
const clickStartsWith = (t) => ev(`(() => {
  const el = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().startsWith(${JSON.stringify(t)}));
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
/** Picks a select option by its visible text. */
const choose = (label, text) => ev(`(() => {
  const sel = document.querySelector('[aria-label=' + JSON.stringify(${JSON.stringify(label)}) + ']');
  if (!sel) return false;
  const opt = Array.from(sel.options).find(o => o.textContent.trim() === ${JSON.stringify(text)});
  if (!opt) return false;
  Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(sel, opt.value);
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()`);
const text = () => ev(`document.body.innerText.replace(/\\u00a0/g," ").replace(/\\s+/g," ")`);
/** Clicks a column at a given number of minutes past opening. */
const clickSlot = (columnIndex, minutesPastOpen) => ev(`(() => {
  const cols = Array.from(document.querySelectorAll('[title^="Click to book with"]'));
  const col = cols[${columnIndex}];
  if (!col) return false;
  const box = col.getBoundingClientRect();
  col.dispatchEvent(new MouseEvent('click', {
    bubbles: true,
    clientX: box.left + box.width / 2,
    clientY: box.top + ${minutesPastOpen} * 1.15,
  }));
  return true;
})()`);

const results = [];
const check = (l, p, x = "") => results.push(`${p === true ? "PASS" : "FAIL"}  ${l}${x ? " — " + x : ""}`);

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

// ------------------------------------------------------------------ the day view
await send("Page.navigate", { url: BASE + "/diary" });
await until(`!!document.querySelector('[title^="Click to book with"]')`);
await sleep(1500);
const opening = await text();
check("opens on the demo day", /Saturday, 25 July 2026/.test(opening));
check("says where the day came from", /reconstructed from the day's invoices|the day's own invoices/i.test(opening));
check("a date picker is offered", await ev(`!!document.querySelector('input[type="date"][aria-label="Date"]')`));
check("a stylist filter is offered", await ev(`!!document.querySelector('select[aria-label="Stylist"]')`));
check("quarter-hour lines are drawn", await ev(`
  document.querySelectorAll('[title^="Click to book with"]')[0].children.length > 40
`), await ev(`String(document.querySelectorAll('[title^="Click to book with"]')[0].children.length)`));
const columnCount = await ev(`document.querySelectorAll('[title^="Click to book with"]').length`);
check("a column per stylist", columnCount >= 6, `${columnCount} columns`);
await shot("dy1-day-view");

// ------------------------------------------------------------- moving the day on
await clickExact("→");
await sleep(1400);
check("the next day is reachable", /Sunday, 26 July 2026/.test(await text()));
check("a day past the demo day has nothing invoiced",
  /Ahead of the demo day/i.test(await text()));
check("Today comes back", await clickExact("Today"));
await sleep(1200);
check("and lands on the demo day", /Saturday, 25 July 2026/.test(await text()));
await ev(`(() => {
  const el = document.querySelector('input[aria-label="Date"]');
  const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
  d.call(el, '2026-06-13');
  el.dispatchEvent(new Event('change',{bubbles:true}));
  return true;
})()`);
await sleep(1600);
const june = await text();
check("an older day is rebuilt from its invoices", /June 2026/.test(june) && /appointment/.test(june),
  (june.match(/\d+ appointments?/) ?? [""])[0]);
await shot("dy2-past-day");
await clickExact("Today");
await sleep(1300);

// ------------------------------------------------------ filtering to one stylist
await choose("Stylist", "Karin M.");
await sleep(1300);
check("filtering leaves one column",
  (await ev(`document.querySelectorAll('[title^="Click to book with"]').length`)) === 1);
check("and it is the one chosen", await ev(`
  document.querySelector('[title^="Click to book with"]').getAttribute('title').includes('Karin M.')
`));
await shot("dy3-one-stylist");
await choose("Stylist", "All stylists");
await sleep(1200);

// -------------------------------------------------------------- taking a booking
await clickSlot(0, 90 + 7); // the middle of the 08:30 slot in the first column
await sleep(1000);
check("clicking a free slot opens the booking form",
  await ev(`!!document.querySelector('[role="dialog"][aria-label="Book an appointment"]')`));
check("the form arrives on the slot that was clicked",
  (await ev(`document.querySelector('[aria-label="Start time"]')?.value`)) === "08:30",
  await ev(`document.querySelector('[aria-label="Start time"]')?.value`));
await fill("Client", "Osman");
await sleep(900);
const matched = await ev(`
  Array.from(document.querySelectorAll('[role="dialog"] li button')).map(b => b.innerText.split("\\n")[0]).slice(0,3)
`);
check("it searches the client file", (matched ?? []).length > 0, JSON.stringify(matched));
await ev(`document.querySelector('[role="dialog"] li button')?.click(), true`);
await sleep(700);
await choose("Service", "Cut - ladies");
await sleep(500);
check("the chair time follows the service",
  Number(await ev(`document.querySelector('[aria-label="Duration"]')?.value`)) >= 15,
  await ev(`document.querySelector('[aria-label="Duration"]')?.value + " min"`));
await shot("dy4-booking-form");
await clickExact("Book it");
await sleep(1500);
const booked = await text();
check("the booking is confirmed", /booked with/i.test(booked),
  (booked.match(/[A-Za-z .']+ booked with [^.]+\./) ?? [""])[0]);
check("it is drawn on the diary", await ev(`
  Array.from(document.querySelectorAll('[title^="08:30"]')).length > 0
`));
check("the day counts it", /1 booked here/.test(booked));
await shot("dy5-booked");

// ----------------------------------------------------------- refusing a clash
await clickSlot(0, 105 + 7); // 08:45, inside the new booking
await sleep(1000);
await fill("Client", "Someone else");
await clickExact("Book it");
await sleep(1200);
const refused = await text();
check("a double booking is refused", /already booked/i.test(refused),
  (refused.match(/Already booked:[^"]{0,60}/) ?? [""])[0]);
check("and it names who has the slot", /Already booked: [A-Za-z]/.test(refused));
await shot("dy6-clash-refused");
await clickExact("Cancel");
await sleep(800);

// --------------------------------------------------- arriving: docket at the till
/** The booked block carries its time in the title. */
const openBooked = () => ev(`(() => {
  const b = Array.from(document.querySelectorAll('button[title]'))
    .find(x => (x.getAttribute('title') ?? '').startsWith('08:30'));
  if (b) { b.click(); return true; } return false;
})()`);
check("the booking can be opened from the diary", await openBooked());
await sleep(1000);
check("the booking opens its own details",
  await ev(`!!document.querySelector('[role="dialog"][aria-label="Appointment details"]')`));
check("it is marked as not yet rung up", /Booked, not yet rung up/i.test(await text()));
await shot("dy7-booking-details");
check("arrival opens a docket", await clickStartsWith("Arrived"));
const atTheTill = await until(`location.pathname === '/till'`, 12);
check("it takes reception to the till", atTheTill, await ev(`location.pathname`));
await sleep(2200);
const till = await text();
check("the till has the client on a docket", atTheTill && /Osman|Walk-in/.test(till));
check("with the booked service already on it", atTheTill && /Cut - ladies/i.test(till),
  (till.match(/Cut - ladies[^R]{0,20}R ?[\d ]+/) ?? [""])[0]);
await shot("dy8-docket-at-till");

// ------------------------------------------- cancelling takes the docket with it
await send("Page.navigate", { url: BASE + "/diary" });
await until(`!!document.querySelector('[title^="Click to book with"]')`);
await sleep(1600);
await ev(`(() => {
  const b = Array.from(document.querySelectorAll('button')).find(x => (x.getAttribute('title') ?? '').startsWith('08:30'));
  if (b) { b.click(); return true; } return false;
})()`);
await sleep(1000);
await clickExact("Cancel booking");
await sleep(900);
check("cancelling asks first",
  await ev(`!!document.querySelector('[role="dialog"][aria-label="Cancel the booking"]')`));
check("it warns that the docket goes too", /docket is open at the till/i.test(await text()));
check("a cancellation fee can be charged",
  await ev(`!!document.querySelector('[aria-label="Charge a cancellation fee"]')`));
await ev(`document.querySelector('[aria-label="Charge a cancellation fee"]').click(), true`);
await sleep(600);
const fee = await ev(`document.querySelector('[aria-label="Cancellation fee"]')?.value`);
check("the fee is suggested at half the service", Number(fee) > 0, `R ${fee}`);
await shot("dy9-cancel-dialog");
check("the button says what it will charge", await clickStartsWith("Cancel and charge"));
await sleep(1600);
const cancelled = await text();
check("the cancellation is confirmed", /cancelled/i.test(cancelled),
  (cancelled.match(/[A-Za-z .']+booking cancelled[^.]*\./) ?? [""])[0]);
check("the fee is said to be awaiting payment", /awaiting payment/i.test(cancelled));
check("the booking is off the diary", await ev(`
  Array.from(document.querySelectorAll('button')).every(b => !(b.getAttribute('title') ?? '').startsWith('08:30'))
`));
await shot("dy10-cancelled");

// The fee must be sitting at the till, and the client's own docket gone.
await send("Page.navigate", { url: BASE + "/till" });
await until(`!!document.querySelector('button[aria-pressed]')`);
await sleep(1800);
const docketChips = await ev(`
  Array.from(document.querySelectorAll('[data-dockets] li')).map(li => li.innerText.replace(/\\s+/g,' '))
`);
check("the client's own docket was closed with the booking",
  (docketChips ?? []).length === 1, JSON.stringify(docketChips));
check("the fee did not take the cancelled docket's number",
  !(docketChips ?? []).some((c) => c.includes("#93711")), JSON.stringify(docketChips));
// Open the fee docket to see what it is actually charging for.
await ev(`document.querySelector('[data-dockets] li button')?.click(), true`);
await sleep(1400);
const atTill = await text();
check("the cancellation fee is on a docket", /Cancellation fee/i.test(atTill),
  (atTill.match(/Cancellation fee[^R]{0,40}R ?[\d ]+/) ?? [""])[0]);
check("and it says which appointment was missed", /Cancellation fee — Cut - ladies/i.test(atTill));
await shot("dy11-fee-at-till");

console.log(results.join("\n"));
console.log(
  `\n${results.filter((r) => r.startsWith("PASS")).length}/${results.length} passed on ${BASE}`
);

ws.close();
chrome.kill();
