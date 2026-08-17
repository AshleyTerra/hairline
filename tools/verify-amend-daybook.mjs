/**
 * Karin's till point, the way she will actually meet it: correcting a docket
 * that is already in the day book, on a browser where nothing has been rung up.
 * Before this, only a sale rung up in the same session could be amended, so the
 * function looked absent.
 */
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9247;
const BASE = process.argv[2] ?? "http://localhost:3100";
const PROFILE = process.env.TEMP + "\\cdp-amend";
const OUT =
  "C:\\temp\\claude\\c--Data-OneDrive---Terra-Group-Applications-Hairline" +
  "\\6305bd13-c82c-4c05-b471-9115eecd7529\\scratchpad\\amend";

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
  const shot = async (n) => {
    const r = await send("Page.captureScreenshot", { format: "png" });
    if (r?.data) writeFileSync(`${OUT}\\${n}.png`, Buffer.from(r.data, "base64"));
  };
  const until = async (expr, tries = 30) => {
    for (let i = 0; i < tries; i += 1) { if (await ev(expr)) return true; await sleep(1000); }
    return false;
  };
  const text = () => ev(`document.body.innerText.replace(/\\u00a0/g," ").replace(/\\s+/g," ")`);
  const dlg = `[aria-label^="Amend invoice"]`;
  const dialogText = () => ev(`document.querySelector('${dlg}')?.innerText.replace(/\\s+/g," ") ?? ""`);
  const setLabelled = (label, value) => ev(`(() => {
    const el = document.querySelector('${dlg} [aria-label=' + JSON.stringify(${JSON.stringify(label)}) + ']');
    if (!el) return false;
    const proto = el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(String(value))});
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    return true;
  })()`);
  const submitDialog = () => ev(`(() => {
    const f = document.querySelector('${dlg} form');
    if (f) { f.requestSubmit(); return true; } return false;
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
    await until(`!!document.querySelector('button[aria-pressed]')`);
    await sleep(1200);
  };

  await send("Page.enable");
  await send("Runtime.enable");

  // ------------------------------------------- nothing rung up in this browser
  await signIn("owner");
  await send("Page.navigate", { url: BASE + "/till" });
  await until(`!!document.querySelector('button[aria-pressed]')`);
  await sleep(1500);
  check("the till opens with nothing rung up", /Pick a service or product to start/.test(await text()));

  const amendable = await ev(`
    Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => /^Amend #/.test(t)).length
  `);
  check("the day's own dockets offer to be amended", amendable > 0, `${amendable} offered`);
  await shot("s1-daybook");

  // ------------------------------------------------------ the password gate
  const first = await ev(`(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => /^Amend #/.test(x.textContent.trim()));
    if (b) { b.click(); return b.textContent.trim(); } return "";
  })()`);
  check("one can be opened", !!first, first);
  check("the amend dialog opens", await until(`!!document.querySelector('${dlg}')`, 8));

  const gate = await dialogText();
  check("it asks for a password first", /password/i.test(gate), gate.slice(0, 80));
  check("nothing is editable until it is given", !/Work done by|Paid by/i.test(gate));
  await shot("s2-gate");

  await setLabelled("Your password", "not-the-password");
  await submitDialog();
  await sleep(900);
  check("a wrong password is refused", /not|wrong|incorrect/i.test(await dialogText()));
  check("and the dialog stays shut against editing", !/Work done by/i.test(await dialogText()));

  await setLabelled("Your password", "hairline2026");
  await submitDialog();
  await sleep(1200);
  const unlocked = await dialogText();
  check(
    "the right password opens it",
    /Who did the work/i.test(unlocked) && !/Your password/i.test(unlocked),
    unlocked.slice(0, 90)
  );
  await shot("s3-unlocked");

  // ------------------------------------------------- the total cannot move
  const totalShown = (unlocked.match(/R ?[\d ,.]+/) ?? [""])[0];
  check("the docket total is shown throughout", !!totalShown, totalShown);

  // Move the work to another stylist.
  const moved = await ev(`(() => {
    const sel = document.querySelector('${dlg} select[aria-label^="Stylist for"]')
      || document.querySelector('${dlg} select');
    if (!sel) return "";
    const other = Array.from(sel.options).find(o => o.value && !o.selected);
    if (!other) return "";
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value').set.call(sel, other.value);
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return other.textContent.trim();
  })()`);
  check("the work can be moved to another stylist", !!moved, moved);
  await sleep(700);
  await shot("s4-moved");

  const saved = await ev(`(() => {
    const b = Array.from(document.querySelectorAll('${dlg} button')).find(x => /Save|Apply/i.test(x.textContent));
    if (b) { b.click(); return b.textContent.trim(); } return "";
  })()`);
  check("the correction can be saved", !!saved, saved);
  check("the dialog closes", await until(`!document.querySelector('${dlg}')`, 8));
  await sleep(1200);

  const after = await text();
  check("the docket is marked as amended", /amended/i.test(after));
  await shot("s5-amended");

  // ------------------------------------------- it survives a reload, and reports
  await send("Page.reload");
  await until(`!!document.querySelector('button[aria-pressed]')`);
  await sleep(1800);
  check("the correction is still there after a reload", /amended/i.test(await text()));
  await shot("s6-after-reload");

  await send("Page.navigate", { url: BASE + "/reports" });
  check("the reports still build with a corrected sale", await until(`/Staff turnover/i.test(document.body.innerText)`));
  await sleep(2000);
  const report = await text();
  check("and show figures rather than breaking", /R ?[\d]/.test(report));
  await shot("s7-reports");

  // ---------------------------------------------------- reception cannot amend
  await signIn("reception");
  await send("Page.navigate", { url: BASE + "/till" });
  await until(`!!document.querySelector('button[aria-pressed]')`);
  await sleep(1500);
  const asReception = await ev(`
    Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => /^Amend #/.test(t)).length
  `);
  check("reception is not offered it by default", asReception === 0, `${asReception} offered`);
  check("but can still see the day book", /Docket|#9/.test(await text()));
  await shot("s8-reception");

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
