/**
 * Captures screenshots of the prototype for the user guide and the deck.
 * Signs in through the real login screen, then visits each screen in turn.
 */
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

// A stale profile would still be signed in from the last run, so every shot
// would be captured as the wrong user. Always start clean.
const PROFILE = process.env.TEMP + "\\cdp-capture";
rmSync(PROFILE, { recursive: true, force: true });

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9223;
const BASE = "http://localhost:3100";
const OUT =
  "C:\\temp\\claude\\c--Data-OneDrive---Terra-Group-Applications-Hairline\\6305bd13-c82c-4c05-b471-9115eecd7529\\scratchpad\\guide-shots";

mkdirSync(OUT, { recursive: true });

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=2", // retina-quality images for print
    `--remote-debugging-port=${PORT}`,
    "--user-data-dir=" + PROFILE,
    "--window-size=1440,1000",
    "about:blank",
  ],
  { stdio: "ignore" }
);

await sleep(3000);

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
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
  new Promise((resolve) => {
    const n = ++id;
    pending.set(n, resolve);
    ws.send(JSON.stringify({ id: n, method, params }));
  });

const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  return r?.result?.value;
};

async function shot(name) {
  const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  if (!r?.data) {
    console.log(`  !! ${name} FAILED`);
    return false;
  }
  writeFileSync(`${OUT}\\${name}.png`, Buffer.from(r.data, "base64"));
  console.log(`  ok ${name}`);
  return true;
}

async function signIn(username) {
  await evaluate(`
    (() => {
      const set = (el, v) => {
        const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        s.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      set(document.querySelector('input[autocomplete="username"]'), '${username}');
      set(document.querySelector('input[type="password"]'), 'hairline2026');
      document.querySelector('form').requestSubmit();
    })()
  `);
  await sleep(2200);
}

async function goto(path, wait = 2200) {
  await send("Page.navigate", { url: BASE + path });
  await sleep(wait);
}

await send("Page.enable");
await send("Runtime.enable");

// ---------------------------------------------------------------- login
await goto("/", 3500);
await shot("01-login");

// ---------------------------------------------------------------- owner
await signIn("owner");
await shot("02-dashboard");

await goto("/till");
await shot("03-till-empty");

// Build a realistic sale on the till: client, a colour service, a retail product.
await evaluate(`
  (() => {
    const set = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      s.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const search = document.querySelector('input[type="search"]');
    set(search, 'a');
    return 'typed';
  })()
`);
await sleep(900);
await evaluate(`
  (() => {
    const item = document.querySelector('.absolute button');
    if (item) item.click();
    return !!item;
  })()
`);
await sleep(900);
// Add two catalogue items.
await evaluate(`
  (() => {
    const buttons = Array.from(document.querySelectorAll('button')).filter(b => b.className.includes('min-h-[72px]'));
    if (buttons[2]) buttons[2].click();
    return buttons.length;
  })()
`);
await sleep(700);
await evaluate(`
  (() => {
    const buttons = Array.from(document.querySelectorAll('button')).filter(b => b.className.includes('min-h-[72px]'));
    if (buttons[5]) buttons[5].click();
    return buttons.length;
  })()
`);
await sleep(1200);
await shot("04-till-sale");

// Take payment so the panel shows a split and the complete button lights up.
await evaluate(`
  (() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const exact = btns.find(b => (b.textContent||'').startsWith('Exact'));
    if (exact) exact.click();
    return !!exact;
  })()
`);
await sleep(1200);
await shot("05-till-payment");

await goto("/clients");
await shot("06-clients");

// Open the client with the richest history.
const clientHref = await evaluate(`
  (() => {
    const a = document.querySelector('table a[href^="/clients/"]');
    return a ? a.getAttribute('href') : null;
  })()
`);
if (clientHref) {
  await goto(clientHref, 3000);
  await shot("07-client-file");
}

await goto("/diary", 2600);
await shot("08-diary");

await goto("/stock", 2600);
await shot("09-stock");

// The "what to order" tab.
await evaluate(`
  (() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => (x.textContent||'').includes('What to order'));
    if (b) b.click();
    return !!b;
  })()
`);
await sleep(1400);
await shot("10-stock-order");

await goto("/staff", 2600);
await shot("11-team");

const staffHref = await evaluate(`
  (() => {
    const a = document.querySelector('a[href^="/staff/"]');
    return a ? a.getAttribute('href') : null;
  })()
`);
if (staffHref) {
  await goto(staffHref, 2800);
  await shot("12-staff-portfolio");
}

await goto("/cashup", 2600);
// Count a plausible drawer so the variance panel is populated.
await evaluate(`
  (() => {
    const set = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      s.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
    const counts = [3, 6, 4, 5, 3, 2, 4, 6];
    inputs.forEach((el, i) => { if (counts[i] !== undefined) set(el, String(counts[i])); });
    return inputs.length;
  })()
`);
await sleep(1400);
await shot("13-cashup");

await goto("/pricing", 2600);
await shot("14-pricing");

// The generated, printable client menu.
await evaluate(`
  (() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => (x.textContent||'').includes('Print client menu'));
    if (b) b.click();
    return !!b;
  })()
`);
await sleep(1600);
await shot("15-price-menu");

// ---------------------------------------------------------------- stylist
await goto("/", 2000);
await evaluate("localStorage.clear()");
await goto("/", 3000);
await signIn("karin");
await shot("16-stylist-dashboard");

// ---------------------------------------------------------------- mobile
await send("Emulation.setDeviceMetricsOverride", {
  width: 414,
  height: 860,
  deviceScaleFactor: 2,
  mobile: true,
});
await goto("/", 2600);
await shot("17-mobile-stylist");

ws.close();
chrome.kill();
console.log("\nCaptured to " + OUT);
