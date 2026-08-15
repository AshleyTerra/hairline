/**
 * HF-06 and AC-10: routine stock maintenance on the Stock screen — adding a
 * line, correcting a brand, a price and a barcode — and the change showing up
 * in the till's own search, which is the point of doing it there.
 */
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9245;
const BASE = process.argv[2] ?? "http://localhost:3100";
const PROFILE = process.env.TEMP + "\\cdp-stock";
const OUT =
  "C:\\temp\\claude\\c--Data-OneDrive---Terra-Group-Applications-Hairline" +
  "\\6305bd13-c82c-4c05-b471-9115eecd7529\\scratchpad\\stock";

rmSync(PROFILE, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

/** Distinctive enough that nothing in the migrated file can match it. */
const NEW_ITEM = "Zzz Test Bond Builder 250ml";
const NEW_BARCODE = "600555444333";

const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=2",
  `--remote-debugging-port=${PORT}`, "--user-data-dir=" + PROFILE,
  "--window-size=1440,1000", "about:blank",
], { stdio: "ignore" });

const results = [];
const check = (l, p, x = "") => results.push(`${p ? "PASS" : "FAIL"}  ${l}${x ? " — " + x : ""}`);

try {
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
  const until = async (expr, tries = 25) => {
    for (let i = 0; i < tries; i += 1) { if (await ev(expr)) return true; await sleep(1000); }
    return false;
  };
  const text = () => ev(`document.body.innerText.replace(/\\u00a0/g," ").replace(/\\s+/g," ")`);
  const clickExact = (t) => ev(`(() => {
    const el = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === ${JSON.stringify(t)});
    if (el) { el.click(); return true; } return false;
  })()`);
  const setField = (label, value) => ev(`(() => {
    const el = document.querySelector('[role="dialog"] [aria-label=' + JSON.stringify(${JSON.stringify(label)}) + ']');
    if (!el) return false;
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(String(value))});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  const signIn = async (who) => {
    await send("Page.navigate", { url: BASE + "/" });
    await until(`!!document.body`);
    await ev(`(() => { try { localStorage.removeItem('hairline-demo-user'); } catch {} return true; })()`);
    await send("Page.reload");
    await until(`!!document.querySelector('input[autocomplete="username"]')`);
    await ev(`(() => {
      const s=(el,v)=>{const d=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;d.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));};
      s(document.querySelector('input[autocomplete="username"]'),${JSON.stringify(who)});
      s(document.querySelector('input[type="password"]'),'hairline2026');
      document.querySelector('form').requestSubmit();
    })()`);
    await until(`!document.querySelector('input[autocomplete="username"]')`);
    await sleep(2000);
  };
  const search = async (term) => {
    await ev(`(() => {
      const el = document.querySelector('input[type="search"]');
      if (!el) return false;
      const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
      d.call(el, ${JSON.stringify(term)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    await sleep(1200);
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await signIn("reception");

  // -------------------------------------------------- maintenance is offered
  await send("Page.navigate", { url: BASE + "/stock" });
  await until(`/Stock control/i.test(document.body.innerText)`);
  await sleep(1200);
  check("reception can add a stock item without going to Admin", await ev(`
    Array.from(document.querySelectorAll('button')).some(b => b.textContent.trim() === '+ Add item')
  `));
  check("and can edit a line in place", await ev(`
    Array.from(document.querySelectorAll('button')).some(b => /^Edit /.test(b.getAttribute('aria-label') || ''))
  `));
  await shot("s1-stock");

  // ------------------------------------------------------------ adding a line
  await clickExact("+ Add item");
  check("the add form opens", await until(`!!document.querySelector('[role="dialog"] form')`, 8));
  await setField("Item", NEW_ITEM);
  await setField("Brand", "Zzz Testing");
  await setField("Cost price", "R 90,00");
  await setField("Selling price", "R 210,00");
  await setField("Reorder level", "2");
  await setField("Barcode", NEW_BARCODE);
  await shot("s2-add-form");
  await clickExact("Add item");
  await sleep(1500);
  check("the form closes once the item is good", await until(`!document.querySelector('[role="dialog"] form')`, 8));

  await search(NEW_ITEM);
  const listed = await text();
  check("the new item is on the retail shelf", listed.includes(NEW_ITEM), NEW_ITEM);
  check("with the price it was given", /R 210/.test(listed));
  check("and its barcode", listed.includes(NEW_BARCODE));
  check("flagged as never counted, because nothing has been put on the shelf", /needs count/i.test(listed));
  await shot("s3-added");

  // ------------------------------------------------ AC-10: it reaches the till
  await send("Page.navigate", { url: BASE + "/till" });
  await until(`!!document.querySelector('input[type="search"]')`);
  await sleep(1500);
  await search("Zzz Test Bond");
  const tillHits = await ev(`
    Array.from(document.querySelectorAll('.absolute button')).map(b => b.textContent).join(' | ')
  `);
  check("the till search finds the item just added", (tillHits ?? "").includes("Zzz Test Bond"),
    (tillHits ?? "").slice(0, 70));
  await shot("s4-till-search");

  /* A barcode typed in full is treated as a scan and drops straight onto the sale. */
  await search(NEW_BARCODE);
  await sleep(1200);
  /* The first <aside> is the 78px navigation rail; the receipt is the one that
     holds the line list, so pick by content rather than by position. */
  const onSale = await ev(`(() => {
    const panel = Array.from(document.querySelectorAll('aside'))
      .find(a => a.querySelector('ul li') && a.getBoundingClientRect().width > 200);
    return panel ? panel.innerText.replace(/\\s+/g, " ") : "";
  })()`);
  check("scanning the new barcode puts it on the sale", onSale.includes("Zzz Test Bond"), onSale.slice(0, 80));
  await shot("s5-scanned");

  // ------------------------------------------------------- correcting a line
  await send("Page.navigate", { url: BASE + "/stock" });
  await until(`/Stock control/i.test(document.body.innerText)`);
  await search(NEW_ITEM);
  await sleep(900);
  const opened = await ev(`(() => {
    const b = Array.from(document.querySelectorAll('button'))
      .find(x => (x.getAttribute('aria-label') || '').startsWith('Edit ${NEW_ITEM.slice(0, 12)}'));
    if (b) { b.click(); return true; } return false;
  })()`);
  check("an existing line can be opened for editing", opened);
  await until(`!!document.querySelector('[role="dialog"] form')`, 8);
  const prefilled = await ev(`document.querySelector('[role="dialog"] [aria-label="Selling price"]')?.value ?? ""`);
  check("the form arrives filled in with what is on file", prefilled.startsWith("210"), prefilled);

  await setField("Brand", "Zzz Corrected");
  await setField("Selling price", "R 265,50");
  await setField("Barcode", "HL-MANUAL-01");
  await clickExact("Save changes");
  await sleep(1500);
  await search(NEW_ITEM);
  const corrected = await text();
  check("the corrected brand sticks", /Zzz Corrected/.test(corrected));
  check("the corrected price sticks", /R 265,50/.test(corrected));
  check("a manual code is accepted where the supplier gave none", corrected.includes("HL-MANUAL-01"));
  await shot("s6-corrected");

  // The correction has to reach the till too — that is the whole point.
  await send("Page.navigate", { url: BASE + "/till" });
  await until(`!!document.querySelector('input[type="search"]')`);
  await sleep(1400);
  await search("Zzz Test Bond");
  const tillAfter = await ev(`
    Array.from(document.querySelectorAll('.absolute button')).map(b => b.textContent).join(' | ')
  `);
  check("the till shows the corrected price", (tillAfter ?? "").includes("265"), (tillAfter ?? "").slice(0, 80));
  await shot("s7-till-corrected");

  // ------------------------------------------------- it answers to permission
  await signIn("owner");
  await send("Page.navigate", { url: BASE + "/admin" });
  await until(`/Settings and data/i.test(document.body.innerText)`);
  await sleep(900);
  await ev(`(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'Roles & screens');
    if (b) { b.click(); return true; } return false;
  })()`);
  await sleep(1200);
  const box = `input[aria-label="Add and edit stock for Reception"]`;
  check("stock maintenance is a permission of its own", await ev(`!!document.querySelector('${box}')`));
  await ev(`(() => { const b = document.querySelector('${box}'); if (b && b.checked) { b.click(); return true; } return false; })()`);
  await sleep(700);

  await signIn("reception");
  await send("Page.navigate", { url: BASE + "/stock" });
  await until(`/Stock control/i.test(document.body.innerText)`);
  await sleep(1400);
  const stockText = await text();
  check("the stock list is still readable without the permission", /Retail shelf/i.test(stockText));
  check("but adding is withdrawn", !(await ev(`
    Array.from(document.querySelectorAll('button')).some(b => b.textContent.trim() === '+ Add item')
  `)));
  check("and so is editing", !(await ev(`
    Array.from(document.querySelectorAll('button')).some(b => /^Edit /.test(b.getAttribute('aria-label') || ''))
  `)));
  await shot("s8-no-permission");

  // Leave it as it was found.
  await signIn("owner");
  await send("Page.navigate", { url: BASE + "/admin" });
  await until(`/Settings and data/i.test(document.body.innerText)`);
  await ev(`(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'Roles & screens');
    if (b) { b.click(); return true; } return false;
  })()`);
  await sleep(1000);
  await ev(`(() => { const b = document.querySelector('${box}'); if (b && !b.checked) { b.click(); return true; } return false; })()`);
  await sleep(600);
  check("and restored afterwards", await ev(`document.querySelector('${box}')?.checked === true`));

  ws.close();
} catch (err) {
  check("harness ran", false, String(err?.message ?? err));
} finally {
  chrome.kill();
}

console.log(results.join("\n"));
const passed = results.filter((r) => r.startsWith("PASS")).length;
console.log(`\n${passed}/${results.length} passed on ${BASE}`);
process.exit(passed === results.length ? 0 : 1);
