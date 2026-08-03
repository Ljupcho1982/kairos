/* Kairos — ephemeris core.
 *
 * Wraps astronomy-engine (MIT) into the coordinates astrology actually uses:
 * geocentric apparent longitude in the TROPICAL zodiac (true ecliptic of date),
 * plus houses, the lunar node, the Lots and the Moon's condition.
 *
 * Plain global script on purpose: the same file is loaded by index.html via
 * <script> and by the election Web Worker via importScripts().
 */
(function (root) {
  'use strict';

  var A = root.Astronomy;
  if (!A) throw new Error('astronomy-engine must be loaded before ephem.js');

  var DEG = 180 / Math.PI, RAD = Math.PI / 180;
  var MS_DAY = 86400000;

  var SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
    'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];

  // The seven classical planets, in Chaldean order (used by the planetary hours).
  var CHALDEAN = ['Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon'];
  var CLASSICAL = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
  var MODERN = ['Uranus', 'Neptune', 'Pluto'];
  var ALL_BODIES = CLASSICAL.concat(MODERN);

  function norm360(x) { x = x % 360; return x < 0 ? x + 360 : x; }
  function norm180(x) { x = norm360(x); return x > 180 ? x - 360 : x; }
  function signIndex(lon) { return Math.floor(norm360(lon) / 30); }
  function signName(lon) { return SIGNS[signIndex(lon)]; }
  function degInSign(lon) { return norm360(lon) % 30; }

  /** Geocentric apparent ecliptic longitude of date, in degrees. */
  function longitude(body, date) {
    if (body === 'Moon') return norm360(A.EclipticGeoMoon(date).lon);
    var t = A.MakeTime(date);
    var gv = A.GeoVector(body, t, true);           // EQJ, aberration-corrected
    var ect = A.RotateVector(A.Rotation_EQJ_ECT(t), gv);
    return norm360(A.SphereFromVector(ect).lon);
  }

  function latitude(body, date) {
    if (body === 'Moon') return A.EclipticGeoMoon(date).lat;
    var t = A.MakeTime(date);
    var ect = A.RotateVector(A.Rotation_EQJ_ECT(t), A.GeoVector(body, t, true));
    return A.SphereFromVector(ect).lat;
  }

  /** Apparent daily motion in degrees/day (negative = retrograde). */
  function speed(body, date) {
    var h = body === 'Moon' ? 0.02 : 0.5;          // days either side
    var t0 = new Date(date.getTime() - h * MS_DAY);
    var t1 = new Date(date.getTime() + h * MS_DAY);
    return norm180(longitude(body, t1) - longitude(body, t0)) / (2 * h);
  }

  /**
   * True (osculating) North Node of the Moon.
   * h = r x v of the geocentric lunar orbit; the ascending-node direction is
   * z_hat x h, so its ecliptic longitude is atan2(h.x, -h.y).
   */
  function trueNode(date) {
    var h = 0.02;
    var t = A.MakeTime(date);
    var rot = A.Rotation_EQJ_ECT(t);
    var p0 = A.RotateVector(rot, A.GeoMoon(new Date(date.getTime() - h * MS_DAY)));
    var p1 = A.RotateVector(rot, A.GeoMoon(new Date(date.getTime() + h * MS_DAY)));
    var r = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2, z: (p0.z + p1.z) / 2 };
    var v = { x: (p1.x - p0.x), y: (p1.y - p0.y), z: (p1.z - p0.z) };
    var hx = r.y * v.z - r.z * v.y;
    var hy = r.z * v.x - r.x * v.z;
    return norm360(Math.atan2(hx, -hy) * DEG);
  }

  /** Mean obliquity of the ecliptic (Laskar), degrees. */
  function obliquity(date) {
    var T = (A.MakeTime(date).tt) / 36525;         // Julian centuries TT from J2000
    var u = T / 100;
    return 23.43929111 - u * (4680.93 + u * (1.55 - u * (1999.25 - u * (51.38 + u * 249.67)))) / 3600;
  }

  /** Right ascension of the midheaven, degrees. */
  function ramc(date, lonEast) {
    return norm360(A.SiderealTime(date) * 15 + lonEast);
  }

  /** Ecliptic longitude of the point whose right ascension is `ra`. */
  function eclipticFromRA(ra, eps) {
    return norm360(Math.atan2(Math.sin(ra * RAD), Math.cos(ra * RAD) * Math.cos(eps * RAD)) * DEG);
  }

  function midheaven(date, lat, lonEast) {
    return eclipticFromRA(ramc(date, lonEast), obliquity(date));
  }

  function ascendant(date, lat, lonEast) {
    var eps = obliquity(date) * RAD, R = ramc(date, lonEast) * RAD, phi = lat * RAD;
    var y = Math.cos(R);
    var x = -(Math.sin(R) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps));
    return norm360(Math.atan2(y, x) * DEG);
  }

  /**
   * House cusps. 'whole' is the default because every technique Kairos uses
   * (profections, zodiacal releasing, sect, the topical rule packs) is
   * Hellenistic, and Hellenistic astrology is whole-sign. Placidus is offered
   * for people who want to read a familiar-looking wheel.
   */
  function houses(date, lat, lonEast, system) {
    var asc = ascendant(date, lat, lonEast);
    var mc = midheaven(date, lat, lonEast);
    var cusps = new Array(12), i;

    if (system === 'placidus' && Math.abs(lat) < 66) {
      var eps = obliquity(date), R = ramc(date, lonEast);
      var ok = true;
      var c11 = placidus(R, lat, eps, 1 / 3, false);
      var c12 = placidus(R, lat, eps, 2 / 3, false);
      var c2 = placidus(R, lat, eps, 1 / 3, true);
      var c3 = placidus(R, lat, eps, 2 / 3, true);
      [c11, c12, c2, c3].forEach(function (c) { if (c === null) ok = false; });
      if (ok) {
        cusps[0] = asc; cusps[1] = c2; cusps[2] = c3;
        cusps[3] = norm360(mc + 180); cusps[4] = norm360(c11 + 180); cusps[5] = norm360(c12 + 180);
        cusps[6] = norm360(asc + 180); cusps[7] = norm360(c2 + 180); cusps[8] = norm360(c3 + 180);
        cusps[9] = mc; cusps[10] = c11; cusps[11] = c12;
        return { system: 'placidus', asc: asc, mc: mc, cusps: cusps };
      }
    }

    var start = signIndex(asc) * 30;
    for (i = 0; i < 12; i++) cusps[i] = norm360(start + i * 30);
    return { system: 'whole', asc: asc, mc: mc, cusps: cusps };
  }

  /**
   * One Placidus intermediate cusp by iteration on right ascension.
   * frac: 1/3 -> cusps 11 & 3, 2/3 -> cusps 12 & 2. below=true for 2 & 3.
   * The cusp is the ecliptic point that has traversed `frac` of its
   * semi-arc; declination depends on the answer, so we iterate.
   */
  function placidus(R, lat, eps, frac, below) {
    var phi = lat * RAD, se = Math.sin(eps * RAD), te = Math.tan(eps * RAD);
    var ra = R + (below ? 90 + frac * 90 : frac * 90);
    for (var i = 0; i < 40; i++) {
      var lon = eclipticFromRA(ra, eps);
      var dec = Math.asin(se * Math.sin(lon * RAD));
      var x = Math.tan(phi) * Math.tan(dec);
      if (Math.abs(x) >= 1) return null;           // circumpolar — no Placidus cusp
      var ad = Math.asin(x) * DEG;                 // ascensional difference
      var next = below
        ? R + (90 + ad) + frac * (90 - ad)
        : R + frac * (90 + ad);
      if (Math.abs(norm180(next - ra)) < 1e-9) { ra = next; break; }
      ra = next;
    }
    return eclipticFromRA(ra, eps);
  }

  /** Whole-sign house number (1-12) of a longitude, given the ascendant. */
  function wholeSignHouse(lon, asc) {
    return ((signIndex(lon) - signIndex(asc) + 12) % 12) + 1;
  }

  function houseOf(lon, h) {
    if (h.system === 'whole') return wholeSignHouse(lon, h.asc);
    for (var i = 0; i < 12; i++) {
      var a = h.cusps[i], b = h.cusps[(i + 1) % 12];
      var span = norm360(b - a), off = norm360(lon - a);
      if (off < span) return i + 1;
    }
    return 1;
  }

  /** Sun above the horizon -> day chart. Uses the true horizon, not the clock. */
  function isDayChart(sunLon, h) {
    var above = norm360(sunLon - h.asc);           // 0..360 from Asc, counter-clockwise
    return above >= 180;                           // Asc->MC->Desc half is the day side
  }

  /**
   * Full sky snapshot. `opts.speeds` can be false to skip the derivative pass
   * when the caller only needs positions (the coarse election sweep does this).
   */
  function sky(date, place, opts) {
    opts = opts || {};
    var system = opts.houseSystem || 'whole';
    var h = houses(date, place.lat, place.lon, system);
    var bodies = {}, i, name, lon;

    var list = opts.classicalOnly ? CLASSICAL : ALL_BODIES;
    for (i = 0; i < list.length; i++) {
      name = list[i];
      lon = longitude(name, date);
      var sp = opts.speeds === false ? null : speed(name, date);
      bodies[name] = {
        name: name, lon: lon, lat: latitude(name, date),
        sign: signName(lon), signIndex: signIndex(lon), deg: degInSign(lon),
        speed: sp, retro: sp === null ? null : sp < 0,
        house: houseOf(lon, h)
      };
    }
    var node = trueNode(date);
    bodies.NorthNode = {
      name: 'NorthNode', lon: node, lat: 0, sign: signName(node),
      signIndex: signIndex(node), deg: degInSign(node), speed: null, retro: true,
      house: houseOf(node, h)
    };

    var day = isDayChart(bodies.Sun.lon, h);
    return {
      date: new Date(date.getTime()),
      place: place,
      houses: h,
      asc: h.asc, mc: h.mc,
      bodies: bodies,
      sect: day ? 'day' : 'night',
      isDay: day,
      moonPhase: A.MoonPhase(date),                 // 0=new, 90=first qtr, 180=full
      lots: lots(bodies, h, day)
    };
  }

  /** Hellenistic Lots (Fortune and Spirit), sect-sensitive. */
  function lots(bodies, h, isDay) {
    var sun = bodies.Sun.lon, moon = bodies.Moon.lon, asc = h.asc;
    return {
      fortune: norm360(isDay ? asc + moon - sun : asc + sun - moon),
      spirit: norm360(isDay ? asc + sun - moon : asc + moon - sun)
    };
  }

  /**
   * A natal chart: a sky snapshot that remembers when it was born, which is
   * what every time-lord technique needs as its origin.
   */
  function natal(birth, place, houseSystem) {
    var s = sky(birth, place, { houseSystem: houseSystem || 'whole' });
    s.birth = new Date(birth.getTime());
    return s;
  }

  /** Moment the Moon leaves its current sign. */
  function moonSignExit(date) {
    var lon = longitude('Moon', date);
    var target = (signIndex(lon) + 1) * 30;
    var lo = date.getTime(), hi = lo + 3 * MS_DAY;
    for (var i = 0; i < 60; i++) {
      var mid = (lo + hi) / 2;
      var d = norm180(longitude('Moon', new Date(mid)) - target);
      if (d < 0) lo = mid; else hi = mid;
      if (hi - lo < 1000) break;
    }
    return new Date((lo + hi) / 2);
  }

  root.KEphem = {
    SIGNS: SIGNS, CLASSICAL: CLASSICAL, MODERN: MODERN, ALL_BODIES: ALL_BODIES,
    CHALDEAN: CHALDEAN, MS_DAY: MS_DAY,
    norm360: norm360, norm180: norm180,
    signIndex: signIndex, signName: signName, degInSign: degInSign,
    longitude: longitude, latitude: latitude, speed: speed, trueNode: trueNode,
    obliquity: obliquity, ramc: ramc, ascendant: ascendant, midheaven: midheaven,
    houses: houses, houseOf: houseOf, wholeSignHouse: wholeSignHouse,
    isDayChart: isDayChart, sky: sky, natal: natal, lots: lots, moonSignExit: moonSignExit
  };
})(typeof self !== 'undefined' ? self : this);
