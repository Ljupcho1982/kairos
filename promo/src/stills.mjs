/* Promo stills: the 1200x630 link-preview card and a 1080 square,
 * rendered from real app screenshots rather than mockups.
 */
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const OUT = path.resolve('promo');
const FRAMES = path.resolve('promo/frames');

// Pick three real frames: the results list, the chapter, the ledger verdict.
const pick = (i) => 'data:image/png;base64,' +
  fs.readFileSync(path.join(FRAMES, `f${String(i).padStart(5, '0')}.png`)).toString('base64');

const shotResults = pick(240);   // window + reasons
const shotChapter = pick(430);   // the chapter
const shotLedger = pick(540);    // the ledger verdict

function page(w, h, layout) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:${w}px;height:${h}px;overflow:hidden;
    background:radial-gradient(900px 500px at 50% -8%, #1e2c56 0%, #0a0e1a 62%);
    color:#e8ecf8;font-family:-apple-system,"Segoe UI",Roboto,sans-serif;
    display:flex;${layout}}
  .glyph{font-size:${Math.round(w / 18)}px;line-height:1}
  h1{font-size:${Math.round(w / 11)}px;font-weight:700;letter-spacing:-1px}
  .kick{color:#e8c479;font-size:${Math.round(w / 46)}px;letter-spacing:4px;
    text-transform:uppercase;margin-top:10px;font-weight:600}
  .lead{color:#c3cfff;font-size:${Math.round(w / 36)}px;line-height:1.45;margin-top:18px;max-width:${Math.round(w * 0.52)}px}
  .lead b{color:#fff}
  .tags{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px;max-width:${Math.round(w * 0.54)}px}
  .tag{background:rgba(142,166,255,.13);border:1px solid rgba(142,166,255,.32);
    color:#c3cfff;border-radius:999px;padding:7px 15px;font-size:${Math.round(w / 60)}px}
  .shots{display:flex;gap:${Math.round(w / 60)}px;align-items:center}
  .shots img{height:${Math.round(h * 0.9)}px;border-radius:${Math.round(w / 70)}px;
    border:1px solid #2b3a63;box-shadow:0 24px 70px rgba(0,0,0,.6)}
  </style></head><body>`;
}

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'] });

/* ---- 1200 x 630 link preview: text left, two phones right ---- */
{
  const pg = await browser.newPage();
  await pg.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await pg.setContent(page(1200, 630, 'align-items:center;padding:0 0 0 62px;gap:30px;') + `
    <div style="flex:1">
      <div style="display:flex;align-items:center;gap:16px">
        <span class="glyph">⏳</span><h1>Kairos</h1>
      </div>
      <div class="kick">Electional astrology</div>
      <p class="lead">Every astrology app tells you what today means.<br>
        Kairos tells you <b>when to act</b> — and then checks whether it helped.</p>
      <div class="tags">
        <span class="tag">Traditional technique, cited</span>
        <span class="tag">100% offline</span>
        <span class="tag">No subscription</span>
        <span class="tag">167 tests</span>
      </div>
    </div>
    <div class="shots" style="padding-right:46px;align-items:center">
      <img src="${shotResults}" style="height:556px">
      <img src="${shotLedger}" style="height:512px;opacity:.9">
    </div>`, { waitUntil: 'load' });
  await pg.screenshot({ path: path.join(OUT, 'promo-linkedin-1200x630.png') });
  console.log('promo-linkedin-1200x630.png ✓');
}

/* ---- 1080 square: headline over three phones ---- */
{
  const pg = await browser.newPage();
  await pg.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 });
  await pg.setContent(page(1080, 1080, 'flex-direction:column;align-items:center;padding:54px 40px 0;') + `
    <div style="display:flex;align-items:center;gap:14px"><span class="glyph">⏳</span><h1>Kairos</h1></div>
    <div class="kick">When to act — not what today means</div>
    <p class="lead" style="text-align:center;max-width:820px;font-size:31px">
      It scans the real sky minute by minute, hands you your window with
      <b>every reason and every source</b>, then keeps score on whether it helped.</p>
    <div class="shots" style="margin-top:34px">
      <img src="${shotChapter}" style="height:560px;opacity:.72">
      <img src="${shotResults}" style="height:640px">
      <img src="${shotLedger}" style="height:560px;opacity:.72">
    </div>`, { waitUntil: 'load' });
  await pg.screenshot({ path: path.join(OUT, 'promo-square-1080.png') });
  console.log('promo-square-1080.png ✓');
}

await browser.close();
