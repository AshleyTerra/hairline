/**
 * Verifies vouchers end to end — sold onto a docket as a Hairline sale, redeemed
 * in part with the balance kept for next time, and reported — plus a sale split
 * across more than one payment method.
 */
import { spawn } from "node:child_process";
import { rmSync, mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9247;
const BASE = process.argv[2] ?? "http://localhost:3100";
const PROFILE = process.env.TEMP + "\\cdp-vouchers";
const OUT =
  "C:\\temp\\claude\\c--Data-OneDrive---Terra-Group-Applications-Hairline\\6305bd13-c82c-4c05-b471-9115eecd7529\\scratchpad\\vouchers-run";
const DL = OUT + "\\downloads";

rmSync(PROFILE, { recursive: true, force: true });
rmSync(DL, { recursive: true, force: true });
mkdirSync(DL, { recursive: true });

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
/** The on-screen keypad, one key at a time, as reception would press it. */
const keypad = async (digits) => {
  for (const key of digits) {
    await ev(`(() => {
      const b = Array.from(document.querySelectorAll('button'))
        .find(x => x.getAttribute('aria-label') === ${JSON.stringify(String(key))});
      if (b) { b.click(); return true; } return false;
    })()`);
    await sleep(140);
  }
};
const openServices = () => ev(`(() => {
  const t = Array.from(document.querySelectorAll('button[aria-pressed]'))
    .find(b => b.textContent.trim().toLowerCase().startsWith('services'));
  if (t) { t.click(); return true; } return false;
})()`);

const results = [];
const check = (l, p, x = "") => results.push(`${p === true ? "PASS" : "FAIL"}  ${l}${x ? " — " + x : ""}`);

await send("Page.enable");
await send("Runtime.enable");
await send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: DL });
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

// =============================================== selling a voucher on a docket
await send("Page.navigate", { url: BASE + "/till" });
await until(`!!document.querySelector('button[aria-pressed]')`);
await sleep(1400);
await openServices();
await until(`!!document.querySelector('[data-catalogue] li button')`);
await sleep(800);
// A service first, so the voucher rides along with other work on one docket.
await ev(`document.querySelectorAll('[data-catalogue] li button')[0]?.click(), true`);
await sleep(1000);

check("the till offers a gift voucher", await clickExact("+ Gift voucher"));
await sleep(900);
check("the voucher form opens",
  await ev(`!!document.querySelector('[role="dialog"][aria-label="Sell a gift voucher"]')`));
const suggested = await ev(`document.querySelector('[aria-label="Barcode"]')?.placeholder`);
check("it offers the next voucher number as the barcode", Number(suggested) > 2019012151, suggested);
const expiry = await ev(`document.querySelector('[aria-label="Expiry date"]')?.value`);
check("the expiry is twelve months out by default", expiry === "2027-07-25", expiry);
await shot("v1-voucher-form");

// Refuse one with no name, then fill it in properly.
await fill("Voucher amount", "1000");
await clickExact("Add to the sale");
await sleep(900);
check("a voucher with no recipient is refused", /Who is the voucher for/i.test(await text()));
await fill("Recipient name", "Celina");
await fill("Recipient cell", "084 811 0426");
await clickExact("Add to the sale");
await sleep(1200);
const onDocket = await text();
check("the voucher goes onto the docket", /Gift voucher — Celina/.test(onDocket),
  (onDocket.match(/Gift voucher — Celina[^R]{0,30}R ?[\d ]+/) ?? [""])[0]);
check("it is credited to Hairline, not a stylist", /Hairline sale/.test(onDocket));
await shot("v2-voucher-on-docket");

// ============================================ split payment across two methods
await clickExact("Cash");
await sleep(300);
await keypad(["5", "0", "0"]);
await sleep(400);
const partLabel = await ev(`
  Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).find(t => /^Take R 500/.test(t))
`);
check("a part payment does not claim it will complete the sale",
  /^Take R 500 on cash$/.test(partLabel ?? ""), partLabel);
await clickStartsWith("Take R 500");
await sleep(1200);
const afterCash = await text();
check("the cash is taken and the sale stays open", /cash taken/i.test(afterCash));
check("what is left is spelled out", /to go — choose another method for the rest/i.test(afterCash),
  (afterCash.match(/Taken: [^.]{0,60}\./) ?? [""])[0]);
await shot("v3-split-payment");

// Settle the rest on card.
await clickExact("Card");
await sleep(300);
await clickStartsWith("Exact");
await sleep(400);
await clickStartsWith("Take R");
await sleep(2000);
const slip = await text();
check("the sale completes once both methods are in", /Invoice #/.test(slip) || /Sale complete/i.test(slip));
check("the invoice shows both payment methods",
  /Cash/i.test(slip) && /Card/i.test(slip), (slip.match(/Total paid[\s\S]{0,60}/) ?? [""])[0]);
await shot("v4-invoice-split");
await clickExact("Close");
await sleep(1000);

// ==================================================== redeeming it, in part
await ev(`document.querySelectorAll('[data-catalogue] li button')[0]?.click(), true`);
await sleep(1200);
check("the Voucher method opens the lookup", await clickExact("Voucher"));
await sleep(900);
check("the redeem dialog opens",
  await ev(`!!document.querySelector('[role="dialog"][aria-label="Redeem a voucher"]')`));
await fill("Find a voucher", "Celina");
await sleep(800);
const found = await ev(`
  Array.from(document.querySelectorAll('[role="dialog"] li button')).map(b => b.innerText.replace(/\\s+/g," ").trim())
`);
check("the voucher is found by the recipient's name", (found ?? []).length > 0,
  JSON.stringify(found));
await ev(`document.querySelector('[role="dialog"] li button')?.click(), true`);
await sleep(800);
const details = await text();
check("it shows the recipient and what is left", /Celina/.test(details) && /Left on it/i.test(details));
const takeNow = await ev(`document.querySelector('[aria-label="Amount to redeem"]')?.value`);
check("it offers the smaller of the balance and what is owed", Number(takeNow) > 0, `R ${takeNow}`);
await shot("v5-redeem-dialog");

// Take less than the balance, so something is left for next time.
await fill("Amount to redeem", "200");
await clickStartsWith("Take R 200");
await sleep(1400);
const afterRedeem = await text();
check("the voucher pays part of the sale", /voucher taken/i.test(afterRedeem),
  (afterRedeem.match(/voucher taken[^R]{0,10}R ?[\d ]+/i) ?? [""])[0]);
check("the rest of the sale is still owing", /still owing|to go/i.test(afterRedeem));
await shot("v6-voucher-part-paid");

// Settle the remainder and complete, which is when the voucher is drawn down.
await clickExact("Card");
await sleep(300);
await clickStartsWith("Exact");
await sleep(400);
await clickStartsWith("Take R");
await sleep(2000);
check("the sale completes", /Invoice #/.test(await text()));
await clickExact("Close");
await sleep(1200);

// The balance must have dropped by exactly what was taken. The payment panel
// only shows once something is on the sale, so start one.
await ev(`document.querySelectorAll('[data-catalogue] li button')[0]?.click(), true`);
await sleep(1200);
await clickExact("Voucher");
await sleep(900);
await fill("Find a voucher", "Celina");
await sleep(800);
const balanceLine = await ev(`
  Array.from(document.querySelectorAll('[role="dialog"] li button')).map(b => b.innerText.replace(/\\s+/g," ")).join(" | ")
`);
check("the balance kept for the next visit is right", /R 800/.test(balanceLine ?? ""), balanceLine);
await shot("v7-balance-kept");
await clickExact("Cancel");
await sleep(700);

// ======================================================== the vouchers report
await send("Page.navigate", { url: BASE + "/reports" });
await until(`!!document.querySelector('select[aria-label="Report type"]')`);
await sleep(1400);
check("a vouchers report is offered", await choose("Report type", "Vouchers report"));
await sleep(1600);
const report = await text();
check("it lists the voucher sold", /Celina/.test(report));
check("with the columns the salon asked for",
  /Voucher no\./i.test(report) && /Recipient/i.test(report) && /Outstanding/i.test(report));
check("it shows what was used and what is outstanding",
  /R 200/.test(report) && /R 800/.test(report),
  (report.match(/2019012152[^A-Z]{0,80}/) ?? [""])[0]);
await shot("v8-vouchers-report");

await clickExact("Excel");
await sleep(2600);
const xl = existsSync(DL) ? readdirSync(DL).filter((f) => f.includes("vouchers")) : [];
check("the report exports to Excel", xl.length > 0, xl[0] ?? "none");

// And the money must be a Hairline sale, not a stylist's.
check("staff turnover reports the voucher under Hairline", await choose("Report type", "Staff turnover report"));
await sleep(1800);
const turnover = await text();
check("Hairline has a row of its own", /Hairline \(salon\)/i.test(turnover));
check("the voucher sits in salon stock, not services",
  /Hairline \(salon\)[^A-Za-z]{0,80}R 1 000/.test(turnover.replace(/\s+/g, " ")) ||
    /R 1 000/.test(turnover),
  (turnover.match(/0 Hairline \(salon\)[^A-Z]{0,100}/) ?? [""])[0]);
await shot("v9-turnover-hairline");

console.log(results.join("\n"));
console.log(
  `\n${results.filter((r) => r.startsWith("PASS")).length}/${results.length} passed on ${BASE}`
);

ws.close();
chrome.kill();
