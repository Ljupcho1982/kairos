/* Kairos — essential and accidental dignity, the traditional way.
 *
 * Every table here is sourced, because the whole promise of the app is that a
 * score can be taken apart and argued with. Sources are cited on each block and
 * surfaced in the UI next to the points they produce.
 */
(function (root) {
  'use strict';
  var E = root.KEphem;
  var S = E.SIGNS;

  // Domicile — the classical seven only. Kairos deliberately does not give
  // Uranus/Neptune/Pluto rulerships: the techniques it uses predate them, and
  // mixing schemes is how consumer apps end up incoherent.
  var DOMICILE = {
    Aries: 'Mars', Taurus: 'Venus', Gemini: 'Mercury', Cancer: 'Moon',
    Leo: 'Sun', Virgo: 'Mercury', Libra: 'Venus', Scorpio: 'Mars',
    Sagittarius: 'Jupiter', Capricorn: 'Saturn', Aquarius: 'Saturn', Pisces: 'Jupiter'
  };

  // Exaltation degrees (Ptolemy, Tetrabiblos I.19).
  var EXALT = {
    Sun: { sign: 'Aries', deg: 19 }, Moon: { sign: 'Taurus', deg: 3 },
    Mercury: { sign: 'Virgo', deg: 15 }, Venus: { sign: 'Pisces', deg: 27 },
    Mars: { sign: 'Capricorn', deg: 28 }, Jupiter: { sign: 'Cancer', deg: 15 },
    Saturn: { sign: 'Libra', deg: 21 }
  };

  var ELEMENT = { Aries: 'fire', Leo: 'fire', Sagittarius: 'fire',
    Taurus: 'earth', Virgo: 'earth', Capricorn: 'earth',
    Gemini: 'air', Libra: 'air', Aquarius: 'air',
    Cancer: 'water', Scorpio: 'water', Pisces: 'water' };

  // Triplicity rulers, Dorothean scheme (Dorotheus of Sidon, Carmen I).
  var TRIPLICITY = {
    fire: { day: 'Sun', night: 'Jupiter', partner: 'Saturn' },
    earth: { day: 'Venus', night: 'Moon', partner: 'Mars' },
    air: { day: 'Saturn', night: 'Mercury', partner: 'Jupiter' },
    water: { day: 'Venus', night: 'Mars', partner: 'Moon' }
  };

  // Egyptian bounds (terms). Each entry: [ruler, upper degree limit].
  var BOUNDS = {
    Aries: [['Jupiter', 6], ['Venus', 12], ['Mercury', 20], ['Mars', 25], ['Saturn', 30]],
    Taurus: [['Venus', 8], ['Mercury', 14], ['Jupiter', 22], ['Saturn', 27], ['Mars', 30]],
    Gemini: [['Mercury', 6], ['Jupiter', 12], ['Venus', 17], ['Mars', 24], ['Saturn', 30]],
    Cancer: [['Mars', 7], ['Venus', 13], ['Mercury', 19], ['Jupiter', 26], ['Saturn', 30]],
    Leo: [['Jupiter', 6], ['Venus', 11], ['Saturn', 18], ['Mercury', 24], ['Mars', 30]],
    Virgo: [['Mercury', 7], ['Venus', 17], ['Jupiter', 21], ['Mars', 28], ['Saturn', 30]],
    Libra: [['Saturn', 6], ['Mercury', 14], ['Jupiter', 21], ['Venus', 28], ['Mars', 30]],
    Scorpio: [['Mars', 7], ['Venus', 11], ['Mercury', 19], ['Jupiter', 24], ['Saturn', 30]],
    Sagittarius: [['Jupiter', 12], ['Venus', 17], ['Mercury', 21], ['Saturn', 26], ['Mars', 30]],
    Capricorn: [['Mercury', 7], ['Jupiter', 14], ['Venus', 22], ['Saturn', 26], ['Mars', 30]],
    Aquarius: [['Mercury', 7], ['Venus', 13], ['Jupiter', 20], ['Mars', 25], ['Saturn', 30]],
    Pisces: [['Venus', 12], ['Jupiter', 16], ['Mercury', 19], ['Mars', 28], ['Saturn', 30]]
  };

  // Faces (decans) run in Chaldean order from Mars/0 Aries.
  var FACE_ORDER = ['Mars', 'Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter'];

  var BENEFIC = { Venus: 1, Jupiter: 1 };
  var MALEFIC = { Mars: 1, Saturn: 1 };
  var SECT_OF = { Sun: 'day', Jupiter: 'day', Saturn: 'day', Moon: 'night', Venus: 'night', Mars: 'night' };

  function opposite(sign) { return S[(S.indexOf(sign) + 6) % 12]; }

  function domicileRuler(sign) { return DOMICILE[sign]; }

  function triplicityRuler(sign, isDay) {
    var t = TRIPLICITY[ELEMENT[sign]];
    return isDay ? t.day : t.night;
  }

  function boundRuler(sign, deg) {
    var b = BOUNDS[sign];
    for (var i = 0; i < b.length; i++) if (deg < b[i][1]) return b[i][0];
    return b[b.length - 1][0];
  }

  function faceRuler(lon) {
    return FACE_ORDER[Math.floor(E.norm360(lon) / 10) % 7];
  }

  /**
   * Essential dignity of a planet at a longitude, scored on the classical
   * five-fold ladder (domicile 5, exaltation 4, triplicity 3, bound 2, face 1)
   * with the standard debilities. Returns points plus the reasons that made them.
   */
  function essential(planet, lon, isDay) {
    var sign = E.signName(lon), deg = E.degInSign(lon);
    var out = { score: 0, reasons: [] };
    function add(pts, label, source) {
      out.score += pts;
      out.reasons.push({ points: pts, label: label, source: source });
    }
    if (DOMICILE[sign] === planet) add(5, planet + ' rules ' + sign, 'domicile');
    var ex = EXALT[planet];
    if (ex && ex.sign === sign) add(4, planet + ' is exalted in ' + sign, 'exaltation');
    if (triplicityRuler(sign, isDay) === planet) add(3, planet + ' rules the ' + ELEMENT[sign] + ' triplicity by ' + (isDay ? 'day' : 'night'), 'triplicity (Dorotheus)');
    if (boundRuler(sign, deg) === planet) add(2, planet + ' is in its own bound', 'Egyptian bounds');
    if (faceRuler(lon) === planet) add(1, planet + ' is in its own face', 'face/decan');

    if (DOMICILE[opposite(sign)] === planet) add(-5, planet + ' is in detriment in ' + sign, 'detriment');
    if (ex && opposite(ex.sign) === sign) add(-4, planet + ' is in fall in ' + sign, 'fall');
    if (out.score === 0) out.reasons.push({ points: 0, label: planet + ' is peregrine in ' + sign, source: 'peregrine' });
    return out;
  }

  /** Distance from the Sun decides combustion; cazimi is the exception. */
  function solarCondition(planetLon, sunLon, planet) {
    if (planet === 'Sun' || planet === 'Moon') return null;
    var d = Math.abs(E.norm180(planetLon - sunLon));
    if (d <= 0.2833) return { state: 'cazimi', points: 5, label: 'in the heart of the Sun (cazimi)' };
    if (d <= 8) return { state: 'combust', points: -5, label: 'combust the Sun' };
    if (d <= 15) return { state: 'underbeams', points: -2, label: 'under the Sun\'s beams' };
    return null;
  }

  function isAngular(house) { return house === 1 || house === 4 || house === 7 || house === 10; }
  function isSuccedent(house) { return house === 2 || house === 5 || house === 8 || house === 11; }
  function isCadent(house) { return house === 3 || house === 6 || house === 9 || house === 12; }

  /** Sect: a planet in its own sect, above/below the horizon correctly, is stronger. */
  function inSect(planet, isDay, sunLon, planetLon) {
    if (planet === 'Mercury') {
      // Mercury takes the sect of the half of the sky it rises in: oriental
      // (rising before the Sun) makes it diurnal.
      return (E.norm360(planetLon - sunLon) > 180) === isDay;
    }
    var s = SECT_OF[planet];
    if (!s) return null;
    return (s === 'day') === isDay;
  }

  /** Accidental dignity: where the planet is and what it is doing, not what it rules. */
  function accidental(body, sky) {
    var out = { score: 0, reasons: [] };
    function add(pts, label, source) {
      out.score += pts;
      out.reasons.push({ points: pts, label: label, source: source });
    }
    var h = body.house;
    if (isAngular(h)) add(4, body.name + ' is angular (house ' + h + ')', 'angularity');
    else if (isSuccedent(h)) add(1, body.name + ' is succedent (house ' + h + ')', 'angularity');
    else add(-3, body.name + ' is cadent (house ' + h + ')', 'angularity');

    if (body.retro) add(-4, body.name + ' is retrograde', 'motion');
    if (body.speed !== null && body.name !== 'Sun' && body.name !== 'Moon') {
      var mean = MEAN_SPEED[body.name];
      if (mean && Math.abs(body.speed) > mean * 1.15 && !body.retro) add(1, body.name + ' is swift in motion', 'motion');
      if (mean && Math.abs(body.speed) < mean * 0.55 && !body.retro) add(-1, body.name + ' is slow in motion', 'motion');
    }
    var sol = solarCondition(body.lon, sky.bodies.Sun.lon, body.name);
    if (sol) add(sol.points, body.name + ' is ' + sol.label, 'solar phase');

    var sect = inSect(body.name, sky.isDay, sky.bodies.Sun.lon, body.lon);
    if (sect === true) add(2, body.name + ' is in sect in a ' + (sky.isDay ? 'day' : 'night') + ' chart', 'sect');
    if (sect === false) add(-2, body.name + ' is out of sect in a ' + (sky.isDay ? 'day' : 'night') + ' chart', 'sect');
    return out;
  }

  var MEAN_SPEED = { Mercury: 1.383, Venus: 1.2, Mars: 0.524, Jupiter: 0.083, Saturn: 0.034 };

  /** Everything about one planet's condition, rolled up. */
  function condition(body, sky) {
    var ess = essential(body.name, body.lon, sky.isDay);
    var acc = accidental(body, sky);
    return {
      planet: body.name,
      essential: ess, accidental: acc,
      score: ess.score + acc.score,
      reasons: ess.reasons.concat(acc.reasons)
    };
  }

  root.KDignity = {
    DOMICILE: DOMICILE, EXALT: EXALT, ELEMENT: ELEMENT, TRIPLICITY: TRIPLICITY,
    BOUNDS: BOUNDS, BENEFIC: BENEFIC, MALEFIC: MALEFIC, SECT_OF: SECT_OF,
    opposite: opposite, domicileRuler: domicileRuler, triplicityRuler: triplicityRuler,
    boundRuler: boundRuler, faceRuler: faceRuler, essential: essential,
    accidental: accidental, condition: condition, solarCondition: solarCondition,
    inSect: inSect, isAngular: isAngular, isCadent: isCadent,
    isBenefic: function (p) { return !!BENEFIC[p]; },
    isMalefic: function (p) { return !!MALEFIC[p]; }
  };
})(typeof self !== 'undefined' ? self : this);
