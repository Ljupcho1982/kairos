/* Kairos — the election search runs off the main thread so the UI keeps its
 * progress bar honest on a mid-range phone. Classic worker + importScripts so
 * the same engine files serve the page and the worker unchanged.
 */
importScripts(
  '../../vendor/astronomy.browser.min.js',
  '../astro/ephem.js',
  '../astro/dignity.js',
  '../astro/aspects.js',
  '../astro/hours.js',
  '../astro/timelords.js',
  '../election/intents.js',
  '../election/score.js',
  '../election/search.js'
);

function reviveNatal(n) {
  if (!n) return null;
  n.birth = new Date(n.birth);
  n.date = new Date(n.date);
  return n;
}

self.onmessage = function (ev) {
  var msg = ev.data || {};
  try {
    if (msg.type === 'search') {
      var o = msg.opts;
      var natal = o.natalBirth
        ? KEphem.natal(new Date(o.natalBirth), o.place, o.houseSystem)
        : null;
      var result = KSearch.search({
        intentId: o.intentId,
        place: o.place,
        from: new Date(o.from),
        to: new Date(o.to),
        days: o.days,
        hours: o.hours,
        houseSystem: o.houseSystem,
        includeOuters: o.includeOuters,
        natal: natal,
        onProgress: function (f) { self.postMessage({ type: 'progress', value: f, id: msg.id }); }
      });
      self.postMessage({ type: 'result', id: msg.id, result: strip(result) });

    } else if (msg.type === 'grade') {
      var g = msg.opts;
      var nat = g.natalBirth ? KEphem.natal(new Date(g.natalBirth), g.place, g.houseSystem) : null;
      var out = g.events.map(function (e) {
        var when = new Date(e.start);
        var detail = KSearch.grade(when, {
          intentId: e.intentId, place: g.place, natal: nat,
          houseSystem: g.houseSystem, includeOuters: g.includeOuters
        });
        return { uid: e.uid, summary: e.summary, start: e.start, intentId: e.intentId, detail: detail };
      });
      self.postMessage({ type: 'graded', id: msg.id, events: out });

    } else if (msg.type === 'chapter') {
      var c = msg.opts;
      var n2 = KEphem.natal(new Date(c.natalBirth), c.place, c.houseSystem);
      self.postMessage({
        type: 'chapter', id: msg.id,
        chapter: KTimelords.chapter(n2, new Date(c.when)),
        natal: {
          asc: n2.asc, mc: n2.mc, sect: n2.sect, isDay: n2.isDay,
          lots: n2.lots, bodies: n2.bodies, houses: { system: n2.houses.system, cusps: n2.houses.cusps }
        }
      });
    }
  } catch (err) {
    self.postMessage({ type: 'error', id: msg.id, message: String(err && err.message || err) });
  }
};

/* Dates survive structured clone, but the sky snapshots hanging off each
 * window are large and the UI never reads them. Drop them at the boundary. */
function strip(result) {
  return {
    intent: result.intent,
    chapter: result.chapter,
    scanned: result.scanned,
    median: result.median,
    message: result.message,
    avoid: result.avoid ? { at: result.avoid.at, score: result.avoid.score,
      reasons: result.avoid.detail.reasons.slice(0, 4) } : null,
    windows: (result.windows || []).map(function (w) {
      return {
        from: w.from, to: w.to, at: w.at, score: w.score,
        voidOfCourse: w.detail.voidOfCourse,
        moonSign: w.detail.moonSign,
        hour: w.detail.hour,
        good: w.detail.good.slice(0, 6),
        bad: w.detail.bad.slice(0, 5),
        notes: w.detail.notes
      };
    })
  };
}
