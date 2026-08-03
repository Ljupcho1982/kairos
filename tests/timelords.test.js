/* The Chapter: profections, firdaria, zodiacal releasing. */
const test = require('node:test');
const assert = require('node:assert');
const env = require('./load.js');
const { KEphem: E, KTimelords: T, KDignity: D } = env;

const SKOPJE = { lat: 41.9973, lon: 21.4280 };
const BIRTH = new Date('1985-06-14T08:30:00Z');
const chart = E.natal(BIRTH, SKOPJE);

test('ageAt counts whole years and brackets the birthday', () => {
  const a = T.ageAt(BIRTH, new Date('2026-08-03T00:00:00Z'));
  assert.strictEqual(a.years, 41);
  assert.ok(a.from <= new Date('2026-08-03T00:00:00Z') && a.to > new Date('2026-08-03T00:00:00Z'));
  assert.strictEqual(a.from.getUTCMonth(), BIRTH.getUTCMonth());
  assert.strictEqual(a.from.getUTCDate(), BIRTH.getUTCDate());
});

test('ageAt handles the day before a birthday', () => {
  assert.strictEqual(T.ageAt(BIRTH, new Date('2026-06-13T00:00:00Z')).years, 40);
  assert.strictEqual(T.ageAt(BIRTH, new Date('2026-06-15T00:00:00Z')).years, 41);
});

test('profection advances exactly one sign per year and repeats every twelve', () => {
  const at = (y) => T.profection(chart, new Date(Date.UTC(1985 + y, 6, 1)));
  const a0 = at(0), a1 = at(1), a12 = at(12);
  assert.strictEqual(a0.house, 1, 'the first year of life profects to the 1st house');
  assert.strictEqual(a1.house, 2);
  assert.strictEqual(a12.house, 1, 'the twelve-year cycle returns to the Ascendant');
  assert.strictEqual(a0.sign, a12.sign);
  assert.strictEqual(E.SIGNS.indexOf(a1.sign), (E.SIGNS.indexOf(a0.sign) + 1) % 12);
});

test('the first profection year sits on the rising sign', () => {
  const p = T.profection(chart, new Date(Date.UTC(1985, 6, 1)));
  assert.strictEqual(p.sign, E.signName(chart.asc));
});

test('the Lord of the Year is the domicile ruler of the profected sign', () => {
  for (let y = 0; y < 24; y++) {
    const p = T.profection(chart, new Date(Date.UTC(1985 + y, 6, 1)));
    assert.strictEqual(p.lord, D.domicileRuler(p.sign), `year ${y}`);
  }
});

test('every profection year names its topics', () => {
  for (let y = 0; y < 12; y++) {
    const p = T.profection(chart, new Date(Date.UTC(1985 + y, 6, 1)));
    assert.strictEqual(p.topics, T.HOUSE_TOPICS[p.house - 1]);
    assert.ok(p.topics.length > 5);
  }
});

test('monthly profections run twelve to the year and start on the annual sign', () => {
  const p = T.profection(chart, new Date(Date.UTC(2026, 5, 15)));   // just after the birthday
  assert.strictEqual(p.month.index, 1);
  assert.strictEqual(p.month.sign, p.sign, 'the first profected month repeats the annual sign');
  const seen = new Set();
  const span = p.to - p.from;
  for (let k = 0; k < 12; k++) {
    const at = new Date(p.from.getTime() + span * (k + 0.5) / 12);
    const q = T.profection(chart, at);
    assert.strictEqual(q.month.index, k + 1);
    seen.add(q.month.sign);
  }
  assert.strictEqual(seen.size, 12, 'the profected month visits all twelve signs');
});

test('the profected month window contains the moment it was computed for', () => {
  const when = new Date('2026-08-03T12:00:00Z');
  const p = T.profection(chart, when);
  assert.ok(p.month.from <= when && p.month.to > when);
});

test('firdaria: the day sequence starts with the Sun, the night with the Moon', () => {
  assert.strictEqual(T.FIRDAR_DAY[0][0], 'Sun');
  assert.strictEqual(T.FIRDAR_NIGHT[0][0], 'Moon');
});

test('firdaria: both sequences total 75 years', () => {
  for (const seq of [T.FIRDAR_DAY, T.FIRDAR_NIGHT]) {
    assert.strictEqual(seq.reduce((s, x) => s + x[1], 0), 75);
  }
});

test('firdaria: both sequences use the same nine lords with the same lengths', () => {
  const asMap = (s) => Object.fromEntries(s);
  assert.deepStrictEqual(asMap(T.FIRDAR_DAY), asMap(T.FIRDAR_NIGHT));
});

test('firdaria periods tile the first 75 years without gaps', () => {
  let prev = null;
  for (let y = 0; y < 75; y += 0.5) {
    const at = new Date(BIRTH.getTime() + y * T.YEAR_MS);
    const f = T.firdaria(chart, at);
    assert.ok(f, `no firdaria at year ${y}`);
    assert.ok(f.from <= at && f.to > at, `year ${y} outside its own period`);
    if (prev && prev.lord !== f.lord) {
      assert.ok(Math.abs(prev.to - f.from) < 1000, 'periods must be contiguous');
    }
    prev = f;
  }
});

test('firdaria: a day chart hits Saturn at age 41', () => {
  // Sun 10 + Venus 8 + Mercury 13 + Moon 9 = 40, so year 41 falls to Saturn.
  assert.strictEqual(chart.isDay, true);
  const f = T.firdaria(chart, new Date(BIRTH.getTime() + 41 * T.YEAR_MS));
  assert.strictEqual(f.lord, 'Saturn');
});

test('firdaria: a night chart hits Jupiter at age 21', () => {
  const night = E.natal(new Date('1985-06-14T23:30:00Z'), SKOPJE);
  assert.strictEqual(night.isDay, false);
  // Moon 9 + Saturn 11 = 20, so year 21 falls to Jupiter.
  const f = T.firdaria(night, new Date(night.birth.getTime() + 21 * T.YEAR_MS));
  assert.strictEqual(f.lord, 'Jupiter');
});

test('firdaria sub-periods: seven per major period, starting with the lord', () => {
  const f = T.firdaria(chart, new Date(BIRTH.getTime() + 40.05 * T.YEAR_MS));
  assert.strictEqual(f.lord, 'Saturn');
  assert.ok(f.sub, 'planetary periods have sub-periods');
  assert.strictEqual(f.sub.index, 1);
  assert.strictEqual(f.sub.lord, f.lord, 'the first sub-period belongs to the period lord');
  const subLen = (f.to - f.from) / 7;
  assert.ok(Math.abs((f.sub.to - f.sub.from) - subLen) < 1000);
});

test('firdaria sub-periods walk the seven planets in order', () => {
  const f0 = T.firdaria(chart, new Date(BIRTH.getTime() + 40.05 * T.YEAR_MS));
  const seen = [];
  for (let k = 0; k < 7; k++) {
    const at = new Date(f0.from.getTime() + (f0.to - f0.from) * (k + 0.5) / 7);
    seen.push(T.firdaria(chart, at).sub.lord);
  }
  assert.strictEqual(new Set(seen).size, 7, 'no planet repeats within a period');
  assert.strictEqual(seen[0], 'Saturn');
});

test('the nodes get no firdaria sub-periods', () => {
  // The nodes close the sequence: years 70-75 for both sects.
  const f = T.firdaria(chart, new Date(BIRTH.getTime() + 71 * T.YEAR_MS));
  assert.ok(f.lord === 'NorthNode' || f.lord === 'SouthNode');
  assert.strictEqual(f.sub, null);
});

test('firdaria returns null before birth', () => {
  assert.strictEqual(T.firdaria(chart, new Date(BIRTH.getTime() - 86400000)), null);
});

test('zodiacal releasing period lengths are the lesser years of the domicile lords', () => {
  const expect = { Aries: 15, Taurus: 8, Gemini: 20, Cancer: 25, Leo: 19, Virgo: 20,
    Libra: 8, Scorpio: 15, Sagittarius: 12, Capricorn: 27, Aquarius: 30, Pisces: 12 };
  // deepStrictEqual would compare prototypes across the VM boundary.
  assert.deepStrictEqual(Object.assign({}, T.ZR_YEARS), expect);
  // Signs sharing a ruler share a length, except Capricorn/Aquarius by tradition.
  assert.strictEqual(T.ZR_YEARS.Aries, T.ZR_YEARS.Scorpio);
  assert.strictEqual(T.ZR_YEARS.Taurus, T.ZR_YEARS.Libra);
  assert.strictEqual(T.ZR_YEARS.Gemini, T.ZR_YEARS.Virgo);
  assert.strictEqual(T.ZR_YEARS.Sagittarius, T.ZR_YEARS.Pisces);
});

test('a releasing level runs in zodiacal order and its periods are contiguous', () => {
  const start = Date.parse('2000-01-01T00:00:00Z');
  const list = T.releasingLevel(0, start, start + 60 * T.YEAR_MS, T.YEAR_MS);
  assert.ok(list.length > 3);
  assert.strictEqual(list[0].sign, 'Aries');
  assert.strictEqual(list[1].sign, 'Taurus');
  for (let i = 1; i < list.length; i++) {
    assert.strictEqual(list[i].from.getTime(), list[i - 1].to.getTime(), 'no gaps between periods');
  }
});

test('each releasing period lasts its own sign length', () => {
  const start = Date.parse('2000-01-01T00:00:00Z');
  const list = T.releasingLevel(3, start, start + 200 * T.YEAR_MS, T.YEAR_MS);
  for (const p of list) {
    if (p.truncated) continue;
    const years = (p.to - p.from) / T.YEAR_MS;
    assert.ok(Math.abs(years - T.ZR_YEARS[p.sign]) < 1e-6, `${p.sign} ran ${years} years`);
  }
});

test('loosing of the bond: after a full circuit the sequence jumps to the opposite sign', () => {
  const start = Date.parse('1900-01-01T00:00:00Z');
  const list = T.releasingLevel(0, start, start + 600 * T.YEAR_MS, T.YEAR_MS);
  // The first twelve periods are the circuit; the thirteenth must be the
  // opposite of the starting sign, not the sign after the twelfth.
  assert.strictEqual(list.length > 13, true);
  assert.strictEqual(list[11].loosing, true, 'the twelfth period is flagged');
  assert.strictEqual(list[0].sign, 'Aries');
  assert.strictEqual(list[12].sign, 'Libra', 'the bond looses to the opposite sign');
  assert.strictEqual(list[13].sign, 'Scorpio', 'and then continues in order');
});

test('the releasing lord is the domicile ruler of its sign', () => {
  const start = Date.parse('2000-01-01T00:00:00Z');
  for (const p of T.releasingLevel(7, start, start + 100 * T.YEAR_MS, T.YEAR_MS)) {
    assert.strictEqual(p.lord, D.domicileRuler(p.sign));
  }
});

test('zodiacal releasing starts from the sign of the Lot of Spirit', () => {
  const zr = T.zodiacalReleasing(chart, new Date('1985-07-01T00:00:00Z'), 'spirit');
  assert.strictEqual(zr.l1.sign, E.signName(chart.lots.spirit));
});

test('releasing from Fortune starts from the Lot of Fortune instead', () => {
  const zr = T.zodiacalReleasing(chart, new Date('1985-07-01T00:00:00Z'), 'fortune');
  assert.strictEqual(zr.l1.sign, E.signName(chart.lots.fortune));
  assert.strictEqual(zr.lot, 'fortune');
});

test('the L2 sub-period sits inside its L1 period and starts on the same sign', () => {
  const when = new Date('2026-08-03T12:00:00Z');
  const zr = T.zodiacalReleasing(chart, when, 'spirit');
  assert.ok(zr.l1.from <= when && zr.l1.to > when);
  assert.ok(zr.l2.from >= zr.l1.from && zr.l2.to <= zr.l1.to);
  assert.strictEqual(zr.l2List[0].sign, zr.l1.sign);
});

test('L2 periods are measured in months, L3 in days', () => {
  const zr = T.zodiacalReleasing(chart, new Date('2026-08-03T12:00:00Z'), 'spirit');
  const l2months = (zr.l2.to - zr.l2.from) / (T.YEAR_MS / 12);
  if (!zr.l2.truncated) assert.ok(Math.abs(l2months - T.ZR_YEARS[zr.l2.sign]) < 1e-6);
  if (zr.l3 && !zr.l3.truncated) {
    const l3days = (zr.l3.to - zr.l3.from) / (T.YEAR_MS / 360);
    assert.ok(Math.abs(l3days - T.ZR_YEARS[zr.l3.sign]) < 1e-6);
  }
});

test('peak periods are reported only on angles of the Lot of Fortune', () => {
  const zr = T.zodiacalReleasing(chart, new Date('2026-08-03T12:00:00Z'), 'spirit');
  if (zr.peak) {
    assert.ok([1, 4, 7, 10].indexOf(zr.houseFromFortune.l1) >= 0);
    assert.ok([1, 10].indexOf(zr.houseFromFortune.l2) >= 0);
    assert.ok(zr.peakReason);
  } else {
    assert.strictEqual(zr.peakReason, null);
  }
});

test('chapter() returns all three techniques at once', () => {
  const ch = T.chapter(chart, new Date('2026-08-03T12:00:00Z'));
  assert.ok(ch.profection && ch.firdaria && ch.releasing);
  assert.strictEqual(typeof ch.profection.lord, 'string');
  assert.ok(E.SIGNS.indexOf(ch.releasing.l1.sign) >= 0);
});

test('the chapter is stable across a day and moves across a year', () => {
  const a = T.chapter(chart, new Date('2026-08-03T00:00:00Z'));
  const b = T.chapter(chart, new Date('2026-08-03T23:00:00Z'));
  assert.strictEqual(a.profection.house, b.profection.house);
  const c = T.chapter(chart, new Date('2027-08-03T00:00:00Z'));
  assert.notStrictEqual(a.profection.house, c.profection.house);
});
