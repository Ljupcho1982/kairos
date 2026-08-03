const test = require('node:test');
const assert = require('node:assert');
const env = require('./load.js');
const { KEphem: E, KDignity: D, KAspects: AS, KHours: H } = env;

const SKOPJE = { lat: 41.9973, lon: 21.4280 };

test('domicile rulers are complete and symmetric', () => {
  assert.strictEqual(Object.keys(D.DOMICILE).length, 12);
  // Every classical planet except the luminaries rules exactly two signs.
  const counts = {};
  for (const s of E.SIGNS) counts[D.DOMICILE[s]] = (counts[D.DOMICILE[s]] || 0) + 1;
  assert.strictEqual(counts.Sun, 1);
  assert.strictEqual(counts.Moon, 1);
  for (const p of ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']) assert.strictEqual(counts[p], 2);
});

test('Egyptian bounds cover every degree of every sign exactly once', () => {
  for (const sign of E.SIGNS) {
    const b = D.BOUNDS[sign];
    assert.strictEqual(b[b.length - 1][1], 30, `${sign} bounds must end at 30`);
    let prev = 0, total = 0;
    const rulers = new Set();
    for (const [ruler, upper] of b) {
      assert.ok(upper > prev, `${sign}: bounds must increase`);
      total += upper - prev; prev = upper; rulers.add(ruler);
    }
    assert.strictEqual(total, 30);
    assert.strictEqual(rulers.size, 5, `${sign}: five bound rulers, no repeats`);
    assert.ok(!rulers.has('Sun') && !rulers.has('Moon'), `${sign}: luminaries have no bounds`);
  }
});

test('essential dignity scores the textbook cases', () => {
  // Sun at 19 Aries: domicile-less but exalted, and it rules the fire triplicity by day.
  const sunAries = D.essential('Sun', 19, true);
  assert.ok(sunAries.reasons.some((r) => r.source === 'exaltation'));
  assert.ok(sunAries.reasons.some((r) => r.source.startsWith('triplicity')));
  // Sun in Leo: domicile.
  assert.ok(D.essential('Sun', 130, true).score >= 5);
  // Mars in Libra: detriment.
  const marsLibra = D.essential('Mars', 195, true);
  assert.ok(marsLibra.reasons.some((r) => r.source === 'detriment'));
  assert.ok(marsLibra.score < 0);
  // Saturn in Aries: fall.
  assert.ok(D.essential('Saturn', 5, true).reasons.some((r) => r.source === 'fall'));
  // A peregrine planet says so.
  assert.ok(D.essential('Jupiter', 35).reasons.some((r) => r.source === 'peregrine'));
});

test('triplicity rulers flip with sect', () => {
  assert.strictEqual(D.triplicityRuler('Leo', true), 'Sun');
  assert.strictEqual(D.triplicityRuler('Leo', false), 'Jupiter');
  assert.strictEqual(D.triplicityRuler('Aquarius', true), 'Saturn');
  assert.strictEqual(D.triplicityRuler('Aquarius', false), 'Mercury');
});

test('faces run in Chaldean order from Mars at 0 Aries', () => {
  assert.strictEqual(D.faceRuler(0), 'Mars');
  assert.strictEqual(D.faceRuler(10), 'Sun');
  assert.strictEqual(D.faceRuler(20), 'Venus');
  assert.strictEqual(D.faceRuler(30), 'Mercury');   // 0 Taurus
  assert.strictEqual(D.faceRuler(350), 'Mars');     // 20 Pisces closes the cycle
});

test('combustion, cazimi and under-the-beams thresholds', () => {
  assert.strictEqual(D.solarCondition(100.1, 100, 'Mercury').state, 'cazimi');
  assert.strictEqual(D.solarCondition(105, 100, 'Mercury').state, 'combust');
  assert.strictEqual(D.solarCondition(112, 100, 'Mercury').state, 'underbeams');
  assert.strictEqual(D.solarCondition(130, 100, 'Mercury'), null);
  assert.strictEqual(D.solarCondition(105, 100, 'Moon'), null); // luminaries exempt
});

test('sect assignment matches the classical division', () => {
  assert.strictEqual(D.inSect('Jupiter', true, 0, 0), true);
  assert.strictEqual(D.inSect('Jupiter', false, 0, 0), false);
  assert.strictEqual(D.inSect('Mars', false, 0, 0), true);
  assert.strictEqual(D.inSect('Venus', true, 0, 0), false);
});

test('aspects are found at the right angles and orbs', () => {
  assert.strictEqual(AS.between(0, 120, 'Sun', 'Jupiter').aspect, 'trine');
  assert.strictEqual(AS.between(0, 90, 'Sun', 'Saturn').aspect, 'square');
  assert.strictEqual(AS.between(0, 180, 'Sun', 'Moon').aspect, 'opposition');
  assert.strictEqual(AS.between(0, 45, 'Sun', 'Moon'), null, 'no minor aspects in the traditional set');
  const near = AS.between(0, 123, 'Sun', 'Jupiter');
  assert.strictEqual(near.aspect, 'trine');
  assert.ok(Math.abs(near.orb - 3) < 1e-9);
});

test('application and separation follow the faster body', () => {
  const fast = { lon: 100, speed: 13 }, slow = { lon: 130, speed: 1 };
  assert.strictEqual(AS.applying(fast, slow), true, 'Moon closing on the Sun applies');
  const past = { lon: 160, speed: 13 };
  assert.strictEqual(AS.applying(past, slow), false, 'past exact aspect separates');
});

test('void-of-course detection is self-consistent', () => {
  const date = new Date('2026-08-03T09:00:00Z');
  const v = AS.moonVoid(date, SKOPJE, 3);
  assert.ok(v.signExit > date);
  if (v.isVoid) {
    assert.strictEqual(v.until.getTime(), v.signExit.getTime());
  } else {
    assert.ok(v.nextAspect.date > date && v.nextAspect.date <= v.signExit);
    // The named aspect really is close to exact at the reported time.
    const moon = E.longitude('Moon', v.nextAspect.date);
    const p = E.longitude(v.nextAspect.planet, v.nextAspect.date);
    const sep = Math.abs(E.norm180(moon - p));
    assert.ok(Math.abs(sep - v.nextAspect.angle) < 0.2,
      `aspect off by ${(sep - v.nextAspect.angle).toFixed(3)} deg`);
  }
});

test('the Moon is void at some point over a month, but not most of the time', () => {
  let voidCount = 0, n = 0;
  for (let h = 0; h < 24 * 28; h += 6) {
    const d = new Date(Date.parse('2026-08-01T00:00:00Z') + h * 3600000);
    if (AS.moonVoid(d, SKOPJE, 3).isVoid) voidCount++;
    n++;
  }
  const share = voidCount / n;
  // Published figures put the Moon void roughly 10-20% of the time.
  assert.ok(share > 0.02 && share < 0.35, `void ${(share * 100).toFixed(1)}% of the month`);
});

test('planetary hours: 24 per astrological day, day ruler owns the first', () => {
  const date = new Date('2026-08-03T09:00:00Z');
  const h = H.planetaryHour(date, SKOPJE);
  assert.ok(h, 'hour found');
  assert.ok(h.index >= 1 && h.index <= 12);
  assert.ok(h.end > h.start);

  const list = H.hoursOfDay(date, SKOPJE);
  assert.strictEqual(list.length, 24);
  assert.strictEqual(list[0].ruler, list[0].dayRuler, 'first hour after sunrise is the day ruler');
  // Hours must tile without gaps.
  for (let i = 1; i < list.length; i++) {
    assert.ok(Math.abs(list[i].start - list[i - 1].end) < 90000, `gap at hour ${i}`);
  }
  // Chaldean order, wrapping.
  for (let i = 1; i < list.length; i++) {
    const prev = E.CHALDEAN.indexOf(list[i - 1].ruler);
    assert.strictEqual(list[i].ruler, E.CHALDEAN[(prev + 1) % 7], `Chaldean order breaks at hour ${i}`);
  }
});

test('Monday is the Moon\'s day, Saturday is Saturn\'s', () => {
  // 2026-08-03 is a Monday; take a mid-morning local hour.
  const mon = H.planetaryHour(new Date('2026-08-03T08:00:00Z'), SKOPJE);
  assert.strictEqual(mon.dayRuler, 'Moon');
  const sat = H.planetaryHour(new Date('2026-08-08T08:00:00Z'), SKOPJE);
  assert.strictEqual(sat.dayRuler, 'Saturn');
});

test('condition() rolls essential and accidental together', () => {
  const sky = E.sky(new Date('2026-08-03T09:00:00Z'), SKOPJE, {});
  const c = D.condition(sky.bodies.Venus, sky);
  assert.strictEqual(c.planet, 'Venus');
  assert.strictEqual(c.score, c.essential.score + c.accidental.score);
  assert.ok(c.reasons.length > 0);
  for (const r of c.reasons) assert.ok(typeof r.label === 'string' && r.source);
});
