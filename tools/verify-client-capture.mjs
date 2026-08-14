/**
 * HF-04 and HF-07: a client captured at the till reaches the client database,
 * the till's own search and their own file — and the capture form insists on
 * enough detail for a real client file while keeping a walk-in to one field.
 */
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9241;
const BASE = process.argv[2] ?? "http://localhost:3100";
const PROFILE = process.env.TEMP + "\\cdp-capture";
const OUT =
  "C:\\temp\\claude\\c--Data-OneDrive---Terra-Group-Applications-Hairline" +
  "\\6305bd13-c82c-4c05-b471-9115eecd7529\\scratchpad\\capture";

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

  /** Sets a React-controlled input or select by its accessible label. */
  const setField = (label, value, tag = "input") => ev(`(() => {
    const el = document.querySelector('[role="dialog"] ${tag}[aria-label=${JSON.stringify(label)}]')
      || Array.from(document.querySelectorAll('[role="dialog"] label')).map(l => {
           const s = l.querySelector('span');
           return s && s.textContent.trim().toLowerCase().startsWith(${JSON.stringify(label.toLowerCase())})
             ? l.querySelector('${tag}') : null;
         }).find(Boolean);
    if (!el) return false;
    const proto = el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, ${JSON.stringify(String(value))});
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    return true;
  })()`);
  const alertText = () => ev(`document.querySelector('[role="alert"]')?.innerText?.trim() ?? ""`);
  const submit = () => ev(`(() => {
    const f = document.querySelector('[role="dialog"] form');
    if (f) { f.requestSubmit(); return true; } return false;
  })()`);

  await send("Page.enable");
  await send("Runtime.enable");

  // Sign in as reception, who lands on the till.
  await send("Page.navigate", { url: BASE + "/" });
  await until(`!!document.querySelector('input[autocomplete="username"]')`);
  await ev(`(() => {
    const s=(el,v)=>{const d=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;d.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));};
    s(document.querySelector('input[autocomplete="username"]'),'reception');
    s(document.querySelector('input[type="password"]'),'hairline2026');
    document.querySelector('form').requestSubmit();
  })()`);
  await until(`!document.querySelector('input[autocomplete="username"]')`);
  await sleep(2200);
  await shot("s0-till");

  // ---------------------------------------------------------------- open it
  check("the till offers to capture a client", await clickExact("+ New"));
  check("the capture form opens", await until(`!!document.querySelector('[role="dialog"] form')`));
  await shot("s1-dialog");

  const dialog = await ev(`document.querySelector('[role="dialog"]').innerText.replace(/\\s+/g," ")`);
  check("offers a full client file and a walk-in", /Client file/.test(dialog) && /Walk-in/.test(dialog), dialog.slice(0, 70));
  check("asks for the birthday as day and month", /Birthday/i.test(dialog) && /day and month only/i.test(dialog));
  check("does not ask for a birth year", !/year of birth/i.test(dialog));

  // -------------------------------------------------- HF-07 service client
  await setField("Name", "Thandi Nkosi");
  await submit();
  await sleep(500);
  check("a client file needs a mobile number", /mobile number is needed/i.test(await alertText()), await alertText());

  await setField("Mobile", "011 706 1322");
  await submit();
  await sleep(500);
  check("refuses a landline, because the salon sends messages", /not a mobile number/i.test(await alertText()), await alertText());

  await setField("Mobile", "076 408");
  await submit();
  await sleep(500);
  check("refuses a number that is too short", /not a mobile number/i.test(await alertText()));

  await setField("Mobile", "076 408 9755");
  await submit();
  await sleep(500);
  check("a client file needs an email address", /email address is needed/i.test(await alertText()), await alertText());

  await setField("Email", "thandi at example");
  await submit();
  await sleep(500);
  check("refuses an email that is not one", /missing something/i.test(await alertText()), await alertText());

  await setField("Email", "thandi@example.co.za");
  await submit();
  await sleep(500);
  check("a client file needs a birthday", /birthday is needed/i.test(await alertText()), await alertText());

  await setField("Day of birth", "31", "select");
  await setField("Month of birth", "2", "select");
  await submit();
  await sleep(500);
  check("refuses 31 February", /not a date/i.test(await alertText()), await alertText());
  await shot("s2-validation");

  await setField("Day of birth", "26", "select");
  await setField("Month of birth", "8", "select");
  await submit();
  await sleep(1500);

  // ------------------------------------------------------- HF-04 persistence
  check("the capture form closes once the record is good", await until(`!document.querySelector('[role="dialog"] form')`, 6));
  const afterSave = await text();
  check("the docket now names the client", /Thandi Nkosi/.test(afterSave), (afterSave.match(/Thandi[^·]{0,30}/) ?? [""])[0]);
  await shot("s3-saved");

  // The till's own search has to find them again — this is the reported bug.
  await ev(`(() => {
    const el = document.querySelector('input[type="search"]');
    const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
    d.call(el, 'Thandi'); el.dispatchEvent(new Event('input',{bubbles:true}));
    return true;
  })()`);
  await sleep(1200);
  const found = await ev(`
    Array.from(document.querySelectorAll('.absolute button')).map(b => b.textContent).join(' | ')
  `);
  check("the till search finds the client just captured", /Thandi/.test(found ?? ""), (found ?? "").slice(0, 80));
  await shot("s4-till-search");

  // And they must be in the client database, with a file that opens.
  await send("Page.navigate", { url: BASE + "/clients" });
  check("the clients screen loads", await until(`/Clients/.test(document.body.innerText)`));
  await ev(`(() => {
    const el = document.querySelector('input[type="search"]');
    const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
    d.call(el, 'Thandi'); el.dispatchEvent(new Event('input',{bubbles:true}));
    return true;
  })()`);
  await sleep(1200);
  const listed = await text();
  check("the client database lists them", /Thandi Nkosi/.test(listed), (listed.match(/Thandi[^\n]{0,40}/) ?? [""])[0]);
  check("their mobile number was tidied to the salon's format", /076 408 9755/.test(listed));
  await shot("s5-clients-list");

  const opened = await ev(`(() => {
    const a = Array.from(document.querySelectorAll('a')).find(x => /Thandi Nkosi/.test(x.textContent));
    if (a) { a.click(); return true; } return false;
  })()`);
  check("their name links to a file", opened);
  check("the file opens rather than 404ing", await until(`/Thandi Nkosi/.test(document.body.innerText) && !/not be found|404/i.test(document.body.innerText)`, 8));
  const file = await text();
  check("the file reads as a new client, with no invented history", /0 visits|No visits|visits 0/i.test(file) || /R 0/.test(file), (file.match(/\d+ visits/) ?? [""])[0]);
  await shot("s6-client-file");

  // ------------------------------------------------------------ walk-in rule
  await send("Page.navigate", { url: BASE + "/till" });
  await until(`!!document.querySelector('input[type="search"]')`);
  await sleep(1200);
  await clickExact("+ New");
  await until(`!!document.querySelector('[role="dialog"] form')`);
  await ev(`(() => {
    const b = Array.from(document.querySelectorAll('[role="dialog"] button')).find(x => x.textContent.trim() === 'Walk-in');
    if (b) { b.click(); return true; } return false;
  })()`);
  await sleep(400);
  await setField("Name", "Counter Walk-in");
  await submit();
  await sleep(1500);
  check("a walk-in needs only a name", await until(`!document.querySelector('[role="dialog"] form')`, 6));
  check("and lands on the docket", /Counter Walk-in/.test(await text()));
  await shot("s7-walkin");

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
