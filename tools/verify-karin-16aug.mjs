/**
 * Karin's note of 16 August:
 *   TILL       a closed docket can be corrected, behind a password — the stylist
 *              split that was missed, or the wrong payment type
 *   CLIENTS    purchase history, easy to reach, on the file and at the till
 *   CLIENTS    a new client's stylist, last visit, visits and lifetime fill in
 *   STOCK      a price changed under Stock reaches the Price menu
 *   PRICE MENU a printable services menu at cost price
 */
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9247;
const BASE = process.argv[2] ?? "http://localhost:3100";
const PROFILE = process.env.TEMP + "\\cdp-karin16";
const OUT =
  "C:\\temp\\claude\\c--Data-OneDrive---Terra-Group-Applications-Hairline" +
  "\\6305bd13-c82c-4c05-b471-9115eecd7529\\scratchpad\\karin16";

rmSync(PROFILE, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const CLIENT = "Zola Testclient";

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
  const clickStarts = (t) => ev(`(() => {
    const el = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().startsWith(${JSON.stringify(t)}));
    if (el) { el.click(); return true; } return false;
  })()`);
  const clickTab = (t) => ev(`(() => {
    const el = Array.from(document.querySelectorAll('button[aria-pressed]'))
      .find(b => b.textContent.trim().toLowerCase().startsWith(${JSON.stringify(t.toLowerCase())}));
    if (el) { el.click(); return true; } return false;
  })()`);
  const setLabelled = (label, value, scope = "") => ev(`(() => {
    const want = ${JSON.stringify(label)};
    /* Some forms label by aria-label, others by the span inside the <label>. */
    const el = document.querySelector(${JSON.stringify(scope)} + '[aria-label=' + JSON.stringify(want) + ']')
      || Array.from(document.querySelectorAll(${JSON.stringify(scope)} + 'label')).map(l => {
           const sp = l.querySelector('span');
           return sp && sp.textContent.trim().toLowerCase().startsWith(want.toLowerCase())
             ? l.querySelector('input, select, textarea') : null;
         }).find(Boolean);
    if (!el) return false;
    const proto = el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(String(value))});
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    return true;
  })()`);
  const search = async (term, sel = 'input[type="search"]') => {
    await ev(`(() => {
      const el = document.querySelector(${JSON.stringify(sel)});
      if (!el) return false;
      const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
      d.call(el, ${JSON.stringify(term)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    await sleep(1200);
  };
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

  await send("Page.enable");
  await send("Runtime.enable");
  /* The owner holds the amend permission by default, and can reach every screen. */
  await signIn("owner");

  // =============================== CLIENTS: a sale fills the record in
  await send("Page.navigate", { url: BASE + "/till" });
  await until(`!!document.querySelector('button[aria-pressed]')`);
  await sleep(1400);

  await clickExact("+ New");
  await until(`!!document.querySelector('[role="dialog"] form')`, 8);
  await ev(`(() => {
    const b = Array.from(document.querySelectorAll('[role="dialog"] button')).find(x => x.textContent.trim() === 'Walk-in');
    if (b) { b.click(); return true; } return false;
  })()`);
  await sleep(400);
  await setLabelled("Name", CLIENT, '[role="dialog"] ');
  await ev(`(() => { const f = document.querySelector('[role="dialog"] form'); if (f) { f.requestSubmit(); return true; } return false; })()`);
  await sleep(1600);
  check("a client can be captured at the till", (await text()).includes(CLIENT));

  // Ring a sale up for them.
  await clickTab("services");
  await until(`!!document.querySelector('[data-catalogue] li button')`);
  await sleep(700);
  await ev(`document.querySelectorAll('[data-catalogue] li button')[0]?.click(), true`);
  await sleep(1200);
  await clickStarts("Exact ");
  await sleep(700);
  await ev(`(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => /^Take R/.test(x.textContent.trim()));
    if (b) { b.click(); return true; } return false;
  })()`);
  await sleep(2200);
  check("the sale completes", /Sale complete/i.test(await text()));
  await clickExact("Close");
  await sleep(1000);
  await shot("s1-sale-done");

  // Their record must no longer read "never / 0 / R0".
  await send("Page.navigate", { url: BASE + "/clients" });
  await until(`/Clients/.test(document.body.innerText)`);
  await search(CLIENT);
  const row = await ev(`(() => {
    const tr = Array.from(document.querySelectorAll('tr')).find(t => t.innerText.includes(${JSON.stringify(CLIENT)}));
    return tr ? tr.innerText.replace(/\\u00a0/g," ").replace(/\\s+/g," ") : "";
  })()`);
  check("the client is listed", row.includes(CLIENT), row.slice(0, 80));
  check("their visit is counted, not left at nought", /\b1\b/.test(row), row);
  check("last visit is no longer 'never'", !/never/i.test(row), row);
  check("lifetime spend is no longer R 0", !/R 0\b/.test(row), row);
  check(
    "the stylist who did the work is named",
    /Karin M\.|Melissa J\.|Meagan V\.|Angelia A\.|Marelize S\.|Meghan H\.|Shakira S\./.test(row),
    row.slice(0, 90)
  );
  await shot("s2-client-row");

  // =============================== CLIENTS: the purchase history
  await ev(`(() => {
    const a = Array.from(document.querySelectorAll('a')).find(x => x.textContent.includes(${JSON.stringify(CLIENT)}));
    if (a) { a.click(); return true; } return false;
  })()`);
  check("their file opens", await until(`document.body.innerText.includes(${JSON.stringify(CLIENT)}) && /Purchase history/i.test(document.body.innerText)`, 10));
  const file = await text();
  check("the file carries a purchase history", /Purchase history/i.test(file));
  /* The columns from Karin's own printout: invoice, staff, date, department,
     description, item, price, quantity and service type. */
  /* innerText reflects CSS text-transform, so these headings arrive uppercased. */
  const headings = file.toLowerCase();
  for (const column of ["Inv no.", "Staff", "Date", "Dept", "Description", "Item", "Price", "Qty", "Type"]) {
    check(`the history has a ${column} column`, headings.includes(column.toLowerCase()), column);
  }
  check("with the service-type filter", /Services/.test(file) && /Retail/.test(file) && /Stock Sales/.test(file));
  check("and a date range", await ev(`!!document.querySelector('[aria-label="History from"]') && !!document.querySelector('[aria-label="History to"]')`));
  check("it lists the sale just rung up", /INV/i.test(file));
  check("and can be printed", await ev(`
    Array.from(document.querySelectorAll('button')).some(b => b.textContent.trim() === 'Print')
  `));
  await shot("s3-purchase-history");

  // Reachable from the till, with the client on the docket.
  await send("Page.navigate", { url: BASE + "/till" });
  await until(`!!document.querySelector('input[type="search"]')`);
  await sleep(1400);
  await search(CLIENT);
  await ev(`(() => { const b = document.querySelectorAll('.absolute button')[0]; if (b) { b.click(); return true; } return false; })()`);
  await sleep(1400);
  check("the docket offers History for a client on file", await clickExact("History"));
  check("and it opens on the till", await until(`/Purchase history/i.test(document.body.innerText)`, 8));
  await shot("s4-till-history");
  await clickExact("Close");
  await sleep(800);

  // =============================== STOCK reaches the PRICE MENU
  await send("Page.navigate", { url: BASE + "/stock" });
  await until(`/Stock control/i.test(document.body.innerText)`);
  await sleep(1200);
  await search("Trichoton Dht");
  const target = await ev(`(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => (x.getAttribute('aria-label') || '').startsWith('Edit Trichoton Dht'));
    if (b) { b.click(); return b.getAttribute('aria-label'); } return "";
  })()`);
  check("the item Karin tested can be edited on Stock", !!target, target || "not found");
  await until(`!!document.querySelector('[role="dialog"] form')`, 8);
  await setLabelled("Selling price", "R 699,00", '[role="dialog"] ');
  await clickExact("Save changes");
  await sleep(1500);
  await search("Trichoton Dht");
  check("the new price shows on Stock", /R 699,00/.test(await text()));
  await shot("s5-stock-changed");

  await send("Page.navigate", { url: BASE + "/pricing" });
  await until(`/What everything costs|Price menu/i.test(document.body.innerText)`);
  await sleep(1200);
  await clickTab("retail");
  await sleep(1200);
  const onMenu = await ev(`(() => {
    const found = Array.from(document.querySelectorAll('button')).find(b => /Fusion/i.test(b.textContent));
    if (found) { found.click(); return true; } return false;
  })()`);
  await sleep(1400);
  const pricing = await text();
  check("the supplier tab is offered", onMenu);
  check("the Price menu quotes the changed price", /R 699,00/.test(pricing), (pricing.match(/Trichoton Dht[^R]*R [\d ,]+/) ?? [""])[0]);
  check("and no longer the old one", !/Trichoton Dht Inhibitor[^R]*R 645,00/.test(pricing));
  await shot("s6-price-menu");

  // =============================== PRICE MENU: services at cost
  check("a service cost list is offered", await clickTab("service cost"));
  check("it loads", await until(`/Service cost list/i.test(document.body.innerText)`, 8));
  const costs = await text();
  check("it is marked internal, not for the counter", /not for the counter/i.test(costs));
  check("it prints", await ev(`
    Array.from(document.querySelectorAll('button')).some(b => /Print/.test(b.textContent))
  `));
  check("it shows cost figures", /R ?\d/.test(costs));
  check("and says how many services have a cost on file", /services have a cost on file/i.test(costs));
  await shot("s7-cost-list");

  // =============================== TILL: amending a closed docket
  await send("Page.navigate", { url: BASE + "/till" });
  await until(`!!document.querySelector('button[aria-pressed]')`);
  await sleep(1400);
  await clickTab("Clients today");
  await sleep(1400);
  check("a closed sale offers to be amended", await clickStarts("Amend #"));
  check("the amend dialog opens", await until(`!!document.querySelector('[aria-label^="Amend invoice"]')`, 8));
  const gate = await ev(`document.querySelector('[aria-label^="Amend invoice"]')?.innerText.replace(/\\s+/g," ") ?? ""`);
  check("it asks for a password first", /password/i.test(gate), gate.slice(0, 90));
  check("nothing is editable before that", !/Who did the work/i.test(gate));
  await shot("s8-amend-locked");

  await setLabelled("Your password", "wrong-one", '[aria-label^="Amend invoice"] ');
  await ev(`(() => { const f = document.querySelector('[aria-label^="Amend invoice"] form'); if (f) { f.requestSubmit(); return true; } return false; })()`);
  await sleep(900);
  check("a wrong password is refused", /does not match/i.test(await ev(`document.querySelector('[role="alert"]')?.innerText ?? ""`)));

  await setLabelled("Your password", "hairline2026", '[aria-label^="Amend invoice"] ');
  await ev(`(() => { const f = document.querySelector('[aria-label^="Amend invoice"] form'); if (f) { f.requestSubmit(); return true; } return false; })()`);
  await sleep(1200);
  const unlocked = await ev(`document.querySelector('[aria-label^="Amend invoice"]')?.innerText.replace(/\\s+/g," ") ?? ""`);
  check("the right password unlocks it", /Who did the work/i.test(unlocked), unlocked.slice(0, 80));
  check("it shows how the sale was paid", /How it was paid/i.test(unlocked));
  check("and the total, which must not move", /Docket total/i.test(unlocked));
  await shot("s9-amend-unlocked");

  const totalBefore = (unlocked.match(/Docket total R ?([\d ,]+)/) ?? [])[1] ?? "";

  // Move a line to another stylist, and change the payment type.
  const moved = await ev(`(() => {
    const sel = Array.from(document.querySelectorAll('[aria-label^="Stylist for"]'))[0];
    if (!sel) return false;
    const other = Array.from(sel.options).find(o => o.value && o.value !== sel.value);
    if (!other) return false;
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value').set.call(sel, other.value);
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return other.textContent.trim();
  })()`);
  check("a line can be moved to another stylist", !!moved, String(moved));
  await sleep(700);
  const methodChanged = await ev(`(() => {
    const sel = document.querySelector('[aria-label="Method for payment 1"]');
    if (!sel) return false;
    const other = Array.from(sel.options).find(o => o.value !== sel.value);
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value').set.call(sel, other.value);
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return other.textContent.trim();
  })()`);
  check("the payment type can be corrected", !!methodChanged, String(methodChanged));
  await sleep(800);

  const withChanges = await ev(`document.querySelector('[aria-label^="Amend invoice"]')?.innerText.replace(/\\s+/g," ") ?? ""`);
  const totalAfter = (withChanges.match(/Docket total R ?([\d ,]+)/) ?? [])[1] ?? "";
  check("the total is unchanged by either correction", totalBefore !== "" && totalBefore === totalAfter,
    `${totalBefore} then ${totalAfter}`);
  check("both changes are listed before saving", /moved/i.test(withChanges), withChanges.slice(-140));
  await shot("s10-amend-changes");

  await clickExact("Save the correction");
  await sleep(1600);
  check("the correction saves", await until(`!document.querySelector('[aria-label^="Amend invoice"]')`, 8));
  await clickTab("Clients today");
  await sleep(1400);
  check("the docket is marked as amended", /amended/i.test(await text()));
  await shot("s11-amended");

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
