/* Phase 1 spine: if the chart is wrong, everything above it is decoration.
 * These tests avoid hand-copied ephemeris tables and instead check the engine
 * against independent astronomical facts astronomy-engine can prove.
 */
const test = require('node:test');
const assert = require('node:assert');
const env = require('./load.js');
const { KEphem, Astronomy } = env;
const E = KEphem;

const SKOPJE = { lat: 41.9973, lon: 21.4280, name: 'Skopje' };
const NYC = { lat: 40.7128, lon: -74.0060, name: 'New York' };
const SYDNEY = { lat: -33.8688, lon: 151.2093, name: 'Sydney' };

function angDiff(a, b) { return Math.abs(E.norm180(a - b)); }

test('tropical Sun longitude is 0 deg at the March equinox', () => {
  const s = Astronomy.Seasons(2026);
  const lon = E.longitude('Sun', s.mar_equinox.date);
  assert.ok(angDiff(lon, 0) < 0.005, `equinox Sun lon = ${lon}`);
});

test('tropical Sun longitude is 90/180/270 at the other seasons', () => {
  const s = Astronomy.Seasons(2026);
  assert.ok(angDiff(E.longitude('Sun', s.jun_solstice.date), 90) < 0.005);
  assert.ok(angDiff(E.longitude('Sun', s.sep_equinox.date), 180) < 0.005);
  assert.ok(angDiff(E.longitude('Sun', s.dec_solstice.date), 270) < 0.005);
});

test('Sun and Moon share a longitude at the new moon', () => {
  const nm = Astronomy.SearchMoonPhase(0, new Date('2026-08-01T00:00:00Z'), 40);
  assert.ok(angDiff(E.longitude('Sun', nm.date), E.longitude('Moon', nm.date)) < 0.02);
});

test('Moon is opposite the Sun at the full moon', () => {
  const fm = Astronomy.SearchMoonPhase(180, new Date('2026-08-01T00:00:00Z'), 40);
  assert.ok(angDiff(E.longitude('Moon', fm.date) - E.longitude('Sun', fm.date), 180) < 0.02);
});

test('the computed Ascendant really is on the eastern horizon', () => {
  // Independent check: convert the Asc ecliptic point to equatorial, then to
  // horizontal coordinates. Altitude must be ~0 and azimuth in the east.
  const dates = ['2026-03-15T07:11:00Z', '2026-08-03T21:40:00Z', '2026-12-01T13:05:00Z'];
  for (const place of [SKOPJE, NYC, SYDNEY]) {
    for (const iso of dates) {
      const date = new Date(iso);
      const asc = E.ascendant(date, place.lat, place.lon);
      const t = Astronomy.MakeTime(date);
      const vec = Astronomy.VectorFromSphere(new Astronomy.Spherical(0, asc, 1), t);
      const eqd = Astronomy.RotateVector(Astronomy.Rotation_ECT_EQD(t), vec);
      const eq = Astronomy.SphereFromVector(eqd);
      const obs = new Astronomy.Observer(place.lat, place.lon, 0);
      // No refraction: the Ascendant is the geometric horizon, not the refracted
      // one (refraction alone is ~0.5 deg down there and would mask real errors).
      const hor = Astronomy.Horizon(date, obs, eq.lon / 15, eq.lat, null);
      assert.ok(Math.abs(hor.altitude) < 0.02,
        `${place.name} ${iso}: Asc altitude ${hor.altitude.toFixed(4)}`);
      assert.ok(hor.azimuth > 0 && hor.azimuth < 180,
        `${place.name} ${iso}: Asc azimuth ${hor.azimuth.toFixed(2)} is not eastern`);
    }
  }
});

test('the computed Midheaven really is on the meridian', () => {
  for (const place of [SKOPJE, NYC, SYDNEY]) {
    const date = new Date('2026-05-20T16:23:00Z');
    const mc = E.midheaven(date, place.lat, place.lon);
    const t = Astronomy.MakeTime(date);
    const vec = Astronomy.VectorFromSphere(new Astronomy.Spherical(0, mc, 1), t);
    const eq = Astronomy.SphereFromVector(Astronomy.RotateVector(Astronomy.Rotation_ECT_EQD(t), vec));
    assert.ok(angDiff(eq.lon, E.ramc(date, place.lon)) < 0.02,
      `${place.name}: MC right ascension does not match RAMC`);
  }
});

test('Ascendant advances through all twelve signs in a day', () => {
  const seen = new Set();
  const start = Date.parse('2026-06-10T00:00:00Z');
  for (let m = 0; m < 1440; m += 5) {
    seen.add(E.signIndex(E.ascendant(new Date(start + m * 60000), SKOPJE.lat, SKOPJE.lon)));
  }
  assert.strictEqual(seen.size, 12);
});

test('the Moon has ~zero ecliptic latitude when it reaches the node', () => {
  // Walk to the next time the Moon's longitude equals the true node's.
  let t = Date.parse('2026-08-03T00:00:00Z');
  let prev = E.norm180(E.longitude('Moon', new Date(t)) - E.trueNode(new Date(t)));
  for (let i = 1; i < 60 * 24; i++) {
    const now = new Date(t + i * 3600000);
    const d = E.norm180(E.longitude('Moon', now) - E.trueNode(now));
    if (prev < 0 && d >= 0 && Math.abs(d) < 10) {
      assert.ok(Math.abs(E.latitude('Moon', now)) < 0.15,
        `latitude at node crossing = ${E.latitude('Moon', now)}`);
      return;
    }
    prev = d;
  }
  assert.fail('no node crossing found');
});

test('the true node stays within 2 deg of the mean node', () => {
  const date = new Date('2026-08-03T12:00:00Z');
  const T = Astronomy.MakeTime(date).tt / 36525;
  const mean = E.norm360(125.0445479 - 1934.1362891 * T + 0.0020754 * T * T);
  assert.ok(angDiff(E.trueNode(date), mean) < 2.0);
});

test('the node is retrograde', () => {
  const a = E.trueNode(new Date('2026-08-01T00:00:00Z'));
  const b = E.trueNode(new Date('2026-09-01T00:00:00Z'));
  assert.ok(E.norm180(b - a) < 0, 'node should move backwards through the zodiac');
});

test('retrograde detection matches a known Mercury retrograde window', () => {
  // Mercury is retrograde somewhere in every ~3.5 months; assert the engine
  // sees a sign change in speed and that the retrograde stretch is 18-25 days.
  let inRetro = false, start = null, lengths = [];
  for (let d = 0; d < 200; d++) {
    const date = new Date(Date.parse('2026-01-01T00:00:00Z') + d * 86400000);
    const retro = E.speed('Mercury', date) < 0;
    if (retro && !inRetro) { start = d; inRetro = true; }
    if (!retro && inRetro) { lengths.push(d - start); inRetro = false; }
  }
  assert.ok(lengths.length >= 1, 'expected at least one Mercury retrograde in 200 days');
  for (const len of lengths) assert.ok(len >= 17 && len <= 26, `retrograde lasted ${len} days`);
});

test('whole-sign houses put the Ascendant at 1st-house cusp', () => {
  const h = E.houses(new Date('2026-08-03T09:00:00Z'), SKOPJE.lat, SKOPJE.lon, 'whole');
  assert.strictEqual(h.system, 'whole');
  assert.strictEqual(E.signIndex(h.cusps[0]), E.signIndex(h.asc));
  assert.strictEqual(E.houseOf(h.asc, h), 1);
  for (let i = 0; i < 12; i++) assert.strictEqual(h.cusps[i] % 30, 0);
});

test('Placidus cusps are ordered, and cusp 1/10 equal Asc/MC', () => {
  const h = E.houses(new Date('2026-08-03T09:00:00Z'), SKOPJE.lat, SKOPJE.lon, 'placidus');
  assert.strictEqual(h.system, 'placidus');
  assert.ok(angDiff(h.cusps[0], h.asc) < 1e-6);
  assert.ok(angDiff(h.cusps[9], h.mc) < 1e-6);
  for (let i = 0; i < 12; i++) {
    const span = E.norm360(h.cusps[(i + 1) % 12] - h.cusps[i]);
    assert.ok(span > 5 && span < 90, `house ${i + 1} spans ${span.toFixed(1)} deg`);
  }
  // Opposite cusps must be exactly 180 apart.
  for (let i = 0; i < 6; i++) assert.ok(angDiff(h.cusps[i] - h.cusps[i + 6], 180) < 1e-6);
});

test('Placidus degenerates to whole sign inside the polar circle', () => {
  const h = E.houses(new Date('2026-12-21T09:00:00Z'), 78.2, 15.6, 'placidus');
  assert.strictEqual(h.system, 'whole');
});

test('sect: the Sun is above the horizon in a day chart and below at night', () => {
  const obs = new Astronomy.Observer(SKOPJE.lat, SKOPJE.lon, 0);
  for (const iso of ['2026-08-03T09:00:00Z', '2026-08-03T23:00:00Z', '2026-01-15T14:00:00Z',
    '2026-01-15T02:00:00Z', '2026-04-02T05:00:00Z']) {
    const date = new Date(iso);
    const s = E.sky(date, SKOPJE, { speeds: false, classicalOnly: true });
    const eq = Astronomy.Equator('Sun', date, obs, true, true);
    const hor = Astronomy.Horizon(date, obs, eq.ra, eq.dec, 'normal');
    assert.strictEqual(s.isDay, hor.altitude > 0, `${iso}: sect disagrees with the horizon`);
  }
});

test('Lot of Fortune is the same distance from the Asc as the Moon is from the Sun', () => {
  const s = E.sky(new Date('2026-08-03T09:00:00Z'), SKOPJE, { speeds: false, classicalOnly: true });
  const arc = s.isDay
    ? E.norm360(s.bodies.Moon.lon - s.bodies.Sun.lon)
    : E.norm360(s.bodies.Sun.lon - s.bodies.Moon.lon);
  assert.ok(angDiff(s.lots.fortune, s.asc + arc) < 1e-6);
  // Fortune and Spirit are mirror images across the Asc/Desc axis.
  assert.ok(angDiff(s.lots.fortune - s.asc, s.asc - s.lots.spirit) < 1e-6);
});

test('moonSignExit lands on a sign boundary and is in the future', () => {
  const now = new Date('2026-08-03T09:00:00Z');
  const exit = E.moonSignExit(now);
  assert.ok(exit > now && exit - now < 3 * 86400000);
  const before = E.longitude('Moon', new Date(exit.getTime() - 120000));
  const after = E.longitude('Moon', new Date(exit.getTime() + 120000));
  assert.notStrictEqual(E.signIndex(before), E.signIndex(after));
});

test('a full sky snapshot is internally consistent', () => {
  const s = E.sky(new Date('2026-08-03T09:00:00Z'), SKOPJE, {});
  assert.strictEqual(Object.keys(s.bodies).length, 11); // 7 classical + 3 modern + node
  for (const name of E.ALL_BODIES) {
    const b = s.bodies[name];
    assert.ok(b.lon >= 0 && b.lon < 360, `${name} longitude out of range`);
    assert.strictEqual(b.sign, E.SIGNS[Math.floor(b.lon / 30)]);
    assert.ok(b.house >= 1 && b.house <= 12);
    assert.strictEqual(b.retro, b.speed < 0);
  }
  assert.ok(s.bodies.Sun.speed > 0.9 && s.bodies.Sun.speed < 1.1);
  assert.ok(Math.abs(s.bodies.Moon.speed) > 11 && s.bodies.Moon.speed < 16);
});
