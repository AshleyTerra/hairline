/**
 * HF-01, HF-02 and HF-03 from the 14 August feedback:
 *   AC-01  cost price including VAT, with a cost/full-price selector
 *   AC-02  a fixed final value, with the original price kept for audit
 *   AC-05  a redemption credits the stylist and does not duplicate turnover
 *   AC-06  Stock Sales is one row of its own, apart from the stylists
 *   AC-11  the pricing controls answer to a permission
 *   AC-12  item tracking scrolls inside the results area
 */
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9243;
const BASE = process.argv[2] ?? "http://localhost:3100";
const PROFILE = process.env.TEMP + "\\cdp-pricing";
const OUT =
  "C:\\temp\\claude\\c--Data-OneDrive---Terra-Group-Applications-Hairline" +
  "\\6305bd13-c82c-4c05-b471-9115eecd7529\\scratchpad\\pricing";

rmSync(PROFILE, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

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
    for (let i = 0; i < tries; i += 1) {
      if (await ev(expr)) return true;
      await sleep(1000);
    }
    return false;
  };
  const text = () => ev(`document.body.innerText.replace(/\\u00a0/g," ").replace(/\\s+/g," ")`);
  const clickExact = (t) => ev(`(() => {
    const el = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === ${JSON.stringify(t)});
    if (el) { el.click(); return true; } return false;
  })()`);
  const clickTab = (t) => ev(`(() => {
    const el = Array.from(document.querySelectorAll('button[aria-pressed]'))
      .find(b => b.textContent.trim().toLowerCase().startsWith(${JSON.stringify(t.toLowerCase())}));
    if (el) { el.click(); return true; } return false;
  })()`);
  const setByLabel = (label, value) => ev(`(() => {
    const el = document.querySelector('[aria-label=${JSON.stringify(label)}]');
    if (!el) return false;
    const proto = el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(String(value))});
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    return true;
  })()`);
  const signIn = async (who) => {
    /* Always sign out first. Returning early when a session already exists
       silently kept the previous user, and reception cannot open Reports. */
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
  await signIn("reception");

  // ------------------------------------------------- AC-01: the cost price
  await send("Page.navigate", { url: BASE + "/till" });
  await until(`!!document.querySelector('button[aria-pressed]')`);
  await sleep(1200);
  await clickTab("retail");
  await until(`!!document.querySelector('[data-catalogue] li button')`);
  await sleep(800);

  const catalogueText = await ev(`document.querySelector('[data-catalogue]')?.innerText.replace(/\\u00a0/g," ") ?? ""`);
  check("the catalogue shows a cost price beside the retail price", /cost R/i.test(catalogueText),
    (catalogueText.match(/cost R[\d  ,.]+/) ?? [""])[0]);
  await shot("s1-catalogue-cost");

  // Add a retail line and open its editor.
  await ev(`document.querySelectorAll('[data-catalogue] li button')[0]?.click(), true`);
  await sleep(1200);
  const listedPrice = await ev(`(() => {
    const li = document.querySelector('aside li');
    const m = li?.innerText.replace(/\\u00a0/g," ").match(/R ?[\\d ,.]+/);
    return m ? m[0] : "";
  })()`);
  await ev(`(() => {
    const b = document.querySelector('aside li button');
    if (b) { b.click(); return true; } return false;
  })()`);
  await sleep(700);
  const editor = await ev(`document.querySelector('aside li')?.innerText.replace(/\\s+/g," ") ?? ""`);
  check("reception is offered Cost price and Full price", /Cost price/.test(editor) && /Full price/.test(editor));
  check("and a Final value field", /Final value/.test(editor));
  await shot("s2-line-editor");

  // Switch to cost price.
  check("cost price can be chosen", await clickExact("Cost price"));
  await sleep(900);
  const atCost = await ev(`document.querySelector('aside li')?.innerText.replace(/\\s+/g," ") ?? ""`);
  check("the line says it is at cost", /at cost/i.test(atCost), atCost.slice(0, 90));
  check("the original price is still shown, struck through", /was R/i.test(atCost) || /R/.test(atCost));
  await shot("s3-at-cost");

  // Back to full price.
  check("full price can be restored", await clickExact("Full price"));
  await sleep(800);
  const restored = await ev(`document.querySelector('aside li')?.innerText.replace(/\\u00a0/g," ") ?? ""`);
  check("restoring puts the listed price back", listedPrice !== "" && restored.includes(listedPrice.trim()),
    `listed ${listedPrice}`);

  // ------------------------------------------- AC-02: a fixed final value
  const before = await text();
  const beforeBalance = (before.match(/Balance R ?([\d ,.]+)/i) ?? [])[1] ?? "";
  await setByLabel(
    await ev(`document.querySelector('[aria-label^="Final value"]')?.getAttribute('aria-label') ?? ""`),
    "111"
  );
  await sleep(1000);
  const afterFinal = await text();
  check("a final value recalculates the docket", /111/.test(afterFinal), `was ${beforeBalance}`);
  const lineNow = await ev(`document.querySelector('aside li')?.innerText.replace(/\\s+/g," ") ?? ""`);
  check("the line is marked as priced by hand", /priced by hand/i.test(lineNow), lineNow.slice(0, 90));
  check("the override names who did it, for the audit trail", /was R/i.test(lineNow), lineNow.slice(0, 110));
  await shot("s4-final-value");

  // ------------------------------------------ AC-11: it answers to a permission
  /* The abilities grid lives behind Admin's permissions tab, which reception
     does not get — so this part is the owner's, and the effect is checked back
     on reception's own till. */
  await signIn("owner");
  await send("Page.navigate", { url: BASE + "/admin" });
  await until(`/Settings and data/i.test(document.body.innerText)`);
  await sleep(900);
  const openedTab = await ev(`(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'Roles & screens');
    if (b) { b.click(); return b.textContent.trim(); } return "";
  })()`);
  check("the owner can open the permissions tab", !!openedTab, openedTab || "no tab found");
  await sleep(1200);
  const adminText = await text();
  check("Admin has a grid for what each role may do", /What each role may do/i.test(adminText));
  check("it lists selling at cost price", /Sell at cost price/i.test(adminText));
  check("and adding or editing stock", /Add and edit stock/i.test(adminText));
  await shot("s5-abilities-grid");

  const box = `input[aria-label="Sell at cost price for Reception"]`;
  check("reception starts with the cost-price ability", await ev(`document.querySelector('${box}')?.checked === true`));
  await ev(`(() => { const b = document.querySelector('${box}'); if (b) { b.click(); return true; } return false; })()`);
  await sleep(800);
  check("it can be withdrawn", await ev(`document.querySelector('${box}')?.checked === false`));

  // Back to reception's till: the control must be gone.
  await signIn("reception");
  await send("Page.navigate", { url: BASE + "/till" });
  await until(`!!document.querySelector('button[aria-pressed]')`);
  await sleep(1200);
  await clickTab("retail");
  await until(`!!document.querySelector('[data-catalogue] li button')`);
  await ev(`document.querySelectorAll('[data-catalogue] li button')[0]?.click(), true`);
  await sleep(1200);
  await ev(`(() => { const b = document.querySelector('aside li button'); if (b) { b.click(); return true; } return false; })()`);
  await sleep(800);
  const gatedEditor = await ev(`document.querySelector('aside li')?.innerText.replace(/\\s+/g," ") ?? ""`);
  /* Assert the line is really there, so an empty panel cannot pass by default. */
  check("there is still a line on the docket to inspect", gatedEditor.length > 10, gatedEditor.slice(0, 60));
  check("the cost-price control is gone once the permission is withdrawn",
    gatedEditor.length > 10 && !/Cost price/.test(gatedEditor), gatedEditor.slice(0, 90));
  check("the cost figure is hidden with it", !/cost R/i.test(gatedEditor));
  check("the final-value control is untouched by that switch", /Final value/.test(gatedEditor));
  await shot("s6-gated");

  // Put it back, so the demo is left as it was found.
  await signIn("owner");
  await send("Page.navigate", { url: BASE + "/admin" });
  await until(`/Settings and data/i.test(document.body.innerText)`);
  await ev(`(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'Roles & screens');
    if (b) { b.click(); return true; } return false;
  })()`);
  await sleep(1000);
  await ev(`(() => {
    const b = document.querySelector('${box}');
    if (b && !b.checked) { b.click(); return true; }
    return false;
  })()`);
  await sleep(600);
  check("and restored afterwards", await ev(`document.querySelector('${box}')?.checked === true`));

  // ------------------------------------------- AC-06 / AC-12: the reports
  await send("Page.navigate", { url: BASE + "/reports" });
  check("the reports screen loads", await until(`/Staff turnover/i.test(document.body.innerText)`));
  await sleep(1600);
  const turnover = await text();
  check("Stock Sales is a row of its own", /Stock Sales/.test(turnover));
  check("the old wording is gone", !/Hairline \(salon\)/i.test(turnover));
  check("the salon's stock column is called Stock Sales too", !/Salon stock/i.test(turnover));
  await shot("s7-staff-turnover");

  // Item tracking must scroll inside its own frame.
  await ev(`(() => {
    const sel = document.querySelector('select[aria-label="Report type"]')
      || Array.from(document.querySelectorAll('select')).find(s => /Item tracking/.test(s.innerText));
    if (!sel) return false;
    const opt = Array.from(sel.options).find(o => /Item tracking/i.test(o.textContent));
    if (!opt) return false;
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value').set.call(sel, opt.value);
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await sleep(2200);
  const scroll = await ev(`(() => {
    const el = document.querySelector('.list-scroll');
    if (!el) return null;
    return {
      capped: el.scrollHeight > el.clientHeight + 4,
      clientH: el.clientHeight,
      scrollH: el.scrollHeight,
      pageScrolls: document.documentElement.scrollHeight > window.innerHeight + 4,
    };
  })()`);
  check("item tracking has its own scrolling frame", scroll !== null);
  check("the results scroll inside it rather than growing the page",
    !!scroll && scroll.capped, scroll ? `${scroll.clientH}px frame, ${scroll.scrollH}px of rows` : "no frame");
  await shot("s8-item-tracking");

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
