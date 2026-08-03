/* Kairos — the Ledger's statistics.
 *
 * This is the module that lets the app be wrong. It compares outcomes of
 * elected events against the user's own non-elected baseline and reports an
 * effect size with a confidence interval — never a bare "accuracy %", never a
 * claim below the minimum sample size, and never a null result in small print.
 *
 * The honest default is "not enough data yet". Most users will see that for
 * months, and that is the correct thing for them to see.
 */
(function (root) {
  'use strict';

  var MIN_N_PER_ARM = 5;      // below this, say nothing
  var MIN_N_TOTAL = 12;       // below this, say nothing
  var BOOTSTRAP = 4000;

  function mean(xs) {
    if (!xs.length) return null;
    var s = 0;
    for (var i = 0; i < xs.length; i++) s += xs[i];
    return s / xs.length;
  }

  function sd(xs) {
    if (xs.length < 2) return null;
    var m = mean(xs), s = 0;
    for (var i = 0; i < xs.length; i++) s += (xs[i] - m) * (xs[i] - m);
    return Math.sqrt(s / (xs.length - 1));
  }

  /* A small deterministic PRNG so a given ledger always yields the same
   * interval. Statistics that jitter every time you open the screen feel
   * arbitrary, and users are right to distrust them. */
  function rng(seed) {
    var s = seed >>> 0 || 1;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  function resample(xs, rand) {
    var out = new Array(xs.length);
    for (var i = 0; i < xs.length; i++) out[i] = xs[(rand() * xs.length) | 0];
    return out;
  }

  function quantile(sorted, q) {
    if (!sorted.length) return null;
    var pos = (sorted.length - 1) * q, base = Math.floor(pos), rest = pos - base;
    if (sorted[base + 1] !== undefined) return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
    return sorted[base];
  }

  /**
   * Difference in mean outcome between elected and self-chosen events, with a
   * percentile bootstrap CI.
   * @returns {status, n, diff, ci, elected:{n,mean}, control:{n,mean}, verdict}
   */
  function compare(electedScores, controlScores, opts) {
    opts = opts || {};
    var minArm = opts.minPerArm || MIN_N_PER_ARM;
    var minTotal = opts.minTotal || MIN_N_TOTAL;
    var n = electedScores.length + controlScores.length;

    if (electedScores.length < minArm || controlScores.length < minArm || n < minTotal) {
      return {
        status: 'insufficient',
        n: n,
        need: Math.max(minTotal - n, minArm - Math.min(electedScores.length, controlScores.length)),
        elected: { n: electedScores.length, mean: mean(electedScores) },
        control: { n: controlScores.length, mean: mean(controlScores) },
        verdict: 'Not enough data yet.',
        detail: 'Kairos needs at least ' + minArm + ' rated events in each group and ' +
          minTotal + ' in total before it will claim anything.'
      };
    }

    var me = mean(electedScores), mc = mean(controlScores);
    var diff = me - mc;
    var rand = rng(hash(electedScores, controlScores));
    var diffs = new Array(BOOTSTRAP);
    for (var b = 0; b < BOOTSTRAP; b++) {
      diffs[b] = mean(resample(electedScores, rand)) - mean(resample(controlScores, rand));
    }
    diffs.sort(function (a, b2) { return a - b2; });
    var lo = quantile(diffs, 0.025), hi = quantile(diffs, 0.975);

    // Pooled SD gives a standardised effect size alongside the raw difference.
    var sp = pooledSd(electedScores, controlScores);
    var d = sp ? diff / sp : null;

    var crossesZero = lo <= 0 && hi >= 0;
    var verdict, status;
    if (crossesZero) {
      status = 'null';
      verdict = 'No measurable difference.';
    } else if (diff > 0) {
      status = 'positive';
      verdict = Math.abs(d) >= 0.5 ? 'Elected times rated clearly higher.' : 'Elected times rated slightly higher.';
    } else {
      status = 'negative';
      verdict = 'Elected times rated LOWER than the ones you picked yourself.';
    }

    return {
      status: status, n: n,
      elected: { n: electedScores.length, mean: round(me), sd: round(sd(electedScores)) },
      control: { n: controlScores.length, mean: round(mc), sd: round(sd(controlScores)) },
      diff: round(diff),
      ci: [round(lo), round(hi)],
      effectSize: round(d),
      verdict: verdict,
      detail: 'Difference in mean rating, with a 95% bootstrap confidence interval from ' +
        BOOTSTRAP + ' resamples.'
    };
  }

  function pooledSd(a, b) {
    if (a.length < 2 || b.length < 2) return null;
    var sa = sd(a), sb = sd(b);
    var num = (a.length - 1) * sa * sa + (b.length - 1) * sb * sb;
    return Math.sqrt(num / (a.length + b.length - 2));
  }

  function hash(a, b) {
    var h = 2166136261, i;
    for (i = 0; i < a.length; i++) h = (h ^ (a[i] * 97 + i)) * 16777619;
    for (i = 0; i < b.length; i++) h = (h ^ (b[i] * 89 + i)) * 16777619;
    return Math.abs(h | 0) || 1;
  }

  function round(x) { return x == null ? null : Math.round(x * 100) / 100; }

  /**
   * Does the app's own score predict the outcome? Spearman rank correlation
   * between the Kairos score and the user's rating, over every rated event.
   * This is the sharper question, and it is allowed to come out at zero.
   */
  function calibration(pairs, opts) {
    opts = opts || {};
    var minTotal = opts.minTotal || MIN_N_TOTAL;
    if (pairs.length < minTotal) {
      return { status: 'insufficient', n: pairs.length, need: minTotal - pairs.length,
        verdict: 'Not enough rated events yet.' };
    }
    var rho = spearman(pairs.map(function (p) { return p[0]; }), pairs.map(function (p) { return p[1]; }));
    var rand = rng(hash(pairs.map(function (p) { return p[0]; }), pairs.map(function (p) { return p[1]; })));
    var boots = new Array(BOOTSTRAP);
    for (var b = 0; b < BOOTSTRAP; b++) {
      var xs = [], ys = [];
      for (var i = 0; i < pairs.length; i++) {
        var k = (rand() * pairs.length) | 0;
        xs.push(pairs[k][0]); ys.push(pairs[k][1]);
      }
      boots[b] = spearman(xs, ys);
    }
    boots.sort(function (a, c) { return a - c; });
    var lo = quantile(boots, 0.025), hi = quantile(boots, 0.975);
    var crosses = lo <= 0 && hi >= 0;
    return {
      status: crosses ? 'null' : (rho > 0 ? 'positive' : 'negative'),
      n: pairs.length, rho: round(rho), ci: [round(lo), round(hi)],
      verdict: crosses
        ? 'The Kairos score does not track your outcomes.'
        : (rho > 0 ? 'Higher Kairos scores went with better outcomes for you.'
          : 'Higher Kairos scores went with WORSE outcomes for you.')
    };
  }

  function rank(xs) {
    var idx = xs.map(function (v, i) { return [v, i]; })
      .sort(function (a, b) { return a[0] - b[0]; });
    var r = new Array(xs.length), i = 0;
    while (i < idx.length) {
      var j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      var avg = (i + j) / 2 + 1;                     // average rank for ties
      for (var k = i; k <= j; k++) r[idx[k][1]] = avg;
      i = j + 1;
    }
    return r;
  }

  function spearman(xs, ys) {
    if (xs.length !== ys.length || xs.length < 2) return 0;
    var rx = rank(xs), ry = rank(ys);
    var mx = mean(rx), my = mean(ry);
    var num = 0, dx = 0, dy = 0;
    for (var i = 0; i < rx.length; i++) {
      var a = rx[i] - mx, b = ry[i] - my;
      num += a * b; dx += a * a; dy += b * b;
    }
    if (!dx || !dy) return 0;
    return num / Math.sqrt(dx * dy);
  }

  /** Group a ledger into per-intent-group comparisons. */
  function byGroup(entries, groupOf) {
    var groups = {};
    entries.forEach(function (e) {
      if (e.rating == null) return;
      var g = groupOf(e) || 'other';
      if (!groups[g]) groups[g] = { elected: [], control: [] };
      (e.elected ? groups[g].elected : groups[g].control).push(e.rating);
    });
    var out = {};
    Object.keys(groups).forEach(function (g) {
      out[g] = compare(groups[g].elected, groups[g].control);
    });
    return out;
  }

  root.KStats = {
    MIN_N_PER_ARM: MIN_N_PER_ARM, MIN_N_TOTAL: MIN_N_TOTAL,
    mean: mean, sd: sd, compare: compare, calibration: calibration,
    spearman: spearman, rank: rank, byGroup: byGroup, quantile: quantile
  };
})(typeof self !== 'undefined' ? self : this);
