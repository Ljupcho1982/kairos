/* iCalendar in and out — the Grader's front door. */
const test = require('node:test');
const assert = require('node:assert');
const env = require('./load.js');
const { KIcs: I, KIntents: KI, KPlaces: P } = env;

const CAL = [
  'BEGIN:VCALENDAR', 'VERSION:2.0',
  'BEGIN:VEVENT', 'UID:a@x', 'SUMMARY:Sign the lease',
  'DTSTART:20260812T090000Z', 'DTEND:20260812T100000Z', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:b@x', 'SUMMARY:Team offsite', 'LOCATION:Ohrid',
  'DTSTART;TZID=Europe/Skopje:20260815T140000', 'DTEND;TZID=Europe/Skopje:20260815T160000', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:c@x', 'SUMMARY:Public holiday',
  'DTSTART;VALUE=DATE:20260901', 'DTEND;VALUE=DATE:20260902', 'END:VEVENT',
  'END:VCALENDAR'
].join('\r\n');

test('parses every VEVENT in a calendar', () => {
  const events = I.parse(CAL);
  assert.strictEqual(events.length, 3);
  assert.strictEqual(events[0].summary, 'Sign the lease');
  assert.strictEqual(events[1].location, 'Ohrid');
});

test('reads UTC timestamps as UTC', () => {
  const e = I.parse(CAL)[0];
  assert.strictEqual(e.start.toISOString(), '2026-08-12T09:00:00.000Z');
  assert.strictEqual(e.end.toISOString(), '2026-08-12T10:00:00.000Z');
});

test('treats a TZID timestamp as local rather than pretending it is UTC', () => {
  const e = I.parse(CAL)[1];
  assert.strictEqual(e.start.getHours(), 14);
  assert.strictEqual(e.start.getMinutes(), 0);
});

test('flags all-day events', () => {
  const events = I.parse(CAL);
  assert.strictEqual(events[2].allDay, true);
  assert.strictEqual(events[0].allDay, false);
});

test('supplies a default end when DTEND is missing', () => {
  const one = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:z', 'SUMMARY:No end',
    'DTSTART:20260812T090000Z', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const e = I.parse(one)[0];
  assert.strictEqual(e.end - e.start, 3600000);
});

test('unfolds RFC 5545 continuation lines', () => {
  // The whitespace that opens a continuation line is the fold marker itself and
  // is removed; the original octets are preserved exactly. So an exporter that
  // wants a space in the content puts it at the end of the previous line.
  const folded = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:f',
    'SUMMARY:A very long title that the exporter ', ' split across two lines',
    'DTSTART:20260812T090000Z', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  assert.strictEqual(I.parse(folded)[0].summary,
    'A very long title that the exporter split across two lines');
});

test('a long title survives fold and unfold unchanged', () => {
  const summary = 'Contract signing with a counterparty whose legal name is long enough ' +
    'to force the exporter to fold this line more than once, commas and all';
  const back = I.parse(I.build([{ start: new Date('2026-08-12T09:00:00Z'), summary: summary }]));
  assert.strictEqual(back[0].summary, summary);
});

test('unescapes commas, semicolons and newlines', () => {
  const esc = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:e',
    'SUMMARY:Meet Ana\\, Bob\\; then go', 'DESCRIPTION:line one\\nline two',
    'DTSTART:20260812T090000Z', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const e = I.parse(esc)[0];
  assert.strictEqual(e.summary, 'Meet Ana, Bob; then go');
  assert.strictEqual(e.description, 'line one\nline two');
});

test('skips events with no start, rather than inventing one', () => {
  const bad = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:n', 'SUMMARY:No start',
    'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  assert.strictEqual(I.parse(bad).length, 0);
});

test('parsing junk yields no events instead of throwing', () => {
  assert.strictEqual(I.parse('').length, 0);
  assert.strictEqual(I.parse('hello world').length, 0);
  assert.strictEqual(I.parse('BEGIN:VEVENT').length, 0);
});

test('escapeText and unescapeText round-trip', () => {
  const s = 'a, b; c\\d\ne';
  assert.strictEqual(I.unescapeText(I.escapeText(s)), s);
});

test('parseDate handles date-only, floating and UTC forms', () => {
  assert.strictEqual(I.parseDate('20260901').getDate(), 1);
  assert.strictEqual(I.parseDate('20260901T133000').getHours(), 13);
  assert.strictEqual(I.parseDate('20260901T133000Z').toISOString(), '2026-09-01T13:30:00.000Z');
  assert.strictEqual(I.parseDate('nonsense'), null);
});

test('build produces a calendar a parser can read back', () => {
  const start = new Date('2026-08-12T09:00:00Z');
  const out = I.build([{ start: start, end: new Date('2026-08-12T10:30:00Z'),
    summary: 'Elected: sign the lease', description: 'because the Moon applies to Venus' }], 'Kairos');
  assert.ok(/^BEGIN:VCALENDAR/.test(out));
  assert.ok(/END:VCALENDAR\r\n$/.test(out));
  assert.ok(/PRODID:.*Kairos/.test(out));
  const back = I.parse(out);
  assert.strictEqual(back.length, 1);
  assert.strictEqual(back[0].start.toISOString(), start.toISOString());
  assert.strictEqual(back[0].summary, 'Elected: sign the lease');
});

test('build uses CRLF line endings as the spec requires', () => {
  const out = I.build([{ start: new Date(), summary: 'x' }]);
  assert.ok(out.indexOf('\r\n') > 0);
  assert.strictEqual(out.split('\n').filter((l) => l.length && !l.endsWith('\r')).length, 0);
});

test('build folds long lines', () => {
  const long = 'x'.repeat(300);
  const out = I.build([{ start: new Date(), summary: long }]);
  for (const line of out.split('\r\n')) assert.ok(line.length <= 75, `line of ${line.length} chars`);
});

test('build gives every event a UID', () => {
  const out = I.build([{ start: new Date(), summary: 'a' }, { start: new Date(), summary: 'b' }]);
  const uids = out.split('\r\n').filter((l) => l.indexOf('UID:') === 0);
  assert.strictEqual(uids.length, 2);
  assert.notStrictEqual(uids[0], uids[1]);
});

test('fmtUTC formats to the second in Zulu time', () => {
  assert.strictEqual(I.fmtUTC(new Date('2026-08-12T09:05:03Z')), '20260812T090503Z');
});

/* ---- intent guessing ---- */

test('guessIntent recognises English titles', () => {
  assert.strictEqual(I.guessIntent('Contract signing with ACME'), 'sign_contract');
  assert.strictEqual(I.guessIntent('Job interview — 2nd round'), 'job_interview');
  assert.strictEqual(I.guessIntent('Rent negotiation with landlord'), 'negotiate');
  assert.strictEqual(I.guessIntent('Flight to Vienna'), 'start_journey');
  assert.strictEqual(I.guessIntent('Surgery consult'), 'elective_procedure');
});

test('guessIntent recognises Macedonian titles', () => {
  assert.strictEqual(I.guessIntent('Договор со банка'), 'sign_contract');
  assert.strictEqual(I.guessIntent('Интервју за работа'), 'job_interview');
  assert.strictEqual(I.guessIntent('Селидба во нов стан'), 'move_house');
  assert.strictEqual(I.guessIntent('Курс по германски'), 'begin_study');
});

test('the more specific reading wins', () => {
  // "Sign the lease" contains "sign", but a lease is not a generic contract.
  assert.strictEqual(I.guessIntent('Sign the lease'), 'sign_lease');
});

test('guessIntent refuses to guess rather than guessing wrong', () => {
  assert.strictEqual(I.guessIntent('Lunch with Ana'), null);
  assert.strictEqual(I.guessIntent('designer meeting'), null);
  assert.strictEqual(I.guessIntent(''), null);
  assert.strictEqual(I.guessIntent(null), null);
  assert.strictEqual(I.guessIntent('   '), null);
});

test('guessIntent matches whole words, not fragments', () => {
  assert.strictEqual(I.guessIntent('Designing a class hierarchy'), 'begin_study',
    'the word "class" does appear on its own');
  assert.strictEqual(I.guessIntent('Reclassify the tickets'), null,
    '"class" inside "reclassify" must not match');
});

test('every intent guessIntent can return actually exists', () => {
  const titles = ['Sign the lease', 'Job interview', 'Rent negotiation', 'Contract signing',
    'Surgery consult', 'Flight to Vienna', 'Moving day', 'Tax return filing',
    'Product launch', 'Course on statistics', 'Salary review', 'Date night',
    'Treatment start', 'Booking flights', 'Difficult conversation', 'Engagement dinner',
    'Buying a car'];
  for (const t of titles) {
    const id = I.guessIntent(t);
    if (id) assert.ok(KI.get(id), `"${t}" mapped to unknown intent ${id}`);
  }
});

/* ---- the offline place list ---- */

test('the bundled place list is usable offline and well formed', () => {
  assert.ok(P.length >= 40);
  const labels = new Set();
  for (const p of P) {
    assert.ok(typeof p.label === 'string' && p.label.indexOf(',') > 0, p.label);
    assert.ok(p.lat >= -90 && p.lat <= 90, p.label);
    assert.ok(p.lon >= -180 && p.lon <= 180, p.label);
    labels.add(p.label);
  }
  assert.strictEqual(labels.size, P.length, 'no duplicate places');
});

test('the place list covers both hemispheres', () => {
  assert.ok(P.some((p) => p.lat < 0), 'southern hemisphere missing');
  assert.ok(P.some((p) => p.lon < 0), 'western hemisphere missing');
  assert.ok(P.some((p) => Math.abs(p.lat) > 55), 'high latitudes missing');
});
