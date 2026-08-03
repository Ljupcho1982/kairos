/* Kairos — the search.
 *
 * Sweep the real sky across the user's stated availability, score every
 * candidate, then refine the best ones to the minute and merge them into
 * windows. A window, not an instant: pretending a chart is good at 10:24:07
 * and bad at 10:25 is false precision, and the tradition never claimed it.
 */
(function (root) {
  'use strict';
  var E = root.KEphem, AS = root.KAspects, KH = root.KHours,
    KI = root.KIntents, KS = root.KScore, KT = root.KTimelords;

  var DEFAULTS = {
    coarseStepMin: 15,
    fineStepMin: 1,
    refineTop: 12,
    windows: 3,
    minWindowMin: 20,
    maxWindowMin: 180,
    houseSystem: 'whole',
    includeOuters: false
  };

  /**
   * @param opts {
   *   intentId, place {lat,lon}, from, to  (Date)
   *   days: [0..6] allowed weekdays (local), hours: [startHour, endHour] local
   *   natal: natal chart or null
   *   onProgress: fn(fraction)
   * }
   */
  function search(opts) {
    var cfg = merge(DEFAULTS, opts);
    var intent = KI.get(cfg.intentId);
    if (!intent) throw new Error('unknown intent: ' + cfg.intentId);

    var from = cfg.from.getTime(), to = cfg.to.getTime();
    if (to <= from) throw new Error('the window ends before it starts');

    // One shared lunar/planetary track for the whole sweep; this is what makes
    // thousands of void-of-course checks affordable.
    var spanDays = Math.ceil((to - from) / E.MS_DAY) + 4;
    var track = AS.track(from, spanDays);

    var chapter = cfg.natal ? KT.chapter(cfg.natal, new Date(from)) : null;

    var coarse = [], step = cfg.coarseStepMin * 60000;
    var total = Math.max(1, Math.floor((to - from) / step));
    var i = 0, hourCache = null;

    for (var t = from; t <= to; t += step) {
      i++;
      if (cfg.onProgress && i % 40 === 0) cfg.onProgress(0.7 * i / total);
      var d = new Date(t);
      if (!allowed(d, cfg)) continue;

      var sky = E.sky(d, cfg.place, { houseSystem: cfg.houseSystem, speeds: true });
      hourCache = KH.planetaryHour(d, cfg.place);
      var s = KS.score(sky, intent, {
        natal: cfg.natal, track: track, chapter: chapter,
        hour: hourCache, includeOuters: cfg.includeOuters
      });
      coarse.push({ t: t, score: s.score, detail: s });
    }

    if (!coarse.length) {
      return { windows: [], intent: intent, chapter: chapter, scanned: 0,
        message: 'No moment in that range fits your availability.' };
    }

    // Refine around the peaks, at one-minute resolution.
    var peaks = coarse.slice().sort(function (a, b) { return b.score - a.score; }).slice(0, cfg.refineTop);
    var fine = [];
    var fstep = cfg.fineStepMin * 60000;
    for (var p = 0; p < peaks.length; p++) {
      if (cfg.onProgress) cfg.onProgress(0.7 + 0.3 * p / peaks.length);
      var lo = peaks[p].t - step, hi = peaks[p].t + step;
      for (var ft = lo; ft <= hi; ft += fstep) {
        if (ft < from || ft > to) continue;
        var fd = new Date(ft);
        if (!allowed(fd, cfg)) continue;
        var fsky = E.sky(fd, cfg.place, { houseSystem: cfg.houseSystem, speeds: true });
        var fs = KS.score(fsky, intent, {
          natal: cfg.natal, track: track, chapter: chapter,
          hour: KH.planetaryHour(fd, cfg.place), includeOuters: cfg.includeOuters
        });
        fine.push({ t: ft, score: fs.score, detail: fs });
      }
    }

    var windows = buildWindows(fine.length ? fine : coarse, cfg);
    var worst = coarse.slice().sort(function (a, b) { return a.score - b.score; })[0];

    if (cfg.onProgress) cfg.onProgress(1);
    return {
      intent: intent,
      chapter: chapter,
      scanned: coarse.length,
      windows: windows.slice(0, cfg.windows),
      avoid: worst ? { at: new Date(worst.t), score: worst.score, detail: worst.detail } : null,
      median: median(coarse.map(function (c) { return c.score; }))
    };
  }

  /** Merge contiguous high-scoring minutes into windows. */
  function buildWindows(points, cfg) {
    points = points.slice().sort(function (a, b) { return a.t - b.t; });
    var best = points.reduce(function (m, p) { return Math.max(m, p.score); }, 0);
    var threshold = Math.max(best - 6, 50);
    var out = [], cur = null;
    var gapTolerance = cfg.fineStepMin * 60000 * 2.5;

    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      if (p.score >= threshold) {
        if (cur && p.t - cur.end <= gapTolerance) {
          cur.end = p.t;
          if (p.score > cur.peak.score) cur.peak = p;
        } else {
          if (cur) out.push(cur);
          cur = { start: p.t, end: p.t, peak: p };
        }
      }
    }
    if (cur) out.push(cur);

    return out.map(function (win) {
      var minutes = (win.end - win.start) / 60000;
      // A single sampled minute still represents the step it stands for.
      if (minutes < cfg.minWindowMin) {
        var pad = (cfg.minWindowMin - minutes) / 2 * 60000;
        win.start -= pad; win.end += pad;
      }
      if ((win.end - win.start) / 60000 > cfg.maxWindowMin) {
        var mid = win.peak.t;
        win.start = mid - cfg.maxWindowMin * 30000;
        win.end = mid + cfg.maxWindowMin * 30000;
      }
      return {
        from: new Date(win.start), to: new Date(win.end),
        at: new Date(win.peak.t),
        score: win.peak.score,
        detail: win.peak.detail
      };
    }).sort(function (a, b) { return b.score - a.score; });
  }

  /** Availability filter: weekday and hour-of-day, in the user's local time. */
  function allowed(date, cfg) {
    if (cfg.days && cfg.days.length && cfg.days.indexOf(date.getDay()) === -1) return false;
    if (cfg.hours) {
      var h = date.getHours() + date.getMinutes() / 60;
      if (h < cfg.hours[0] || h >= cfg.hours[1]) return false;
    }
    return true;
  }

  /** Grade an event that is already in the calendar. */
  function grade(when, opts) {
    var cfg = merge(DEFAULTS, opts);
    var intent = KI.get(cfg.intentId);
    if (!intent) throw new Error('unknown intent: ' + cfg.intentId);
    var sky = E.sky(when, cfg.place, { houseSystem: cfg.houseSystem, speeds: true });
    var chapter = cfg.natal ? KT.chapter(cfg.natal, when) : null;
    return KS.score(sky, intent, {
      natal: cfg.natal, chapter: chapter,
      hour: KH.planetaryHour(when, cfg.place),
      includeOuters: cfg.includeOuters
    });
  }

  function merge(a, b) {
    var out = {}, k;
    for (k in a) if (Object.prototype.hasOwnProperty.call(a, k)) out[k] = a[k];
    for (k in b) if (Object.prototype.hasOwnProperty.call(b, k) && b[k] !== undefined) out[k] = b[k];
    return out;
  }

  function median(xs) {
    if (!xs.length) return 0;
    var s = xs.slice().sort(function (a, b) { return a - b; });
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  root.KSearch = { search: search, grade: grade, buildWindows: buildWindows, allowed: allowed, DEFAULTS: DEFAULTS };
})(typeof self !== 'undefined' ? self : this);
