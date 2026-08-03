/* The intent taxonomy, the scorer and the search. */
const test = require('node:test');
const assert = require('node:assert');
const env = require('./load.js');
const { KEphem: E, KIntents: KI, KScore: KS, KSearch: SS, KDignity: D } = env;

const SKOPJE = { lat: 41.9973, lon: 21.4280 };
const NATAL = E.natal(new Date('1985-06-14T08:30:00Z'), SKOPJE);
const WHEN = new Date('2026-08-05T10:00:00Z');

/* ---------------- taxonomy integrity ---------------- */

test('every intent has a unique id', () => {
  const ids = KI.INTENTS.map((i) => i.id);
  assert.strictEqual(new Set(ids).size, ids.length);
});

test('every intent names a real house, planet and group', () => {
  const groups = new Set(KI.GROUPS.map((g) => g.id));
  for (const i of KI.INTENTS) {
    assert.ok(i.house >= 1 && i.house <= 12, `${i.id} house ${i.house}`);
    assert.ok(E.CLASSICAL.indexOf(i.sig) >= 0, `${i.id} significator ${i.sig} is not a classical planet`);
    assert.ok(groups.has(i.group), `${i.id} group ${i.group}`);
    assert.ok(i.ruler === 'houseRuler' || i.ruler === 'ascRuler', `${i.id} ruler ${i.ruler}`);
  }
});

test('every intent carries a label, an icon and an explanation', () => {
  for (const i of KI.INTENTS) {
    assert.ok(i.label && i.label.length > 2, i.id);
    assert.ok(i.icon && i.icon.length > 0, i.id);
    assert.ok(i.note && i.note.length > 30, `${i.id} needs a real explanation, not a stub`);
  }
});

test('every intent defines the full weight set', () => {
  const keys = ['moon', 'moonApplying', 'voidVeto', 'sigCondition', 'ascRuler',
    'mercuryRetro', 'marsAngular', 'saturnAngular', 'waxing'];
  for (const i of KI.INTENTS) {
    for (const k of keys) {
      assert.strictEqual(typeof i.w[k], 'number', `${i.id} is missing weight ${k}`);
      assert.ok(i.w[k] >= 0 && i.w[k] <= 2, `${i.id}.${k} = ${i.w[k]} is out of range`);
    }
  }
});

test('Mercury retrograde is weighted per matter, not universally', () => {
  const heavy = KI.INTENTS.filter((i) => i.w.mercuryRetro >= 1.2).map((i) => i.id);
  const light = KI.INTENTS.filter((i) => i.w.mercuryRetro < 0.8).map((i) => i.id);
  // The tradition applies it to contracts, purchases, messages and travel.
  for (const id of ['sign_contract', 'big_purchase', 'buy_ticket', 'start_journey', 'launch_publish']) {
    assert.ok(heavy.indexOf(id) >= 0, `${id} should take Mercury retrograde seriously`);
  }
  // and not to courtship or the body.
  for (const id of ['first_date', 'start_regimen', 'ask_favour']) {
    assert.ok(light.indexOf(id) >= 0, `${id} should not be vetoed by Mercury retrograde`);
  }
});

test('every group contains at least two intents', () => {
  for (const g of KI.GROUPS) assert.ok(KI.inGroup(g.id).length >= 2, g.id);
});

test('every intent belongs to a listed group and every group is used', () => {
  const used = new Set(KI.INTENTS.map((i) => i.group));
  for (const g of KI.GROUPS) assert.ok(used.has(g.id), `group ${g.id} has no intents`);
  assert.strictEqual(used.size, KI.GROUPS.length);
});

test('cautioned intents point at a caution text that exists', () => {
  const cautioned = KI.INTENTS.filter((i) => i.caution);
  assert.ok(cautioned.length >= 3, 'medical and legal intents must be flagged');
  for (const i of cautioned) {
    assert.ok(KI.CAUTIONS[i.caution], `${i.id} references missing caution ${i.caution}`);
    assert.ok(KI.CAUTIONS[i.caution].length > 40);
  }
});

test('every medical intent is cautioned', () => {
  for (const i of KI.inGroup('health')) {
    if (i.id === 'start_regimen') continue;   // a diet is not medical care
    assert.strictEqual(i.caution, 'medical', `${i.id} must carry the medical caution`);
  }
});

test('get() and inGroup() agree with the table', () => {
  assert.strictEqual(KI.get('sign_contract').label, 'Sign a contract');
  assert.strictEqual(KI.get('nope'), null);
  assert.strictEqual(KI.inGroup('love').length, KI.INTENTS.filter((i) => i.group === 'love').length);
});

/* ---------------- the scorer ---------------- */

function scoreAt(intentId, when, opts) {
  const sky = E.sky(when, SKOPJE, { houseSystem: 'whole' });
  return KS.score(sky, KI.get(intentId), Object.assign({ natal: NATAL }, opts || {}));
}

test('a score is an integer between 0 and 100', () => {
  for (const i of KI.INTENTS) {
    const s = scoreAt(i.id, WHEN);
    assert.ok(Number.isInteger(s.score), `${i.id} produced ${s.score}`);
    assert.ok(s.score >= 0 && s.score <= 100, `${i.id} produced ${s.score}`);
  }
});

test('every reason carries points, a label and a source', () => {
  const s = scoreAt('sign_contract', WHEN);
  assert.ok(s.reasons.length >= 4);
  for (const r of s.reasons) {
    assert.strictEqual(typeof r.points, 'number');
    assert.ok(r.label && r.label.length > 4, JSON.stringify(r));
    assert.ok(r.source && r.source.length > 3, JSON.stringify(r));
    assert.ok(['good', 'bad', 'note'].indexOf(r.kind) >= 0);
  }
});

test('reasons split cleanly into good, bad and notes', () => {
  const s = scoreAt('propose', WHEN);
  assert.strictEqual(s.good.length + s.bad.length + s.notes.length, s.reasons.length);
  for (const r of s.good) assert.ok(r.points > 0);
  for (const r of s.bad) assert.ok(r.points < 0);
  for (const r of s.notes) assert.strictEqual(r.points, 0);
});

test('reasons are ordered by how much they moved the score', () => {
  const s = scoreAt('start_business', WHEN);
  for (let i = 1; i < s.reasons.length; i++) {
    assert.ok(Math.abs(s.reasons[i - 1].points) >= Math.abs(s.reasons[i].points));
  }
});

test('scoring is deterministic', () => {
  const a = scoreAt('negotiate', WHEN), b = scoreAt('negotiate', WHEN);
  assert.strictEqual(a.score, b.score);
  assert.strictEqual(JSON.stringify(a.reasons), JSON.stringify(b.reasons));
});

test('a void-of-course Moon is the heaviest single penalty', () => {
  // Find a void moment and check the rule fires and dominates.
  let found = null;
  for (let h = 0; h < 24 * 12 && !found; h += 2) {
    const when = new Date(Date.parse('2026-08-10T00:00:00Z') + h * 3600000);
    const s = scoreAt('sign_contract', when);
    if (s.voidOfCourse) found = s;
  }
  assert.ok(found, 'no void moment found in twelve days');
  const voidRule = found.reasons.find((r) => /void of course/.test(r.label));
  assert.ok(voidRule, 'the void must be stated in the reasons');
  assert.ok(voidRule.points <= -14, `void penalty was only ${voidRule.points}`);
  assert.strictEqual(found.reasons[0], voidRule, 'the void should top the list');
});

test('the void veto scales with the intent', () => {
  let when = null;
  for (let h = 0; h < 24 * 12 && !when; h += 2) {
    const t = new Date(Date.parse('2026-08-10T00:00:00Z') + h * 3600000);
    if (scoreAt('propose', t).voidOfCourse) when = t;
  }
  const strict = scoreAt('propose', when);            // voidVeto 1.6
  const relaxed = scoreAt('hard_conversation', when); // voidVeto 0.8
  const p = (s) => s.reasons.find((r) => /void of course/.test(r.label)).points;
  assert.ok(p(strict) < p(relaxed), 'a proposal should mind a void Moon more than an argument does');
});

test('Mercury retrograde appears as a note, not a penalty, where it does not apply', () => {
  // Find a retrograde Mercury moment.
  let when = null;
  for (let d = 0; d < 200 && !when; d++) {
    const t = new Date(Date.parse('2026-01-01T00:00:00Z') + d * 86400000);
    if (E.speed('Mercury', t) < 0) when = t;
  }
  assert.ok(when, 'no Mercury retrograde found');
  const contract = scoreAt('sign_contract', when);
  const date = scoreAt('first_date', when);
  assert.ok(contract.reasons.some((r) => /Mercury is retrograde/.test(r.label) && r.points < 0),
    'contracts should be penalised');
  const note = date.notes.find((r) => /Mercury is retrograde/.test(r.label));
  assert.ok(note, 'a first date should get the note instead');
  assert.strictEqual(note.points, 0);
});

test('the planetary hour of the significator is rewarded', () => {
  const sky = E.sky(WHEN, SKOPJE, {});
  const intent = KI.get('sign_contract');           // significator Mercury
  const withHour = KS.score(sky, intent, { hour: { ruler: 'Mercury' } });
  const without = KS.score(sky, intent, { hour: { ruler: 'Saturn' } });
  assert.ok(withHour.score > without.score);
  assert.ok(withHour.reasons.some((r) => /planetary hour belongs to Mercury/.test(r.label)));
});

test('an angular benefic helps and an angular malefic hurts', () => {
  let good = 0, bad = 0;
  for (let h = 0; h < 48; h++) {
    const s = scoreAt('start_business', new Date(Date.parse('2026-08-05T00:00:00Z') + h * 3600000));
    if (s.reasons.some((r) => /Jupiter is angular/.test(r.label) && r.points > 0)) good++;
    if (s.reasons.some((r) => /Mars is angular/.test(r.label) && r.points < 0)) bad++;
  }
  assert.ok(good > 0, 'Jupiter should be angular sometime in two days');
  assert.ok(bad > 0, 'Mars should be angular sometime in two days');
});

test('the natal overlay only fires when a natal chart is supplied', () => {
  // Overlay rules need a transit actually in orb, so scan rather than assume.
  let fired = 0, leaked = 0;
  for (let d = 0; d < 30; d++) {
    const sky = E.sky(new Date(Date.parse('2026-08-01T12:00:00Z') + d * 86400000), SKOPJE, {});
    if (KS.score(sky, KI.get('job_interview'), { natal: NATAL })
      .reasons.some((r) => r.source === 'natal overlay')) fired++;
    if (KS.score(sky, KI.get('job_interview'), {})
      .reasons.some((r) => r.source === 'natal overlay')) leaked++;
  }
  assert.ok(fired > 0, 'the overlay never fired in a month with a natal chart');
  assert.strictEqual(leaked, 0, 'the overlay must be silent without a natal chart');
});

test('the profection year boosts an election on the same house', () => {
  const sky = E.sky(WHEN, SKOPJE, {});
  const chapter = { profection: { house: 7, month: { house: 3 }, lord: 'Venus' } };
  const on = KS.score(sky, KI.get('sign_contract'), { chapter: chapter });   // 7th house intent
  assert.ok(on.reasons.some((r) => /profection year/.test(r.label) && r.points > 0));
});

test('scores actually vary across a month', () => {
  const scores = [];
  for (let d = 0; d < 30; d++) {
    scores.push(scoreAt('sign_contract', new Date(Date.parse('2026-08-01T09:00:00Z') + d * 86400000)).score);
  }
  const min = Math.min.apply(null, scores), max = Math.max.apply(null, scores);
  assert.ok(max - min > 20, `range was only ${min}..${max} — the scorer is not discriminating`);
});

test('different intents disagree about the same moment', () => {
  const a = scoreAt('propose', WHEN).score;
  const b = scoreAt('hard_conversation', WHEN).score;
  const c = scoreAt('buy_ticket', WHEN).score;
  assert.ok(new Set([a, b, c]).size > 1, 'the rule packs are not doing anything');
});

test('aspectName and ordinal render the tradition\'s vocabulary', () => {
  assert.strictEqual(KS.aspectName(120), 'trine');
  assert.strictEqual(KS.aspectName(90), 'square');
  assert.strictEqual(KS.aspectName(0), 'conjunction');
  assert.strictEqual(KS.ordinal(1), '1st');
  assert.strictEqual(KS.ordinal(2), '2nd');
  assert.strictEqual(KS.ordinal(3), '3rd');
  assert.strictEqual(KS.ordinal(7), '7th');
  assert.strictEqual(KS.ordinal(11), '11th');
  assert.strictEqual(KS.ordinal(12), '12th');
});

test('a void ending on another day is labelled with that day', () => {
  const ref = new Date(2026, 7, 24, 17, 17);
  assert.strictEqual(KS.clockOrDay(new Date(2026, 7, 24, 21, 5), ref), '21:05');
  assert.strictEqual(KS.clockOrDay(new Date(2026, 7, 25, 11, 1), ref), '11:01 tomorrow');
  assert.ok(/on \w{3}/.test(KS.clockOrDay(new Date(2026, 8, 2, 9, 30), ref)));
});

/* ---------------- the search ---------------- */

const FROM = new Date('2026-08-04T00:00:00Z');
const TO = new Date('2026-08-14T00:00:00Z');

test('search returns ranked windows inside the requested range', () => {
  const r = SS.search({ intentId: 'sign_contract', place: SKOPJE, from: FROM, to: TO,
    days: [1, 2, 3, 4, 5], hours: [9, 18], natal: NATAL });
  assert.ok(r.windows.length > 0);
  assert.ok(r.windows.length <= 3);
  for (let i = 1; i < r.windows.length; i++) {
    assert.ok(r.windows[i - 1].score >= r.windows[i].score, 'windows must be ranked');
  }
  for (const w of r.windows) {
    assert.ok(w.at >= FROM && w.at <= TO, 'the peak must be inside the range');
    assert.ok(w.from <= w.at && w.at <= w.to);
  }
});

test('search respects the weekday constraint', () => {
  const r = SS.search({ intentId: 'negotiate', place: SKOPJE, from: FROM, to: TO,
    days: [2], hours: [9, 18], natal: null });
  for (const w of r.windows) assert.strictEqual(w.at.getDay(), 2, 'only Tuesdays were allowed');
});

test('search respects the hours constraint', () => {
  const r = SS.search({ intentId: 'ask_favour', place: SKOPJE, from: FROM, to: TO,
    days: [1, 2, 3, 4, 5], hours: [14, 16], natal: null });
  for (const w of r.windows) {
    const h = w.at.getHours();
    assert.ok(h >= 14 && h < 16, `peak at ${h}:00 is outside 14-16`);
  }
});

test('search reports how much it looked at, and a median to compare against', () => {
  const r = SS.search({ intentId: 'move_house', place: SKOPJE, from: FROM, to: TO,
    days: [0, 1, 2, 3, 4, 5, 6], hours: [8, 20], natal: null });
  assert.ok(r.scanned > 200, `only scanned ${r.scanned}`);
  assert.ok(r.median > 0 && r.median < 100);
  assert.ok(r.windows[0].score > r.median, 'the best window should beat the typical moment');
});

test('search names the worst moment as well as the best', () => {
  const r = SS.search({ intentId: 'sign_lease', place: SKOPJE, from: FROM, to: TO,
    days: [1, 2, 3, 4, 5], hours: [9, 18], natal: NATAL });
  assert.ok(r.avoid);
  assert.ok(r.avoid.score < r.windows[0].score);
  assert.ok(r.avoid.detail.reasons.length > 0);
});

test('search returns nothing gracefully when availability excludes everything', () => {
  const r = SS.search({ intentId: 'negotiate', place: SKOPJE, from: FROM, to: TO,
    days: [], hours: [9, 10], natal: null, coarseStepMin: 15 });
  // An empty day list means "no filter", so use an impossible hour range instead.
  const r2 = SS.search({ intentId: 'negotiate', place: SKOPJE, from: FROM,
    to: new Date(FROM.getTime() + 3600000), days: [0], hours: [3, 4], natal: null });
  assert.ok(r.windows.length >= 0);
  assert.strictEqual(r2.windows.length, 0);
  assert.ok(r2.message);
});

test('search rejects a backwards range', () => {
  assert.throws(() => SS.search({ intentId: 'negotiate', place: SKOPJE, from: TO, to: FROM }),
    /ends before it starts/);
});

test('search rejects an unknown intent', () => {
  assert.throws(() => SS.search({ intentId: 'become_a_wizard', place: SKOPJE, from: FROM, to: TO }),
    /unknown intent/);
});

test('search attaches the chapter when a natal chart is given', () => {
  const r = SS.search({ intentId: 'job_interview', place: SKOPJE, from: FROM, to: TO,
    days: [1, 2, 3, 4, 5], hours: [9, 18], natal: NATAL });
  assert.ok(r.chapter && r.chapter.profection);
  const r2 = SS.search({ intentId: 'job_interview', place: SKOPJE, from: FROM, to: TO,
    days: [1, 2, 3, 4, 5], hours: [9, 18], natal: null });
  assert.strictEqual(r2.chapter, null);
});

test('windows are neither instants nor whole days', () => {
  const r = SS.search({ intentId: 'first_date', place: SKOPJE, from: FROM, to: TO,
    days: [5, 6], hours: [18, 23], natal: NATAL });
  for (const w of r.windows) {
    const minutes = (w.to - w.from) / 60000;
    assert.ok(minutes >= 20, `window of ${minutes} min is false precision`);
    assert.ok(minutes <= 180, `window of ${minutes} min is uselessly vague`);
  }
});

test('allowed() filters by weekday and hour in local time', () => {
  const tue10 = new Date(2026, 7, 4, 10, 0);        // a Tuesday
  assert.strictEqual(SS.allowed(tue10, { days: [2], hours: [9, 18] }), true);
  assert.strictEqual(SS.allowed(tue10, { days: [3], hours: [9, 18] }), false);
  assert.strictEqual(SS.allowed(tue10, { days: [2], hours: [11, 18] }), false);
  assert.strictEqual(SS.allowed(tue10, {}), true, 'no constraints means everything is allowed');
});

test('buildWindows merges adjacent minutes and splits distant ones', () => {
  const base = Date.parse('2026-08-05T10:00:00Z');
  const pts = [];
  for (let m = 0; m < 40; m++) pts.push({ t: base + m * 60000, score: 80, detail: { good: [], bad: [], notes: [] } });
  for (let m = 200; m < 230; m++) pts.push({ t: base + m * 60000, score: 78, detail: { good: [], bad: [], notes: [] } });
  const out = SS.buildWindows(pts, { fineStepMin: 1, minWindowMin: 20, maxWindowMin: 180 });
  assert.strictEqual(out.length, 2, 'two separated runs must not merge');
  assert.ok(out[0].score >= out[1].score);
});

test('grade() scores a single moment the same way the search does', () => {
  // grade() supplies the planetary hour and the chapter, so score against the
  // same context rather than the bare helper.
  const g = SS.grade(WHEN, { intentId: 'sign_contract', place: SKOPJE, natal: NATAL });
  const sky = E.sky(WHEN, SKOPJE, { houseSystem: 'whole' });
  const s = KS.score(sky, KI.get('sign_contract'), {
    natal: NATAL,
    chapter: env.KTimelords.chapter(NATAL, WHEN),
    hour: env.KHours.planetaryHour(WHEN, SKOPJE)
  });
  assert.strictEqual(g.score, s.score);
  assert.strictEqual(g.reasons.length, s.reasons.length);
});

test('grade() takes the planetary hour into account', () => {
  const withHour = SS.grade(WHEN, { intentId: 'sign_contract', place: SKOPJE, natal: NATAL });
  const bare = KS.score(E.sky(WHEN, SKOPJE, { houseSystem: 'whole' }), KI.get('sign_contract'), { natal: NATAL });
  assert.ok(withHour.reasons.some((r) => r.source === 'planetary hours'));
  assert.ok(!bare.reasons.some((r) => r.source === 'planetary hours'));
});

test('grade() rejects an unknown intent', () => {
  assert.throws(() => SS.grade(WHEN, { intentId: 'nonsense', place: SKOPJE }), /unknown intent/);
});
