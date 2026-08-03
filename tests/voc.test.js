/* Void-of-course is the strongest veto in electional astrology, so it gets
 * checked against a published third-party table rather than against itself.
 *
 * Source: MoonTracks, "Void of Course Moon Periods", August 2026, UTC.
 * https://www.moontracks.com/void_of_course_moon_dates.html
 *
 * Incidentally this refutes the widely repeated folklore that the Moon is void
 * ~13% of the time: the published table for August 2026 gives ~30%, and so
 * does Kairos. Long voids are normal, which is exactly why an election app
 * has to compute them instead of assuming them away.
 */
const test = require('node:test');
const assert = require('node:assert');
const env = require('./load.js');
const { KEphem: E, KAspects: AS } = env;

// [void begins (UTC), sign the Moon is leaving, Moon enters next sign (UTC)]
const PUBLISHED = [
  ['2026-08-02T12:33Z', 'Pisces', '2026-08-02T20:36Z'],
  ['2026-08-04T18:51Z', 'Aries', '2026-08-05T02:35Z'],
  ['2026-08-06T23:25Z', 'Taurus', '2026-08-07T06:07Z'],
  ['2026-08-09T05:27Z', 'Gemini', '2026-08-09T07:45Z'],
  ['2026-08-10T07:30Z', 'Cancer', '2026-08-11T08:38Z'],
  ['2026-08-12T17:36Z', 'Leo', '2026-08-13T10:18Z'],
  ['2026-08-13T19:23Z', 'Virgo', '2026-08-15T14:19Z'],
  ['2026-08-17T11:30Z', 'Libra', '2026-08-17T21:46Z'],
  ['2026-08-20T02:46Z', 'Scorpio', '2026-08-20T08:30Z'],
  ['2026-08-24T06:30Z', 'Capricorn', '2026-08-25T09:01Z'],
  ['2026-08-26T21:59Z', 'Aquarius', '2026-08-27T19:03Z'],
  ['2026-08-28T16:14Z', 'Pisces', '2026-08-30T02:37Z']
];

const MIN = 60000;

test('sign ingress times match the published table within 3 minutes', () => {
  for (const [begins, sign, enters] of PUBLISHED) {
    const t = new Date(Date.parse(begins) + 30 * MIN);
    assert.strictEqual(E.signName(E.longitude('Moon', t)), sign,
      `${begins}: Moon should still be in ${sign}`);
    const exit = E.moonSignExit(t);
    const errMin = Math.abs(exit - Date.parse(enters)) / MIN;
    assert.ok(errMin < 3, `${enters}: ingress off by ${errMin.toFixed(1)} min`);
  }
});

// MoonTracks counts aspects to the outer planets: the 13 Aug void opens on the
// Moon's square to Uranus, which no traditional author could have used. That
// row is therefore the modern definition's, and only the modern one's.
const MODERN_ONLY = new Set(['2026-08-13T19:23Z']);
const MODERN = { includeOuters: true };

test('void periods start when the published table says they start', () => {
  const tr = AS.track(Date.parse('2026-08-01T00:00:00Z'), 34);
  for (const [begins] of PUBLISHED) {
    const t = Date.parse(begins);
    assert.strictEqual(AS.moonVoid(new Date(t + 10 * MIN), null, 3, tr, MODERN).isVoid, true,
      `${begins}: should be void just after the last aspect`);
    assert.strictEqual(AS.moonVoid(new Date(t - 10 * MIN), null, 3, tr, MODERN).isVoid, false,
      `${begins}: should NOT be void just before the last aspect`);
  }
});

test('the last aspect before each void is reported within 3 minutes', () => {
  const tr = AS.track(Date.parse('2026-08-01T00:00:00Z'), 34);
  for (const [begins] of PUBLISHED) {
    const t = Date.parse(begins);
    // Two hours earlier the Moon is not yet void; its next aspect is the very
    // one whose perfection opens the void period.
    const v = AS.moonVoid(new Date(t - 2 * 3600000), null, 3, tr, MODERN);
    assert.ok(v.nextAspect, `${begins}: expected a pending aspect two hours before`);
    const errMin = Math.abs(v.nextAspect.date - t) / MIN;
    assert.ok(errMin < 3, `${begins}: last aspect off by ${errMin.toFixed(1)} min ` +
      `(reported ${v.nextAspect.planet} ${v.nextAspect.angle} at ${v.nextAspect.date.toISOString()})`);
  }
});

test('the traditional definition agrees except where an outer planet is the cause', () => {
  const tr = AS.track(Date.parse('2026-08-01T00:00:00Z'), 34);
  for (const [begins] of PUBLISHED) {
    const t = Date.parse(begins);
    const stillVoid = AS.moonVoid(new Date(t - 10 * MIN), null, 3, tr).isVoid;
    if (MODERN_ONLY.has(begins)) {
      assert.strictEqual(stillVoid, true,
        `${begins}: traditionally the Moon was already void before this Uranus aspect`);
    } else {
      assert.strictEqual(stillVoid, false, `${begins}: traditional reading should agree here`);
    }
  }
});

test('the two definitions differ by a documented amount, not silently', () => {
  const T0 = Date.parse('2026-08-01T00:00:00Z');
  const tr = AS.track(T0, 34);
  let trad = 0, modern = 0;
  for (let h = 0; h < 24 * 30; h++) {
    const d = new Date(T0 + h * 3600000);
    if (AS.moonVoid(d, null, 3, tr).isVoid) trad++;
    if (AS.moonVoid(d, null, 3, tr, MODERN).isVoid) modern++;
  }
  assert.ok(modern < trad, 'more aspecting bodies can only shorten voids');
  assert.ok(trad / 720 > 0.2 && trad / 720 < 0.4, `traditional void share ${(trad / 7.2).toFixed(1)}%`);
  assert.ok(modern / 720 > 0.1 && modern / 720 < 0.3, `modern void share ${(modern / 7.2).toFixed(1)}%`);
});
