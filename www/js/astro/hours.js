/* Kairos — planetary days and hours.
 *
 * The oldest and cheapest timing layer there is: the day belongs to a planet,
 * and daylight and night are each divided into twelve unequal hours running in
 * Chaldean order. It costs one sunrise/sunset lookup and users love it.
 */
(function (root) {
  'use strict';
  var A = root.Astronomy, E = root.KEphem;

  // Day rulers, Sunday first.
  var DAY_RULER = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
  var CHALDEAN = E.CHALDEAN; // Saturn, Jupiter, Mars, Sun, Venus, Mercury, Moon

  function observer(place) { return new A.Observer(place.lat, place.lon, 0); }

  /** Sunrise and sunset bracketing `date` at `place`, as timestamps. */
  function solarFrame(date, place) {
    var obs = observer(place);
    var back = new Date(date.getTime() - 36 * 3600000);
    var rise = A.SearchRiseSet('Sun', obs, +1, back, 4);
    var set = A.SearchRiseSet('Sun', obs, -1, back, 4);
    if (!rise || !set) return null;

    // Walk forward to the pair that brackets `date`.
    var r = rise.date.getTime(), s = set.date.getTime();
    for (var i = 0; i < 6; i++) {
      if (r <= date.getTime() && date.getTime() < s && r < s) break;
      if (s <= date.getTime() && date.getTime() < r && s < r) break;
      var nextR = A.SearchRiseSet('Sun', obs, +1, new Date(Math.min(r, s) + 3600000), 4);
      var nextS = A.SearchRiseSet('Sun', obs, -1, new Date(Math.min(r, s) + 3600000), 4);
      if (!nextR || !nextS) return null;
      if (r < s) { r = nextR.date.getTime(); } else { s = nextS.date.getTime(); }
    }
    return { rise: r, set: s };
  }

  /**
   * The planetary hour in force. The astrological day starts at sunrise, so
   * anything before sunrise still belongs to the previous calendar day's ruler.
   */
  function planetaryHour(date, place) {
    var f = solarFrame(date, place);
    if (!f) return null;
    var ms = date.getTime(), dayStart, isDay, hourLen, index;

    if (f.rise <= ms && ms < f.set) {
      isDay = true; dayStart = f.rise;
      hourLen = (f.set - f.rise) / 12;
      index = Math.floor((ms - f.rise) / hourLen);
    } else {
      isDay = false;
      var obs = observer(place);
      var setT = ms >= f.set ? f.set : A.SearchRiseSet('Sun', obs, -1, new Date(ms - 30 * 3600000), 2).date.getTime();
      var nextRise = A.SearchRiseSet('Sun', obs, +1, new Date(setT + 3600000), 2);
      if (!nextRise) return null;
      dayStart = setT;
      hourLen = (nextRise.date.getTime() - setT) / 12;
      index = Math.floor((ms - setT) / hourLen);
      if (index < 0 || index > 11) return null;
    }

    // Which weekday owns this astrological day (sunrise-to-sunrise)?
    var sunriseOfDay = isDay ? f.rise : (dayStart - 12 * 3600000);
    var weekday = new Date(isDay ? f.rise : f.set).getDay();
    var dayRuler = DAY_RULER[weekday];

    // The first hour of the day belongs to the day's ruler; hours then run in
    // Chaldean order. Night hours continue the same unbroken sequence.
    var startIdx = CHALDEAN.indexOf(dayRuler);
    var seq = index + (isDay ? 0 : 12);
    var ruler = CHALDEAN[(startIdx + seq) % 7];

    return {
      ruler: ruler, dayRuler: dayRuler, isDay: isDay,
      index: index + 1, of: 12,
      start: new Date(dayStart + index * hourLen),
      end: new Date(dayStart + (index + 1) * hourLen),
      lengthMinutes: hourLen / 60000,
      sunrise: new Date(sunriseOfDay)
    };
  }

  /** All 24 planetary hours covering the astrological day containing `date`. */
  function hoursOfDay(date, place) {
    var out = [], cur = planetaryHour(date, place);
    if (!cur) return out;
    var t = cur.sunrise.getTime() + 60000;
    for (var i = 0; i < 24; i++) {
      var h = planetaryHour(new Date(t), place);
      if (!h) break;
      out.push(h);
      t = h.end.getTime() + 60000;
    }
    return out;
  }

  root.KHours = {
    DAY_RULER: DAY_RULER, planetaryHour: planetaryHour,
    hoursOfDay: hoursOfDay, solarFrame: solarFrame
  };
})(typeof self !== 'undefined' ? self : this);
