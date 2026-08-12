/**
 * Verifies the printed output: an invoice arrives on one sheet with no app
 * chrome around it, the price menu is a landscape tri-fold with no blank
 * leading sheet, and a report prints as the table alone.
 *
 * Real PDFs are generated with Page.printToPDF, so the sheet counts are the
 * browser's, not a guess from the DOM.
 */
import { spawn } from "node:child_process";
import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9241;
const BASE = process.argv[2] ?? "http://localhost:3100";
const PROFILE = process.env.TEMP + "\\cdp-print";
const OUT =
  "C:\\temp\\claude\\c--Data-OneDrive---Terra-Group-Applications-Hairline\\6305bd13-c82c-4c05-b471-9115eecd7529\\scratchpad\\print";

rmSync(PROFILE, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
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
const clickStartsWith = (t) => ev(`(() => {
  const el = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().startsWith(${JSON.stringify(t)}));
  if (el) { el.click(); return true; } return false;
})()`);
const clickExact = (t) => ev(`(() => {
  const el = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === ${JSON.stringify(t)});
  if (el) { el.click(); return true; } return false;
})()`);

/**
 * A PDF's sheet count, read from the page tree. Chrome writes /Type /Page in
 * plain object headers, so counting them is exact; the /Count fallback covers
 * a compressed tree.
 */
function sheetCount(buffer) {
  const raw = buffer.toString("latin1");
  const pages = (raw.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  if (pages > 0) return pages;
  const count = raw.match(/\/Type\s*\/Pages[\s\S]{0,200}?\/Count\s+(\d+)/);
  return count ? Number(count[1]) : -1;
}

/** Prints to PDF, saves it, and reports sheets plus orientation. */
async function pdf(name, landscape) {
  const r = await send("Page.printToPDF", {
    printBackground: false,
    landscape,
    preferCSSPageSize: true,
  });
  if (!r?.data) return { sheets: -1, error: r?.message ?? "no data" };
  const buf = Buffer.from(r.data, "base64");
  writeFileSync(`${OUT}\\${name}.pdf`, buf);
  const box = buf.toString("latin1").match(/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)/);
  return {
    sheets: sheetCount(buf),
    kb: Math.round(buf.length / 1024),
    wide: box ? Number(box[1]) > Number(box[2]) : null,
  };
}

/** What the browser would actually paint, with print media emulated. */
const printMedia = (on) =>
  send("Emulation.setEmulatedMedia", on ? { media: "print" } : { media: "" });

/**
 * Whether an element puts anything on the page. Computed style is no use here —
 * a child of a `display: none` parent still reports its own display — so this
 * asks for boxes instead, which a hidden ancestor removes.
 */
const gone = (sel) => ev(`(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  if (!el) return "missing";
  if (el.getClientRects().length > 0) {
    const r = el.getBoundingClientRect();
    return "still drawn " + Math.round(r.width) + "x" + Math.round(r.height);
  }
  return true;
})()`);

/** Tabs carry badge counts, so match on the start of the label. */
const clickTab = (t) => ev(`(() => {
  const el = Array.from(document.querySelectorAll('button[aria-pressed]'))
    .find(b => b.textContent.trim().toLowerCase().startsWith(${JSON.stringify(t.toLowerCase())}));
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

// ---------------------------------------------------------------- the invoice
await send("Page.navigate", { url: BASE + "/till" });
await until(`!!document.querySelector('button[aria-pressed]')`);
await sleep(1500);
// The till opens on Clients today; the service list is a tab away.
await clickTab("services");
await until(`!!document.querySelector('[data-catalogue] li button')`);
await sleep(900);
await ev(`document.querySelectorAll('[data-catalogue] li button')[0]?.click(), true`);
await sleep(1200);
await clickStartsWith("Exact R");
await sleep(700);
await ev(`(() => {
  const b = Array.from(document.querySelectorAll('button')).find(x => /^Take R/.test(x.textContent.trim()));
  if (b) { b.click(); return true; } return false;
})()`);
const gotSlip = await until(`!!document.querySelector('.print-target')`, 15);
check("invoice slip opens after taking payment", gotSlip);

await printMedia(true);
await sleep(600);
check("the print target is the invoice", await ev(`
  (document.querySelector('.print-target')?.innerText ?? '').includes('Hairline') &&
  /INVOICE|Invoice/.test(document.querySelector('.print-target')?.innerText ?? '')
`));
check("left rail does not print", (await gone("aside")) === true, String(await gone("aside")));
check("the slip's own Print/Close buttons do not print",
  (await gone(".print-target .no-print")) === true, String(await gone(".print-target .no-print")));
check("the till behind the slip does not print",
  (await ev(`(() => {
    const cat = document.querySelector('[data-catalogue]');
    if (!cat) return 'missing';
    return cat.getClientRects().length === 0 || getComputedStyle(cat).display === 'none';
  })()`)) === true);
await shot("p1-invoice-print-preview");
const inv = await pdf("invoice", false);
check("invoice fits on one sheet", inv.sheets === 1, `${inv.sheets} sheet(s), ${inv.kb} KB`);
check("invoice prints portrait", inv.wide === false, inv.wide === null ? "no MediaBox" : "");
await printMedia(false);
await sleep(400);
await clickExact("Close");
await sleep(800);

// ------------------------------------- a past invoice, reopened from the daybook
await clickTab("Clients today");
await sleep(1600);
const reopened = await ev(`(() => {
  const b = Array.from(document.querySelectorAll('button')).find(x => /#\\d{5}\\s*$/.test(x.textContent.trim()));
  if (b) { b.click(); return true; } return false;
})()`);
check("a completed sale opens its invoice from Clients today", reopened);
await until(`!!document.querySelector('.print-target')`, 12);
await printMedia(true);
await sleep(600);
check("the reopened invoice prints without the day's list",
  (await ev(`(() => {
    const list = document.querySelector('[data-daybook], table');
    if (!list) return true;
    return list.closest('.print-target') ? true : list.getClientRects().length === 0;
  })()`)) === true);
check("no app chrome around the reopened invoice",
  (await gone("aside")) === true, String(await gone("aside")));
const past = await pdf("invoice-reopened", false);
check("the reopened invoice fits on one sheet", past.sheets === 1,
  `${past.sheets} sheet(s), ${past.kb} KB`);
await shot("p1b-reopened-invoice");
await printMedia(false);
await sleep(400);
await clickExact("Close");
await sleep(700);

// --------------------------------------------------------------- the price menu
await send("Page.navigate", { url: BASE + "/pricing" });
await until(`!!document.querySelector('button[aria-pressed]')`);
await sleep(1200);
check("the client menu tab is reachable", await clickTab("Client menu"));
await until(`!!document.querySelector('.menu-sheet')`);
await sleep(1500);
await printMedia(true);
await sleep(700);
check("menu columns become a tri-fold on paper", await ev(`
  getComputedStyle(document.querySelector('.menu-columns')).columnCount === '3'
`), await ev(`getComputedStyle(document.querySelector('.menu-columns')).columnCount`));
check("the menu builder's controls do not print",
  (await ev(`(() => {
    const c = Array.from(document.querySelectorAll('.no-print')).filter(e => !e.closest('.print-target'));
    return c.length === 0 || c.every(e => getComputedStyle(e).display === 'none');
  })()`)) === true);
check("no app chrome above the menu", (await gone("aside")) === true, String(await gone("aside")));
await shot("p2-menu-print-preview");
const menu = await pdf("price-menu", false);
check("menu is two sheets — front tri-fold and back panel", menu.sheets === 2,
  `${menu.sheets} sheet(s), ${menu.kb} KB`);
check("menu prints landscape", menu.wide === true, menu.wide === null ? "no MediaBox" : "");
await printMedia(false);
await sleep(400);

// ------------------------------------------------------------------- a report
await send("Page.navigate", { url: BASE + "/reports" });
await until(`!!document.querySelector('.print-target table')`);
await sleep(1500);
await printMedia(true);
await sleep(700);
check("the report table is the print target", await ev(`
  !!document.querySelector('.print-target table tbody tr')
`));
check("the report toolbar and filters do not print",
  (await ev(`(() => {
    const c = Array.from(document.querySelectorAll('.no-print')).filter(e => !e.closest('.print-target'));
    return c.length === 0 || c.every(e => getComputedStyle(e).display === 'none');
  })()`)) === true);
check("no app chrome around the report", (await gone("aside")) === true, String(await gone("aside")));
check("table headings repeat across sheets", await ev(`
  getComputedStyle(document.querySelector('.print-target thead')).display === 'table-header-group'
`));
await shot("p3-report-print-preview");
const rep = await pdf("report", false);
check("report prints landscape", rep.wide === true, rep.wide === null ? "no MediaBox" : "");
check("report sheet count is sane", rep.sheets >= 1 && rep.sheets <= 6,
  `${rep.sheets} sheet(s), ${rep.kb} KB`);
await printMedia(false);

console.log(results.join("\n"));
console.log(
  `\n${results.filter((r) => r.startsWith("PASS")).length}/${results.length} passed on ${BASE}`
);
console.log(`PDFs in ${OUT}`);

ws.close();
chrome.kill();
