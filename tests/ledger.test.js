/* The Ledger: the module whose whole job is to let the app be wrong. */
const test = require('node:test');
const assert = require('node:assert');
const env = require('./load.js');
const { KStats: S, KDb: DB } = env;

const rep = (v, n) => new Array(n).fill(v);

test('mean and sd behave, and refuse to invent numbers', () => {
  assert.strictEqual(S.mean([1, 2, 3, 4]), 2.5);
  assert.strictEqual(S.mean([]), null);
  assert.ok(Math.abs(S.sd([2, 4, 4, 4, 5, 5, 7, 9]) - 2.138) < 0.01);
  assert.strictEqual(S.sd([5]), null, 'one point has no spread');
});

test('ranks average ties', () => {
  assert.deepStrictEqual(Array.from(S.rank([10, 20, 30])), [1, 2, 3]);
  assert.deepStrictEqual(Array.from(S.rank([10, 10, 30])), [1.5, 1.5, 3]);
  assert.deepStrictEqual(Array.from(S.rank([5, 5, 5, 5])), [2.5, 2.5, 2.5, 2.5]);
});

test('Spearman is +1 for a monotone rise and -1 for a monotone fall', () => {
  assert.ok(Math.abs(S.spearman([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]) - 1) < 1e-9);
  assert.ok(Math.abs(S.spearman([1, 2, 3, 4, 5], [9, 7, 5, 3, 1]) + 1) < 1e-9);
});

test('Spearman is 0 when one variable is constant', () => {
  assert.strictEqual(S.spearman([1, 2, 3], [4, 4, 4]), 0);
  assert.strictEqual(S.spearman([1], [1]), 0, 'a single pair says nothing');
});

test('quantile interpolates', () => {
  const xs = [1, 2, 3, 4, 5];
  assert.strictEqual(S.quantile(xs, 0), 1);
  assert.strictEqual(S.quantile(xs, 1), 5);
  assert.strictEqual(S.quantile(xs, 0.5), 3);
});

/* ---- the minimum-sample gates ---- */

test('nothing is claimed below the per-arm minimum', () => {
  const r = S.compare([4, 5, 4, 5], rep(3, 20));    // only 4 elected
  assert.strictEqual(r.status, 'insufficient');
  assert.strictEqual(r.verdict, 'Not enough data yet.');
  assert.strictEqual(r.diff, undefined, 'an insufficient result must not report a difference');
});

test('nothing is claimed below the total minimum', () => {
  const r = S.compare([5, 5, 5, 5, 5], [1, 1, 1, 1, 1]);   // n=10 < 12, though wildly different
  assert.strictEqual(r.status, 'insufficient');
  assert.ok(r.detail.indexOf('12') >= 0, 'the gate should say what it needs');
});

test('an empty ledger reports insufficiency, not an error', () => {
  const r = S.compare([], []);
  assert.strictEqual(r.status, 'insufficient');
  assert.strictEqual(r.n, 0);
  assert.strictEqual(r.elected.mean, null);
});

test('the insufficiency message counts both arms', () => {
  const r = S.compare([4, 4, 4], [2, 2]);
  assert.strictEqual(r.elected.n, 3);
  assert.strictEqual(r.control.n, 2);
});

/* ---- what it says once it has data ---- */

test('a real difference is reported with a CI that excludes zero', () => {
  const r = S.compare(rep(5, 12).map((v, i) => (i % 2 ? 5 : 4)), rep(2, 12).map((v, i) => (i % 2 ? 2 : 1)));
  assert.strictEqual(r.status, 'positive');
  assert.ok(r.diff > 2);
  assert.ok(r.ci[0] > 0, 'the interval must clear zero to claim an effect');
  assert.ok(r.ci[0] < r.ci[1]);
});

test('a small difference inside the noise is reported as null, not as a win', () => {
  const elected = [3, 4, 3, 5, 2, 4, 3, 4];
  const control = [3, 3, 4, 2, 4, 3, 3, 4];
  const r = S.compare(elected, control);
  assert.strictEqual(r.status, 'null');
  assert.strictEqual(r.verdict, 'No measurable difference.');
  assert.ok(r.ci[0] <= 0 && r.ci[1] >= 0);
});

test('the app is willing to say its advice made things worse', () => {
  const r = S.compare(rep(2, 12), rep(4, 12).map((v, i) => (i % 3 ? 4 : 5)));
  assert.strictEqual(r.status, 'negative');
  assert.ok(r.diff < 0);
  assert.ok(/LOWER/.test(r.verdict), 'a negative result must be stated plainly');
});

test('identical groups produce a null verdict', () => {
  const xs = [1, 2, 3, 4, 5, 1, 2, 3];
  assert.strictEqual(S.compare(xs.slice(), xs.slice()).status, 'null');
});

test('the confidence interval brackets the observed difference', () => {
  const r = S.compare([5, 4, 5, 4, 5, 4, 5, 4], [2, 3, 2, 3, 2, 3, 2, 3]);
  assert.ok(r.ci[0] <= r.diff && r.diff <= r.ci[1]);
});

test('an effect size accompanies the raw difference', () => {
  const r = S.compare([5, 4, 5, 4, 5, 4, 5, 4], [2, 3, 2, 3, 2, 3, 2, 3]);
  assert.strictEqual(typeof r.effectSize, 'number');
  assert.ok(Math.abs(r.effectSize) > 1, 'a two-point gap on a five-point scale is a large effect');
});

test('the same ledger always yields the same interval', () => {
  const a = S.compare([5, 4, 5, 3, 5, 4, 2, 5], [2, 3, 2, 4, 1, 3, 3, 2]);
  const b = S.compare([5, 4, 5, 3, 5, 4, 2, 5], [2, 3, 2, 4, 1, 3, 3, 2]);
  assert.deepStrictEqual(a.ci, b.ci, 'statistics that jitter on reopen are not trustworthy');
  assert.strictEqual(a.effectSize, b.effectSize);
});

test('the gates can be tightened but not silently bypassed', () => {
  const r = S.compare([5, 5, 5], [1, 1, 1], { minPerArm: 3, minTotal: 6 });
  assert.notStrictEqual(r.status, 'insufficient');
  const strict = S.compare([5, 5, 5], [1, 1, 1], { minPerArm: 10, minTotal: 30 });
  assert.strictEqual(strict.status, 'insufficient');
});

test('every non-null result explains its own method', () => {
  const r = S.compare([5, 4, 5, 4, 5, 4, 5, 4], [2, 3, 2, 3, 2, 3, 2, 3]);
  assert.ok(/bootstrap/.test(r.detail));
  assert.ok(/95%/.test(r.detail));
});

/* ---- calibration: does the score itself predict anything? ---- */

test('calibration refuses to speak below the minimum', () => {
  const r = S.calibration([[70, 5], [40, 2], [60, 4]]);
  assert.strictEqual(r.status, 'insufficient');
  assert.ok(r.need > 0);
});

test('calibration detects a score that tracks outcomes', () => {
  const pairs = [];
  for (let i = 0; i < 20; i++) pairs.push([40 + i * 2, 1 + Math.floor(i / 5)]);
  const r = S.calibration(pairs);
  assert.strictEqual(r.status, 'positive');
  assert.ok(r.rho > 0.8);
  assert.ok(r.ci[0] > 0);
});

test('calibration says so when the score is noise', () => {
  const pairs = [[70, 3], [40, 4], [65, 2], [50, 5], [80, 1], [45, 3],
    [75, 2], [55, 4], [60, 3], [85, 2], [42, 5], [68, 1], [58, 4], [72, 3]];
  const r = S.calibration(pairs);
  assert.ok(r.status === 'null' || r.status === 'negative');
  if (r.status === 'null') assert.ok(/does not track/.test(r.verdict));
});

test('calibration will report an inverted score', () => {
  const pairs = [];
  for (let i = 0; i < 20; i++) pairs.push([40 + i * 2, 5 - Math.floor(i / 5)]);
  const r = S.calibration(pairs);
  assert.strictEqual(r.status, 'negative');
  assert.ok(r.rho < -0.8);
  assert.ok(/WORSE/.test(r.verdict));
});

test('byGroup splits a ledger into per-topic comparisons', () => {
  const entries = [];
  for (let i = 0; i < 8; i++) entries.push({ group: 'work', elected: true, rating: 4 });
  for (let i = 0; i < 8; i++) entries.push({ group: 'work', elected: false, rating: 2 });
  for (let i = 0; i < 3; i++) entries.push({ group: 'love', elected: true, rating: 5 });
  const out = S.byGroup(entries, (e) => e.group);
  assert.strictEqual(out.work.status, 'positive');
  assert.strictEqual(out.love.status, 'insufficient', 'a thin group must not borrow confidence');
});

test('byGroup ignores unrated entries', () => {
  const entries = [{ group: 'work', elected: true, rating: null }, { group: 'work', elected: true, rating: 4 }];
  const out = S.byGroup(entries, (e) => e.group);
  assert.strictEqual(out.work.elected.n, 1);
});

/* ---- storage ---- */

test('a blank database has the shape the app expects', () => {
  DB.reset();
  const s = DB.load();
  assert.strictEqual(s.version, 1);
  assert.strictEqual(s.profile, null);
  assert.deepStrictEqual(Array.from(s.ledger), []);
  assert.strictEqual(s.settings.houseSystem, 'whole');
  assert.strictEqual(s.settings.includeOuters, false, 'traditional is the default');
});

test('set() writes nested paths', () => {
  DB.reset();
  DB.set('profile', { name: 'A', birthISO: '1985-06-14T08:30' });
  DB.set('settings.houseSystem', 'placidus');
  assert.strictEqual(DB.load().profile.name, 'A');
  assert.strictEqual(DB.load().settings.houseSystem, 'placidus');
});

test('ledger entries get an id and a creation stamp', () => {
  DB.reset();
  const e = DB.addLedger({ intentId: 'sign_contract', when: new Date().toISOString(), elected: true });
  assert.ok(e.id && e.id.length > 3);
  assert.ok(e.createdAt);
  assert.strictEqual(DB.load().ledger.length, 1);
});

test('ledger ids do not collide', () => {
  DB.reset();
  const ids = new Set();
  for (let i = 0; i < 50; i++) ids.add(DB.addLedger({ intentId: 'x', when: '2026-01-01T00:00:00Z' }).id);
  assert.strictEqual(ids.size, 50);
});

test('updateLedger patches by id and leaves the rest alone', () => {
  DB.reset();
  const a = DB.addLedger({ intentId: 'a', when: '2026-01-01T00:00:00Z', rating: null });
  const b = DB.addLedger({ intentId: 'b', when: '2026-01-02T00:00:00Z', rating: null });
  DB.updateLedger(a.id, { rating: 4 });
  const st = DB.load();
  assert.strictEqual(st.ledger.find((x) => x.id === a.id).rating, 4);
  assert.strictEqual(st.ledger.find((x) => x.id === b.id).rating, null);
  assert.strictEqual(DB.updateLedger('missing', { rating: 1 }), null);
});

test('removeLedger deletes exactly one entry', () => {
  DB.reset();
  const a = DB.addLedger({ intentId: 'a', when: '2026-01-01T00:00:00Z' });
  DB.addLedger({ intentId: 'b', when: '2026-01-02T00:00:00Z' });
  DB.removeLedger(a.id);
  assert.strictEqual(DB.load().ledger.length, 1);
  assert.strictEqual(DB.load().ledger[0].intentId, 'b');
});

test('pendingOutcomes finds past unrated events only', () => {
  DB.reset();
  const past = new Date(Date.now() - 86400000).toISOString();
  const future = new Date(Date.now() + 86400000).toISOString();
  DB.addLedger({ intentId: 'past-unrated', when: past, rating: null });
  DB.addLedger({ intentId: 'past-rated', when: past, rating: 4 });
  DB.addLedger({ intentId: 'future', when: future, rating: null });
  const p = DB.pendingOutcomes();
  assert.strictEqual(p.length, 1);
  assert.strictEqual(p[0].intentId, 'past-unrated');
});

test('export and import round-trip the whole state', () => {
  DB.reset();
  DB.set('profile', { name: 'Round', birthISO: '1990-01-01T12:00' });
  DB.addLedger({ intentId: 'sign_lease', when: '2026-05-05T10:00:00Z', rating: 3, elected: true });
  const json = DB.exportJson();
  DB.reset();
  assert.strictEqual(DB.load().ledger.length, 0);
  DB.importJson(json);
  assert.strictEqual(DB.load().profile.name, 'Round');
  assert.strictEqual(DB.load().ledger.length, 1);
  assert.strictEqual(DB.load().ledger[0].rating, 3);
});

test('import rejects anything that is not a Kairos backup', () => {
  assert.throws(() => DB.importJson('{"hello":1}'), /version/);
  assert.throws(() => DB.importJson('not json'), /.*/);
});

test('import repairs a backup missing its settings', () => {
  DB.reset();
  DB.importJson(JSON.stringify({ version: 1, profile: null }));
  assert.ok(DB.load().settings.houseSystem);
  assert.deepStrictEqual(Array.from(DB.load().ledger), []);
});
