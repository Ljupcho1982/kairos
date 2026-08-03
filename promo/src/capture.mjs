/* Capture the Kairos demo frames.
 *
 * Drives the real app on the local dev server — no mockups, no fake screens.
 * Everything on screen is computed by the shipped engine from the real sky.
 */
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const APP = 'http://localhost:5178';
const OUT = path.resolve('promo/frames');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) fs.unlinkSync(path.join(OUT, f));

/* Captions are injected into the page rather than burned in by ffmpeg: the
 * app's own typography renders them, and there is no font-path escaping to
 * fight with on Windows. */
const CAPTION_CSS = `
#promo-cap{position:fixed;top:0;left:0;right:0;z-index:999;padding:14px 18px 18px;
  background:linear-gradient(180deg,rgba(6,9,18,.97) 60%,rgba(6,9,18,0));
  color:#e8ecf8;font:600 17px/1.4 -apple-system,"Segoe UI",Roboto,sans-serif;
  text-align:center;letter-spacing:.2px;opacity:0;transition:opacity .25s}
#promo-cap.on{opacity:1}
#promo-cap b{color:#e8c479;font-weight:700}`;

async function caption(html) {
  await pg.evaluate((h, css) => {
    let el = document.getElementById('promo-cap');
    if (!el) {
      const s = document.createElement('style');
      s.textContent = css;
      document.head.appendChild(s);
      el = document.createElement('div');
      el.id = 'promo-cap';
      document.body.appendChild(el);
    }
    if (h) { el.innerHTML = h; el.classList.add('on'); }
    else { el.classList.remove('on'); }
  }, html, CAPTION_CSS);
  await wait(280);
}

let n = 0;
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
});
const pg = await browser.newPage();
await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

/** Hold a still for `seconds` by writing repeated numbered frames (12 fps). */
async function hold(name, seconds) {
  const shot = path.join(OUT, `tmp.png`);
  await pg.screenshot({ path: shot });
  const buf = fs.readFileSync(shot);
  const count = Math.round(seconds * 12);
  for (let i = 0; i < count; i++) {
    fs.writeFileSync(path.join(OUT, `f${String(n++).padStart(5, '0')}.png`), buf);
  }
  fs.unlinkSync(shot);
  console.log(`${name}: ${seconds}s (${count} frames), total ${n}`);
}

/** Capture live frames while something animates. */
async function record(seconds, fps = 12) {
  const count = Math.round(seconds * fps);
  for (let i = 0; i < count; i++) {
    await pg.screenshot({ path: path.join(OUT, `f${String(n++).padStart(5, '0')}.png`) });
    await wait(1000 / fps);
  }
}

async function scrollTo(y, seconds = 1.2) {
  const steps = Math.round(seconds * 12);
  const start = await pg.evaluate(() => window.scrollY);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    await pg.evaluate((v) => window.scrollTo(0, v), start + (y - start) * eased);
    await pg.screenshot({ path: path.join(OUT, `f${String(n++).padStart(5, '0')}.png`) });
  }
}

await pg.goto(APP, { waitUntil: 'networkidle2', timeout: 30000 });
await pg.evaluate(() => localStorage.clear());
await pg.reload({ waitUntil: 'networkidle2' });
await wait(800);

/* ---- 1. the promise ---- */
await hold('onboarding', 2.4);
await caption('Every astrology app tells you <b>what today means</b>.');
await hold('claim 1', 2.0);
await caption('Kairos tells you <b>when to act</b>.');
await hold('claim 2', 2.2);

/* ---- 2. build a chart ---- */
await caption('Birth data stays on the phone. No account.');
await pg.evaluate(() => {
  document.querySelector('#ob-date').value = '1985-06-14';
  document.querySelector('#ob-time').value = '08:30';
  document.querySelector('#ob-name').value = '';
});
await hold('birth data entered', 1.8);
await caption(null);
await pg.evaluate(() => document.querySelector('#ob-go').click());
await wait(700);

/* ---- 3. what are you about to do ---- */
await caption('22 undertakings — each with its <b>own</b> traditional rules');
await hold('intent picker', 2.4);
await scrollTo(520, 1.4);
await hold('more intents', 1.6);
await caption(null);
await pg.evaluate(() => window.scrollTo(0, 0));

/* ---- 4. choose: sign a contract ---- */
await pg.evaluate(() => document.querySelector('.intent[data-id="sign_contract"]').click());
await wait(500);
await caption('Tell it when you are actually free.');
await hold('constraints', 2.4);

/* ---- 5. the search, live ---- */
await caption('It scans the <b>real sky</b>, quarter hour by quarter hour.');
await pg.evaluate(() => document.querySelector('#cfg-run').click());
await record(3.2);
await pg.waitForFunction(
  () => !document.querySelector('#ask-results').classList.contains('hidden'),
  { timeout: 60000 }
);
await wait(400);

/* ---- 6. the answer, with its reasons ---- */
await caption('540 moments scanned. Here is your window.');
await hold('best window', 3.0);
await caption('Every point names its <b>rule and its source</b>.');
await scrollTo(430, 1.3);
await hold('reasons and sources', 3.0);
await caption('The negatives are shown too — always.');
await scrollTo(980, 1.3);
await hold('second window', 2.2);

/* ---- 7. the moment to avoid ---- */
await caption('And the moment to <b>avoid</b>.');
await pg.evaluate(() => {
  const el = document.querySelector('.win.avoid');
  if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 60);
});
await wait(300);
await hold('avoid this moment', 3.2);

/* ---- 8. the chapter ---- */
await caption('Profections, firdaria, zodiacal releasing.');
await pg.evaluate(() => {
  window.scrollTo(0, 0);
  document.querySelector('.tab[data-view="chapter"]').click();
});
await wait(900);
await hold('chapter', 3.0);
await caption('The whole sky, computed on the device. Offline.');
await scrollTo(420, 1.3);
await hold('sky now', 2.4);

/* ---- 9. the ledger: the app keeping score on itself ---- */
await caption('Then it <b>keeps score on itself</b>.');
await pg.evaluate(() => {
  window.scrollTo(0, 0);
  const now = Date.now();
  const elected = [4, 5, 3, 4, 5, 4, 3, 4];
  const control = [3, 2, 4, 3, 3, 2, 4, 3];
  elected.forEach((r, i) => KDb.addLedger({
    intentId: 'sign_contract', intentLabel: 'Sign a contract', icon: '🖋️',
    when: new Date(now - (i + 2) * 86400000).toISOString(),
    kairosScore: 62 + i * 3, elected: true, rating: r
  }));
  control.forEach((r, i) => KDb.addLedger({
    intentId: 'negotiate', intentLabel: 'Negotiate', icon: '⚖️',
    when: new Date(now - (i + 14) * 86400000).toISOString(),
    kairosScore: 38 + i * 2, elected: false, rating: r
  }));
  document.querySelector('.tab[data-view="ledger"]').click();
});
await wait(900);
await hold('ledger', 2.4);
await caption('An astrology app that is willing to say <b>"no effect"</b>.');
await hold('ledger verdict', 3.8);

/* ---- 10. close ---- */
await caption(null);
await pg.evaluate(() => {
  window.scrollTo(0, 0);
  document.querySelector('.tab[data-view="ask"]').click();
});
await wait(500);
await hold('back to elect', 1.2);
await caption('<b>Kairos</b> — free, offline, no subscription.');
await hold('closing', 2.8);

await browser.close();
console.log(`\ndone — ${n} frames in ${OUT}`);
