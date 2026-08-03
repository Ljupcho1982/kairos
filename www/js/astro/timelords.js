/* Kairos — the Chapter: Hellenistic and Persian time-lord techniques.
 *
 * Micro-timing without macro-context is noise. These three techniques say
 * which topics are live in your life right now, and Kairos uses that to
 * re-weight elections as well as to narrate the year.
 *
 *  - Annual profections   (Valens; the most widespread Hellenistic time-lord)
 *  - Firdaria             (Persian/medieval, via Abu Ma'shar)
 *  - Zodiacal releasing   (Valens, Anthology IV, from the Lot of Spirit)
 */
(function (root) {
  'use strict';
  var E = root.KEphem, D = root.KDignity;
  var YEAR_MS = 365.2425 * E.MS_DAY;

  /* ---------------- annual profections ---------------------------------- */

  var HOUSE_TOPICS = [
    'body, self, vitality',
    'money, property, livelihood',
    'siblings, short journeys, neighbours',
    'home, parents, land, endings',
    'children, pleasure, creativity',
    'illness, work, subordinates',
    'partnership, marriage, contracts, open enemies',
    'death, debt, other people\'s money, crisis',
    'travel, learning, religion, the foreign',
    'career, reputation, action in the world',
    'friends, allies, benefactors, hopes',
    'loss, hidden things, confinement, secret enemies'
  ];

  /** Whole years elapsed since birth, and the exact solar-return-ish boundary. */
  function ageAt(birth, date) {
    var y = date.getUTCFullYear() - birth.getUTCFullYear();
    var anniv = new Date(Date.UTC(date.getUTCFullYear(), birth.getUTCMonth(), birth.getUTCDate(),
      birth.getUTCHours(), birth.getUTCMinutes()));
    if (date < anniv) { y -= 1; anniv = new Date(Date.UTC(date.getUTCFullYear() - 1, birth.getUTCMonth(),
      birth.getUTCDate(), birth.getUTCHours(), birth.getUTCMinutes())); }
    var next = new Date(Date.UTC(anniv.getUTCFullYear() + 1, birth.getUTCMonth(), birth.getUTCDate(),
      birth.getUTCHours(), birth.getUTCMinutes()));
    return { years: y, from: anniv, to: next };
  }

  /**
   * Annual profection: the Ascendant advances one whole sign per year of life.
   * The ruler of the sign it lands on is the Lord of the Year.
   */
  function profection(natal, date) {
    var a = ageAt(natal.birth, date);
    var ascSign = E.signIndex(natal.asc);
    var houseIdx = a.years % 12;                       // 0 = 1st house
    var sign = E.SIGNS[(ascSign + houseIdx) % 12];
    var lord = D.domicileRuler(sign);

    // Monthly profection: one sign per 1/12 of the year, from the annual sign.
    var monthLen = (a.to - a.from) / 12;
    var mIdx = Math.floor((date - a.from) / monthLen);
    var monthSign = E.SIGNS[(ascSign + houseIdx + mIdx) % 12];

    return {
      age: a.years, from: a.from, to: a.to,
      house: houseIdx + 1, sign: sign, lord: lord,
      topics: HOUSE_TOPICS[houseIdx],
      month: {
        index: mIdx + 1, sign: monthSign, lord: D.domicileRuler(monthSign),
        house: ((ascSign + houseIdx + mIdx) % 12 - ascSign + 24) % 12 + 1,
        from: new Date(a.from.getTime() + mIdx * monthLen),
        to: new Date(a.from.getTime() + (mIdx + 1) * monthLen)
      }
    };
  }

  /* ---------------- firdaria -------------------------------------------- */

  // Major periods in years. The nodes close the sequence and have no sub-periods.
  var FIRDAR_DAY = [['Sun', 10], ['Venus', 8], ['Mercury', 13], ['Moon', 9],
    ['Saturn', 11], ['Jupiter', 12], ['Mars', 7], ['NorthNode', 3], ['SouthNode', 2]];
  var FIRDAR_NIGHT = [['Moon', 9], ['Saturn', 11], ['Jupiter', 12], ['Mars', 7],
    ['Sun', 10], ['Venus', 8], ['Mercury', 13], ['NorthNode', 3], ['SouthNode', 2]];
  // Sub-periods run the seven planets in the same order, starting with the lord.
  var SUB_ORDER_DAY = ['Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars'];
  var SUB_ORDER_NIGHT = ['Moon', 'Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury'];

  function firdaria(natal, date) {
    var seq = natal.isDay ? FIRDAR_DAY : FIRDAR_NIGHT;
    var subOrder = natal.isDay ? SUB_ORDER_DAY : SUB_ORDER_NIGHT;
    var t = natal.birth.getTime(), elapsed = date.getTime() - t;
    var total = 75 * YEAR_MS;
    if (elapsed < 0) return null;
    elapsed = elapsed % total;                          // the cycle repeats after 75 years
    var cursor = 0;

    for (var i = 0; i < seq.length; i++) {
      var len = seq[i][1] * YEAR_MS;
      if (elapsed < cursor + len) {
        var lord = seq[i][0];
        var start = natal.birth.getTime() + cursor;
        var out = {
          lord: lord, from: new Date(start), to: new Date(start + len),
          years: seq[i][1], sub: null
        };
        if (lord !== 'NorthNode' && lord !== 'SouthNode') {
          var subLen = len / 7;
          var k = Math.floor((elapsed - cursor) / subLen);
          var startIdx = subOrder.indexOf(lord);
          out.sub = {
            lord: subOrder[(startIdx + k) % 7],
            from: new Date(start + k * subLen),
            to: new Date(start + (k + 1) * subLen),
            index: k + 1
          };
        }
        return out;
      }
      cursor += len;
    }
    return null;
  }

  /* ---------------- zodiacal releasing ---------------------------------- */

  // Lesser years of the domicile lord give each sign its period length.
  var ZR_YEARS = {
    Aries: 15, Taurus: 8, Gemini: 20, Cancer: 25, Leo: 19, Virgo: 20,
    Libra: 8, Scorpio: 15, Sagittarius: 12, Capricorn: 27, Aquarius: 30, Pisces: 12
  };

  /**
   * One level of releasing. Periods run in zodiacal order from `startSign`;
   * on completing a full circuit the sequence does not simply repeat — it
   * "looses the bond" and jumps to the sign opposite the one it began from
   * (Valens IV.4). That jump is the technique's signature turning point.
   */
  function releasingLevel(startSignIdx, startMs, endMs, unitMs) {
    var periods = [], idx = startSignIdx, t = startMs, guard = 0;
    var sinceStart = 0;
    while (t < endMs && guard++ < 400) {
      var sign = E.SIGNS[idx];
      var len = ZR_YEARS[sign] * unitMs;
      var to = Math.min(t + len, endMs);
      periods.push({
        sign: sign, lord: D.domicileRuler(sign),
        from: new Date(t), to: new Date(to),
        truncated: t + len > endMs,
        loosing: false
      });
      t += len;
      sinceStart++;
      if (sinceStart === 12) {                          // full circuit completed
        idx = (startSignIdx + 6) % 12;                  // loosing of the bond
        sinceStart = 0;
        if (periods.length) periods[periods.length - 1].loosing = true;
      } else {
        idx = (idx + 1) % 12;
      }
    }
    return periods;
  }

  function inPeriod(list, date) {
    for (var i = 0; i < list.length; i++) if (date >= list[i].from && date < list[i].to) return list[i];
    return null;
  }

  /**
   * Zodiacal releasing from the Lot of Spirit — the lot of deliberate action
   * and career. Returns the active L1/L2/L3 periods and whether the moment is
   * a "peak": a period in one of the four signs angular to the Lot of Fortune,
   * which Valens ties to the high points of a life.
   */
  function zodiacalReleasing(natal, date, lotName) {
    var lot = (lotName === 'fortune') ? natal.lots.fortune : natal.lots.spirit;
    var startIdx = E.signIndex(lot);
    var horizon = natal.birth.getTime() + 120 * YEAR_MS;

    var l1 = releasingLevel(startIdx, natal.birth.getTime(), horizon, YEAR_MS);
    var cur1 = inPeriod(l1, date);
    if (!cur1) return null;

    // Each level down converts the same period numbers to the next unit:
    // L1 in years, L2 in months, L3 in days (Valens IV.5).
    var monthMs = YEAR_MS / 12, dayMs = monthMs / 30;
    var l2 = releasingLevel(E.SIGNS.indexOf(cur1.sign), cur1.from.getTime(), cur1.to.getTime(), monthMs);
    var cur2 = inPeriod(l2, date);

    var l3 = null, cur3 = null;
    if (cur2) {
      l3 = releasingLevel(E.SIGNS.indexOf(cur2.sign), cur2.from.getTime(), cur2.to.getTime(), dayMs);
      cur3 = inPeriod(l3, date);
    }

    var fortuneIdx = E.signIndex(natal.lots.fortune);
    function angleFromFortune(sign) {
      return ((E.SIGNS.indexOf(sign) - fortuneIdx + 12) % 12) + 1;
    }
    var a1 = angleFromFortune(cur1.sign);
    var a2 = cur2 ? angleFromFortune(cur2.sign) : null;
    var peak = (a1 === 10 || a1 === 1 || a1 === 4 || a1 === 7) && (a2 === 10 || a2 === 1);

    return {
      lot: lotName || 'spirit',
      l1: cur1, l2: cur2, l3: cur3,
      l1List: l1, l2List: l2,
      houseFromFortune: { l1: a1, l2: a2 },
      peak: peak,
      peakReason: peak ? 'both the major and minor period fall on an angle of the Lot of Fortune' : null
    };
  }

  /** Everything the Chapter view needs, in one call. */
  function chapter(natal, date) {
    return {
      profection: profection(natal, date),
      firdaria: firdaria(natal, date),
      releasing: zodiacalReleasing(natal, date, 'spirit')
    };
  }

  root.KTimelords = {
    YEAR_MS: YEAR_MS, HOUSE_TOPICS: HOUSE_TOPICS, ZR_YEARS: ZR_YEARS,
    FIRDAR_DAY: FIRDAR_DAY, FIRDAR_NIGHT: FIRDAR_NIGHT,
    ageAt: ageAt, profection: profection, firdaria: firdaria,
    releasingLevel: releasingLevel, zodiacalReleasing: zodiacalReleasing,
    chapter: chapter
  };
})(typeof self !== 'undefined' ? self : this);
