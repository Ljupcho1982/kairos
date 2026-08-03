/* Kairos — the scorer.
 *
 * Produces a 0-100 score for a moment, together with every rule that fired and
 * the source it comes from. Nothing here is a black box: the UI renders this
 * list verbatim, positives and negatives alike, and a score whose negatives are
 * hidden is a score nobody should trust.
 */
(function (root) {
  'use strict';
  var E = root.KEphem, D = root.KDignity, AS = root.KAspects, KI = root.KIntents;

  function w(intent, key) { return (intent.w && intent.w[key] != null) ? intent.w[key] : 1; }

  /**
   * @param sky     sky snapshot for the candidate moment
   * @param intent  entry from KIntents
   * @param ctx     { natal, track, chapter, hour, includeOuters }
   */
  function score(sky, intent, ctx) {
    ctx = ctx || {};
    var pts = [], raw = 0;

    function rule(points, label, source, kind) {
      if (!points) return;
      points = Math.round(points * 10) / 10;
      raw += points;
      pts.push({ points: points, label: label, source: source, kind: kind || (points > 0 ? 'good' : 'bad') });
    }

    /* ---- 1. the Moon: the universal significator of the undertaking ---- */
    var moon = sky.bodies.Moon;
    var moonCond = D.condition(moon, sky);
    rule(moonCond.essential.score * 0.8 * w(intent, 'moon'),
      'Moon in ' + moon.sign + (moonCond.essential.score > 0 ? ' (dignified)' : moonCond.essential.score < 0 ? ' (debilitated)' : ' (peregrine)'),
      'Moon\'s essential dignity');

    if (moon.speed !== null) {
      if (moon.speed > 13.5) rule(1.5 * w(intent, 'moon'), 'the Moon is swift', 'Bonatti, Considerations');
      else if (moon.speed < 12.0) rule(-1.5 * w(intent, 'moon'), 'the Moon is slow', 'Bonatti, Considerations');
    }

    // Increasing light: asked for whenever the matter should grow.
    var waxing = sky.moonPhase < 180;
    var waxWeight = w(intent, 'waxing');
    if (waxing) rule(2.5 * waxWeight, 'the Moon is increasing in light', 'Dorotheus V (beginnings that should grow)');
    else rule(-2.0 * waxWeight, 'the Moon is decreasing in light', 'Dorotheus V');
    if (sky.moonPhase < 12 || sky.moonPhase > 348) {
      rule(-4 * w(intent, 'moon'), 'the Moon is combust the Sun (near new)', 'Lilly, CA p.299');
    }

    /* ---- 2. void of course: the great veto ----------------------------- */
    var voc = AS.moonVoid(sky.date, sky.place, 3, ctx.track, { includeOuters: !!ctx.includeOuters });
    if (voc.isVoid) {
      rule(-14 * w(intent, 'voidVeto'), 'the Moon is void of course until ' + clockOrDay(voc.until, sky.date) +
        ' — "nothing will come of the matter"', 'Lilly, Christian Astrology p.112');
    } else if (voc.nextAspect) {
      var na = voc.nextAspect;
      var hrs = (na.date - sky.date) / 3600000;
      var soon = hrs < 12;
      // The aspect's own nature modulates the planet's: a trine to Jupiter is
      // not a square to Jupiter, and the tradition never treated them alike.
      var quality = { 120: 1.0, 60: 0.8, 0: 0.7, 90: -0.35, 180: -0.5 }[na.angle];
      if (quality === undefined) quality = 0;
      var strength = (soon ? 6 : 3) * w(intent, 'moonApplying');
      var label = 'the Moon next applies to ' + na.planet + ' by ' + aspectName(na.angle) +
        (soon ? ', within ' + hrs.toFixed(1) + 'h' : '');

      if (D.isBenefic(na.planet)) {
        rule(strength * quality, label, 'Dorotheus V; the Moon\'s next aspect shows the outcome');
      } else if (D.isMalefic(na.planet)) {
        // A malefic by trine or sextile is received, not merely survived.
        var malSoften = { 120: 0.35, 60: 0.5, 0: 1.0, 90: 1.0, 180: 1.1 }[na.angle] || 1;
        rule(-strength * malSoften, label, 'Dorotheus V');
      } else {
        rule(1.5 * quality * w(intent, 'moonApplying'), label, 'Dorotheus V');
      }
    }

    /* ---- 3. the Ascendant and its ruler: the querent and the venture --- */
    var ascRulerName = D.domicileRuler(E.signName(sky.asc));
    var ascRuler = sky.bodies[ascRulerName];
    if (ascRuler) {
      var arc = D.condition(ascRuler, sky);
      rule(arc.score * 0.55 * w(intent, 'ascRuler'),
        'the Ascendant ruler (' + ascRulerName + ') is ' + describe(arc),
        'condition of the Ascendant ruler');
      if (ascRuler.retro) {
        rule(-3 * w(intent, 'ascRuler'), ascRulerName + ' rules the Ascendant and is retrograde', 'Lilly, CA p.301');
      }
      if (D.isCadent(ascRuler.house)) {
        rule(-2 * w(intent, 'ascRuler'), 'the Ascendant ruler is cadent (house ' + ascRuler.house + ')', 'angularity');
      }
    }

    /* ---- 4. the significator of the matter ----------------------------- */
    var houseSignName = E.SIGNS[(E.signIndex(sky.asc) + intent.house - 1) % 12];
    var houseRulerName = D.domicileRuler(houseSignName);
    var sigName = intent.ruler === 'ascRuler' ? ascRulerName : houseRulerName;
    var sig = sky.bodies[sigName];
    if (sig) {
      var sc = D.condition(sig, sky);
      rule(sc.score * 0.6 * w(intent, 'sigCondition'),
        'the ruler of the ' + ordinal(intent.house) + ' house (' + sigName + ') is ' + describe(sc),
        'significator of the matter');
    }
    // The natural significator named by the intent (Venus for love, Mercury for
    // writing, and so on) is scored separately from the house ruler.
    var nat = sky.bodies[intent.sig];
    if (nat && intent.sig !== sigName) {
      var nc = D.condition(nat, sky);
      rule(nc.score * 0.35 * w(intent, 'sigCondition'),
        'the natural significator ' + intent.sig + ' is ' + describe(nc),
        'natural significator');
    }

    /* ---- 5. the angles: what stands at the door ------------------------ */
    E.CLASSICAL.forEach(function (name) {
      var b = sky.bodies[name];
      if (!b || !D.isAngular(b.house)) return;
      if (D.isBenefic(name)) {
        rule(name === 'Jupiter' ? 4 : 3, name + ' is angular (house ' + b.house + ')',
          'Bonatti: a benefic on an angle strengthens the whole election');
      } else if (name === 'Mars') {
        rule(-4.5 * w(intent, 'marsAngular'), 'Mars is angular (house ' + b.house + ')',
          'Lilly: a malefic on an angle infects the beginning');
      } else if (name === 'Saturn') {
        rule(-4 * w(intent, 'saturnAngular'), 'Saturn is angular (house ' + b.house + ')', 'Lilly, CA p.298');
      }
    });

    // A malefic in the house of the matter is worse than a malefic anywhere else.
    ['Mars', 'Saturn'].forEach(function (name) {
      var b = sky.bodies[name];
      if (b && b.house === intent.house) {
        rule(-3, name + ' sits in the ' + ordinal(intent.house) + ' house, the house of this matter', 'topical affliction');
      }
    });
    ['Venus', 'Jupiter'].forEach(function (name) {
      var b = sky.bodies[name];
      if (b && b.house === intent.house) {
        rule(3, name + ' sits in the ' + ordinal(intent.house) + ' house, the house of this matter', 'topical benefit');
      }
    });

    /* ---- 6. Mercury retrograde, applied only where it belongs ---------- */
    var merc = sky.bodies.Mercury;
    var mw = w(intent, 'mercuryRetro');
    if (merc && merc.retro && mw >= 1) {
      rule(-5 * mw, 'Mercury is retrograde, and this is a matter Mercury governs',
        'traditional caution for contracts, purchases, messages and travel');
    } else if (merc && merc.retro) {
      pts.push({ points: 0, kind: 'note',
        label: 'Mercury is retrograde — traditionally not an objection to this kind of undertaking',
        source: 'Kairos applies Mercury retrograde per matter, not universally' });
    }

    /* ---- 7. the planetary hour ----------------------------------------- */
    if (ctx.hour) {
      var hr = ctx.hour.ruler;
      if (hr === intent.sig) rule(3, 'the planetary hour belongs to ' + hr + ', the significator of this matter', 'planetary hours');
      else if (D.isBenefic(hr)) rule(1.5, 'the hour of ' + hr, 'planetary hours');
      else if (D.isMalefic(hr)) rule(-1.5, 'the hour of ' + hr, 'planetary hours');
      else {
        // The luminaries' hours are neutral here, but the hour should still be
        // visible: a rule that silently does nothing looks like a missing rule.
        pts.push({ points: 0, kind: 'note', label: 'the hour of ' + hr + ' — neutral for this matter',
          source: 'planetary hours' });
      }
    }

    /* ---- 8. the natal overlay: your chart, not just the sky ------------ */
    if (ctx.natal) {
      var n = ctx.natal;
      // Transiting malefic on a natal angle at the moment you begin.
      [['Mars', -4], ['Saturn', -3.5]].forEach(function (p) {
        var b = sky.bodies[p[0]];
        if (!b) return;
        var toAsc = AS.between(b.lon, n.asc, p[0], 'Sun', 3);
        if (toAsc && (toAsc.aspect === 'conjunction' || toAsc.aspect === 'opposition' || toAsc.aspect === 'square')) {
          rule(p[1], 'transiting ' + p[0] + ' ' + toAsc.aspect + ' your natal Ascendant', 'natal overlay');
        }
      });
      [['Jupiter', 3.5], ['Venus', 2.5]].forEach(function (p) {
        var b = sky.bodies[p[0]];
        if (!b) return;
        var a = AS.between(b.lon, n.asc, p[0], 'Sun', 3);
        if (a && (a.aspect === 'conjunction' || a.aspect === 'trine' || a.aspect === 'sextile')) {
          rule(p[1], 'transiting ' + p[0] + ' ' + a.aspect + ' your natal Ascendant', 'natal overlay');
        }
      });
      // The Moon reaching your natal Moon or Ascendant sign.
      if (E.signIndex(moon.lon) === E.signIndex(n.asc)) {
        rule(2, 'the Moon is in your rising sign', 'natal overlay');
      }
    }

    /* ---- 9. the Chapter: is this topic even live right now? ------------ */
    if (ctx.chapter && ctx.chapter.profection) {
      var prof = ctx.chapter.profection;
      if (prof.house === intent.house) {
        rule(4, 'this is a ' + ordinal(prof.house) + '-house profection year — the very topic your year is about',
          'annual profections');
      } else if (prof.month && prof.month.house === intent.house) {
        rule(2, 'the profected month is on the ' + ordinal(intent.house) + ' house', 'monthly profections');
      }
      var lord = sky.bodies[prof.lord];
      if (lord) {
        var lc = D.condition(lord, sky);
        if (lc.score >= 5) rule(2, 'your Lord of the Year (' + prof.lord + ') is strong right now', 'annual profections');
        if (lc.score <= -5) rule(-2, 'your Lord of the Year (' + prof.lord + ') is weak right now', 'annual profections');
      }
    }

    /* ---- normalise ------------------------------------------------------ */
    // raw runs roughly -45..+45; map to 0..100 with 50 as "unremarkable".
    var out = Math.round(Math.max(0, Math.min(100, 50 + raw * 1.15)));
    pts.sort(function (a, b) { return Math.abs(b.points) - Math.abs(a.points); });

    return {
      score: out, raw: Math.round(raw * 10) / 10,
      reasons: pts,
      good: pts.filter(function (p) { return p.kind === 'good'; }),
      bad: pts.filter(function (p) { return p.kind === 'bad'; }),
      notes: pts.filter(function (p) { return p.kind === 'note'; }),
      voidOfCourse: voc.isVoid,
      moonSign: moon.sign,
      hour: ctx.hour ? ctx.hour.ruler : null
    };
  }

  function describe(cond) {
    if (cond.score >= 8) return 'very strong';
    if (cond.score >= 3) return 'strong';
    if (cond.score > -3) return 'mixed';
    if (cond.score > -8) return 'weak';
    return 'very weak';
  }
  function aspectName(angle) {
    return { 0: 'conjunction', 60: 'sextile', 90: 'square', 120: 'trine', 180: 'opposition' }[angle] || angle + '°';
  }
  function ordinal(n) {
    var s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
  function hhmm(d) {
    if (!d) return '';
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  /* A void that ends tomorrow must not render as a bare "11:01" — that reads
   * as an hour ago and quietly makes the worst warning in the app look wrong. */
  function clockOrDay(d, ref) {
    if (!d) return '';
    var t = hhmm(d);
    if (d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() &&
      d.getDate() === ref.getDate()) return t;
    var days = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) -
      new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())) / 86400000);
    if (days === 1) return t + ' tomorrow';
    var names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return t + ' on ' + names[d.getDay()] + (days > 6 ? ' ' + d.getDate() + '/' + (d.getMonth() + 1) : '');
  }

  root.KScore = { score: score, aspectName: aspectName, ordinal: ordinal, clockOrDay: clockOrDay };
})(typeof self !== 'undefined' ? self : this);
