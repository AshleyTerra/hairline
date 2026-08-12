/** Phase 2 and 3 acceptance checks against Karin's specification. */
import { spawn } from "node:child_process";
import { rmSync, mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9238;
const BASE = process.argv[2] ?? "http://localhost:3100";
const PROFILE = process.env.TEMP + "\\cdp-p23";
const OUT = "C:\\temp\\claude\\c--Data-OneDrive---Terra-Group-Applications-Hairline\\6305bd13-c82c-4c05-b471-9115eecd7529\\scratchpad\\p23";
const DL = OUT + "\\downloads";

rmSync(PROFILE, { recursive: true, force: true });
rmSync(DL, { recursive: true, force: true });
mkdirSync(DL, { recursive: true });

// A supplier price list with three good rows and three bad ones.
const STOCK_CSV = OUT + "\\supplier.csv";
writeFileSync(
  STOCK_CSV,
  [
    "Item,Brand,Type,Cost,Price,Reorder,Barcode",
    "Smooth Shampoo 300ml,Redken,Retail,114.86,225,3,884486063274",
    "20 Vol Chromatics 1L,Redken,Back bar,169.00,0,2,",
    "Colour Extend Conditioner,Redken,Retail,\"R 1 234,56\",1899,2,",
    ",Redken,Retail,50,100,1,",              // no name
    "Bad Price Item,Redken,Retail,50,call us,1,", // unreadable price
    "Smooth Shampoo 300ml,Redken,Retail,114.86,225,3,", // duplicate
  ].join("\n"),
  "utf8"
);

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
const text = () => ev(`document.body.innerText.replace(/\\u00a0/g," ").replace(/\\s+/g," ")`);
async function until(expr, tries = 25) {
  for (let i = 0; i < tries; i += 1) { if (await ev(expr)) return true; await sleep(1000); }
  return false;
}
const click = (t) => ev(`(() => {
  const el = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().toLowerCase().startsWith(${JSON.stringify(t)}.toLowerCase()));
  if (el) { el.click(); return true; } return false;
})()`);
const setVal = (label, v) => ev(`(() => {
  const el = document.querySelector('[aria-label=${JSON.stringify(label)}]');
  if (!el) return false;
  const proto = el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
  const d = Object.getOwnPropertyDescriptor(proto, 'value').set;
  d.call(el, ${JSON.stringify(v)});
  el.dispatchEvent(new Event('input',{bubbles:true}));
  el.dispatchEvent(new Event('change',{bubbles:true}));
  el.dispatchEvent(new Event('focusout',{bubbles:true}));
  return true;
})()`);
const rows = () => ev(`document.querySelectorAll('tbody tr').length`);

const results = [];
const check = (l, p, x = "") => results.push(`${p ? "PASS" : "FAIL"}  ${l}${x ? " - " + x : ""}`);

await send("Page.enable");
await send("Runtime.enable");
await send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: DL });

await send("Page.navigate", { url: BASE + "/" });
await until(`!!document.querySelector('input[autocomplete="username"]')`);
await ev(`(() => {
  const s=(el,v)=>{const d=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;d.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));};
  s(document.querySelector('input[autocomplete="username"]'),'owner');
  s(document.querySelector('input[type="password"]'),'hairline2026');
  document.querySelector('form').requestSubmit();
})()`);
await until(`!document.querySelector('input[autocomplete="username"]')`);
await sleep(2200);

// ===================================================== FR-012..015 item tracking
await send("Page.navigate", { url: BASE + "/reports" });
await sleep(2600);
await setVal("Report type", "itemTracking");
await sleep(2200);
const it = await text();
check("FR-012 item tracking report available", /item tracking/i.test(it));
check("FR-013 has the MySalon columns", ["invoice", "client", "staff", "dept", "department", "item", "description", "qty"]
  .every((h) => new RegExp(h, "i").test(it)));
check("FR-012 department and item selectors", await ev(`
  !!document.querySelector('[aria-label="Departments"]') && !!document.querySelector('[aria-label="Items"]')
`));
check("FR-015 stylist filter", await ev(`!!document.querySelector('select[aria-label="Stylist"]')`));
const allLines = await rows();
check("FR-013 lists sold lines", allLines > 5, `${allLines} lines`);
await shot("p2-item-tracking");

// Narrow to one stylist
await setVal("Stylist", "1");
await sleep(1800);
const byStylist = await rows();
check("FR-014 drill down by stylist", byStylist > 0 && byStylist < allLines, `${allLines} -> ${byStylist}`);

// Narrow to one department via the dropdown
await setVal("Stylist", "");
await sleep(1200);
await ev(`document.querySelector('[aria-label="Departments"]').click(), true`);
await sleep(700);
await ev(`(() => {
  const cb = document.querySelectorAll('input[type="checkbox"]')[0];
  if (cb) { cb.click(); return cb.getAttribute('aria-label'); } return null;
})()`);
await sleep(1500);
const byDept = await rows();
check("FR-012 filter by department", byDept > 0 && byDept <= allLines, `${byDept} lines`);
await click("Done");
await sleep(800);

// Export it
await click("Excel");
await sleep(2500);
const xl = existsSync(DL) ? readdirSync(DL).filter((f) => f.includes("item-tracking") && f.endsWith(".xlsx")) : [];
check("FR-008 item tracking exports to Excel", xl.length > 0, xl[0] ?? "none");

// ===================================================== FR-016..019 staff admin
await send("Page.navigate", { url: BASE + "/admin" });
await sleep(2600);
check("staff tab present", await click("Staff"));
await sleep(1800);
const st = await text();
check("FR-018 email and telephone columns", /email/i.test(st) && /telephone/i.test(st));
check("FR-019 active status column", /active/i.test(st));
check("FR-017 designations are configurable",
  /designations/i.test(st) && (await ev(`!!document.querySelector('[aria-label="New designation"]')`)));
await shot("p2-staff-admin");

await setVal("Name for staff 1", "Karin McGorian");
await sleep(1300);
check("FR-016 name can be edited", /Karin McGorian/.test(await text()));
await setVal("Email for Karin McGorian", "karin@example.co.za");
await sleep(1300);
check("FR-018 email saved", /email saved/i.test(await text()));
await setVal("Email for Karin McGorian", "not-an-email");
await sleep(1300);
check("FR-018 bad email refused", /does not look like an email/i.test(await text()));

await setVal("New designation", "Colour technician");
await sleep(500);
await click("Add");
await sleep(1300);
check("FR-017 designation added", /added colour technician/i.test(await text()));

// ===================================================== FR-020..024 stock admin
check("stock tab present", await click("Stock lines"));
await sleep(1700);
const sk = await text();
check("FR-021 spreadsheet import offered", /import a spreadsheet/i.test(sk));
check("FR-020 add one item offered", /add one item/i.test(sk));
check("FR-023 three-year filter offered", /archive inactive/i.test(sk));
await shot("p2-stock-admin");

await send("DOM.enable");
const doc = await send("DOM.getDocument");
const fileNode = await send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: 'input[type="file"]' });
await send("DOM.setFileInputFiles", { files: [STOCK_CSV], nodeId: fileNode.nodeId });
await sleep(2200);
const imp = await text();
check("FR-021 import validates row by row", /3 ready/.test(imp) && /3 skipped/.test(imp),
  (imp.match(/\d+ ready[^A-Z]{0,20}\d+ skipped/) ?? [""])[0]);
check("FR-021 explains each rejected row", /no item name/i.test(imp) && /not a price/i.test(imp) && /already listed/i.test(imp));
check("FR-021 reads SA money formatting", /1 234,56/.test(imp) || /1234.56/.test(imp));
await shot("p2-stock-import");
await click("Add 3 lines");
await sleep(1600);
check("FR-022 imported lines are kept", /lines added in this demo/i.test(await text()));

await click("Archive inactive");
await sleep(1700);
const arch = await text();
check("FR-023 lists items with no sales", /not sold in the last three years/i.test(arch));
check("FR-024 archiving explained as non-destructive", /never removes past sales/i.test(arch));
const beforeArchive = await rows();
await click("Archive all");
await sleep(1800);
const afterArchive = await text();
check("FR-024 archive all works", /archived/i.test(afterArchive), `${beforeArchive} listed`);
check("FR-024 archived items can be restored", /unarchive/i.test(afterArchive));
await shot("p2-stock-archive");

// ===================================================== FR-025..027 price menu
await send("Page.navigate", { url: BASE + "/pricing" });
await sleep(2400);
await click("Client menu");
await sleep(2000);
const pm = await text();
check("FR-026 services have tick boxes", await ev(`document.querySelectorAll('input[type="checkbox"]').length > 20`));
check("FR-026 select all and clear offered", /select all/i.test(pm) && /clear/i.test(pm));
check("FR-027 print offered", /print the menu/i.test(pm));
check("FR-025 says it folds in three", /fold in three/i.test(pm) || /three columns/i.test(pm));
check("menu carries the salon contact panel", /011 452 1852/.test(pm) && /Stoneridge/.test(pm));
await shot("p3-menu-builder");

// Deselecting a department must remove it from the preview
const deptBefore = await ev(`document.querySelectorAll('.menu-sheet section').length`);
await ev(`(() => {
  const cb = document.querySelector('input[aria-label^="All "]');
  if (cb) { cb.click(); return cb.getAttribute('aria-label'); } return null;
})()`);
await sleep(1500);
const deptAfter = await ev(`document.querySelectorAll('.menu-sheet section').length`);
check("FR-026 only chosen services appear", deptAfter < deptBefore, `${deptBefore} -> ${deptAfter} sections`);

await click("Clear");
await sleep(1200);
check("empty menu prompts rather than printing blank", /nothing chosen yet/i.test(await text()));
await click("Select all");
await sleep(1500);
check("select all restores every service", (await ev(`document.querySelectorAll('.menu-sheet section').length`)) >= deptBefore);
await shot("p3-menu-full");

console.log(results.join("\n"));
console.log(`\n${results.filter(r=>r.startsWith("PASS")).length}/${results.length} passed on ${BASE}`);

ws.close();
chrome.kill();
