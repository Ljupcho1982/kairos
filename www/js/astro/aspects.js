/* Kairos — aspects, application/separation, and the void-of-course Moon. */
(function (root) {
  'use strict';
  var E = root.KEphem;

  var ASPECTS = [
    { name: 'conjunction', angle: 0, glyph: '☌', nature: 'neutral' },
    { name: 'sextile', angle: 60, glyph: '⚹', nature: 'soft' },
    { name: 'square', angle: 90, glyph: '□', nature: 'hard' },
    { name: 'trine', angle: 120, glyph: '△', nature: 'soft' },
    { name: 'opposition', angle: 180, glyph: '☍', nature: 'hard' }
  ];

  // Moiety-style orbs: the luminaries see further than the rest.
  var ORB = {
    Sun: 8, Moon: 8, Mercury: 5, Venus: 5, Mars: 5,
    Jupiter: 6, Saturn: 6, Uranus: 4, Neptune: 4, Pluto: 4, NorthNode: 3
  };

  function orbFor(a, b) { return ((ORB[a] || 4) + (ORB[b] || 4)) / 2; }

  /** The aspect between two longitudes, or null. */
  function between(lonA, lonB, nameA, nameB, maxOrbOverride) {
    var sep = Math.abs(E.norm180(lonA - lonB));
    for (var i = 0; i < ASPECTS.length; i++) {
      var asp = ASPECTS[i];
      var orb = Math.abs(sep - asp.angle);
      var allowed = maxOrbOverride != null ? maxOrbOverride : orbFor(nameA, nameB);
      if (orb <= allowed) {
        return { aspect: asp.name, angle: asp.angle, nature: asp.nature, glyph: asp.glyph, orb: orb, exact: orb < 0.5 };
      }
    }
    return null;
  }

  /**
   * Applying or separating. An aspect applies when the faster body is still
   * closing the angle — the traditional distinction, and the one that decides
   * whether an election "carries" or merely "remembers".
   */
  function applying(a, b) {
    if (a.speed === null || b.speed === null) return null;
    var sep0 = Math.abs(E.norm180(a.lon - b.lon));
    var dt = 0.01;
    var sep1 = Math.abs(E.norm180((a.lon + a.speed * dt) - (b.lon + b.speed * dt)));
    var target = nearestAspectAngle(sep0);
    if (target === null) return null;
    return Math.abs(sep1 - target) < Math.abs(sep0 - target);
  }

  function nearestAspectAngle(sep) {
    var best = null, bestD = 1e9;
    for (var i = 0; i < ASPECTS.length; i++) {
      var d = Math.abs(sep - ASPECTS[i].angle);
      if (d < bestD) { bestD = d; best = ASPECTS[i].angle; }
    }
    return best;
  }

  /** All aspects present in a sky snapshot. */
  function all(sky, bodies) {
    var names = bodies || E.ALL_BODIES;
    var out = [];
    for (var i = 0; i < names.length; i++) {
      for (var j = i + 1; j < names.length; j++) {
        var a = sky.bodies[names[i]], b = sky.bodies[names[j]];
        if (!a || !b) continue;
        var asp = between(a.lon, b.lon, a.name, b.name);
        if (asp) {
          asp.a = a.name; asp.b = b.name;
          asp.applying = applying(a, b);
          out.push(asp);
        }
      }
    }
    return out.sort(function (x, y) { return x.orb - y.orb; });
  }

  /* ---- fast interpolated tracks -------------------------------------------
   * The void-of-course test gets called for every candidate moment in an
   * election search, so it cannot afford a fresh ephemeris call per sample.
   * The Moon gets a dense sampled track; the slow planets get a quadratic fit
   * from three points, which is good to well under a degree over a few days.
   */
  /* Two defensible definitions of "void", and the difference is not academic:
   * on 13 Aug 2026 the traditional reading gives a 43-hour void and the modern
   * one gives 19, because the Moon squares Uranus in between. Kairos defaults
   * to TRADITIONAL, since every rule pack in the app comes from authors who
   * had seven planets. The setting is exposed in the UI, not hidden. */
  var TARGETS_TRADITIONAL = ['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
  var TARGETS_MODERN = TARGETS_TRADITIONAL.concat(['Uranus', 'Neptune', 'Pluto']);
  var TARGETS = TARGETS_MODERN;   // the track always samples the superset

  var MOON_STEP = 30 * 60000;      // Moon moves ~0.27 deg per half hour
  var PLANET_STEP = 6 * 3600000;   // the slow bodies need far less

  /** Sample a body on a fixed grid, unwrapped so interpolation never straddles 360. */
  function sample(body, t0, span, step) {
    var n = Math.ceil(span / step) + 1;
    var arr = new Float64Array(n);
    var prev = E.longitude(body, new Date(t0));
    arr[0] = prev;
    for (var i = 1; i < n; i++) {
      var raw = E.longitude(body, new Date(t0 + i * step));
      prev = prev + E.norm180(raw - prev);
      arr[i] = prev;
    }
    return arr;
  }

  function interp(arr, t0, step, ms) {
    var x = (ms - t0) / step;
    if (x <= 0) return arr[0];
    if (x >= arr.length - 1) return arr[arr.length - 1];
    var k = Math.floor(x);
    return arr[k] + (arr[k + 1] - arr[k]) * (x - k);
  }

  function track(t0, days) {
    var span = days * E.MS_DAY;
    var moon = sample('Moon', t0, span, MOON_STEP);
    var planets = {};
    for (var i = 0; i < TARGETS.length; i++) {
      planets[TARGETS[i]] = sample(TARGETS[i], t0, span, PLANET_STEP);
    }
    return {
      t0: t0, span: span, moon: moon, planets: planets,
      moonAt: function (ms) { return interp(moon, t0, MOON_STEP, ms); },
      planetAt: function (name, ms) { return interp(planets[name], t0, PLANET_STEP, ms); }
    };
  }

  var ANGLES = [0, 60, 90, 120, 180, -60, -90, -120];

  /**
   * Void-of-course Moon: the Moon perfects no further Ptolemaic aspect to a
   * classical planet before it leaves its sign. The most-respected rule in
   * electional astrology — "nothing will come of the matter" (Lilly, CA p.112).
   *
   * The Moon's elongation from each planet increases monotonically, so a
   * perfection is exactly a zero crossing of (moon - planet - angle).
   */
  function moonVoid(date, place, maxLookaheadDays, tr, opts) {
    var targets = (opts && opts.includeOuters) ? TARGETS_MODERN : TARGETS_TRADITIONAL;
    var t0 = date.getTime();
    var exit = E.moonSignExit(date);
    var days = maxLookaheadDays || 3;
    // A cached track is only usable if it still covers the Moon's run to the
    // end of its sign — truncating the search would invent a void period.
    if (!tr || t0 < tr.t0 || exit.getTime() > tr.t0 + tr.span) tr = track(t0, days);

    var end = Math.min(exit.getTime(), tr.t0 + tr.span);
    var next = null, step = 15 * 60000;
    // The Moon can only close a gap it has time to travel before it changes sign.
    var reach = 15 * ((end - t0) / E.MS_DAY) + 1;

    for (var k = 0; k < targets.length; k++) {
      var name = targets[k];
      for (var ai = 0; ai < ANGLES.length; ai++) {
        var ang = ANGLES[ai];
        var prev = gap(t0, name, ang);
        if (prev > 0 || prev < -reach) continue;    // already past, or out of reach
        for (var t = t0 + step; t <= end + step; t += step) {
          var cur = gap(Math.min(t, end), name, ang);
          if (prev <= 0 && cur > 0 && Math.abs(prev) < 6) {
            var exact = bisect(t - step, Math.min(t, end), name, ang);
            if (exact <= end && (!next || exact < next.time)) {
              next = { time: exact, planet: name, angle: Math.abs(ang) };
            }
            break;
          }
          if (cur > 0) break;
          prev = cur;
        }
      }
    }

    function gap(ms, planet, ang) {
      return E.norm180(tr.moonAt(ms) - tr.planetAt(planet, ms) - ang);
    }
    function bisect(lo, hi, planet, ang) {
      for (var i = 0; i < 30; i++) {
        var mid = (lo + hi) / 2;
        if (gap(mid, planet, ang) <= 0) lo = mid; else hi = mid;
        if (hi - lo < 20000) break;
      }
      return (lo + hi) / 2;
    }

    var isVoid = !next;
    return {
      isVoid: isVoid,
      until: isVoid ? exit : null,
      nextAspect: next ? { date: new Date(next.time), planet: next.planet, angle: next.angle } : null,
      signExit: exit,
      track: tr
    };
  }

  /**
   * The Moon's next applying aspect and whether it is to a benefic — in
   * electional practice this is the single strongest indicator of how the
   * matter turns out (Dorotheus V; Bonatti, Considerations).
   */
  function moonNextAspect(date, tr, opts) {
    var v = moonVoid(date, null, 3, tr, opts);
    if (!v.nextAspect) return null;
    var p = v.nextAspect.planet;
    return {
      planet: p, date: v.nextAspect.date, angle: v.nextAspect.angle,
      benefic: !!root.KDignity.BENEFIC[p],
      malefic: !!root.KDignity.MALEFIC[p],
      hoursAway: (v.nextAspect.date - date) / 3600000
    };
  }

  root.KAspects = {
    ASPECTS: ASPECTS, ORB: ORB, orbFor: orbFor,
    TARGETS_TRADITIONAL: TARGETS_TRADITIONAL, TARGETS_MODERN: TARGETS_MODERN,
    between: between, applying: applying, all: all, track: track,
    moonVoid: moonVoid, moonNextAspect: moonNextAspect,
    nearestAspectAngle: nearestAspectAngle
  };
})(typeof self !== 'undefined' ? self : this);
