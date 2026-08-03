/* Kairos — iCalendar in and out.
 *
 * Import is how the Grader gets at the meetings you already scheduled; export
 * is how an elected window gets into the calendar you actually use. ICS is
 * deliberate: it needs no account, no OAuth and no network.
 */
(function (root) {
  'use strict';

  function unfold(text) {
    // RFC 5545 folds long lines with CRLF + a single space or tab.
    return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
  }

  function unescapeText(s) {
    return s.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
  }

  function escapeText(s) {
    return String(s == null ? '' : s)
      .replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  }

  /**
   * Parse an ICS date-time. Handles UTC (Z), floating local, and date-only.
   * TZID is honoured only to the extent of not pretending it is UTC: a value
   * with a TZID is treated as local, which is right far more often than wrong
   * for a phone that is in the same place as its owner.
   */
  function parseDate(value, params) {
    var v = value.trim();
    var m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(v);
    if (!m) return null;
    var y = +m[1], mo = +m[2] - 1, d = +m[3];
    var hh = m[4] ? +m[4] : 0, mi = m[5] ? +m[5] : 0, ss = m[6] ? +m[6] : 0;
    if (m[7] === 'Z') return new Date(Date.UTC(y, mo, d, hh, mi, ss));
    return new Date(y, mo, d, hh, mi, ss);
  }

  /** Returns [{uid, summary, description, location, start, end, allDay}]. */
  function parse(text) {
    var lines = unfold(String(text)).split('\n');
    var events = [], cur = null;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!line) continue;
      if (line.indexOf('BEGIN:VEVENT') === 0) { cur = { allDay: false }; continue; }
      if (line.indexOf('END:VEVENT') === 0) {
        if (cur && cur.start) {
          if (!cur.end) cur.end = new Date(cur.start.getTime() + 3600000);
          events.push(cur);
        }
        cur = null; continue;
      }
      if (!cur) continue;

      var colon = line.indexOf(':');
      if (colon < 0) continue;
      var left = line.slice(0, colon), value = line.slice(colon + 1);
      var semi = left.indexOf(';');
      var name = (semi < 0 ? left : left.slice(0, semi)).toUpperCase();
      var params = semi < 0 ? '' : left.slice(semi + 1);

      switch (name) {
        case 'UID': cur.uid = value; break;
        case 'SUMMARY': cur.summary = unescapeText(value); break;
        case 'DESCRIPTION': cur.description = unescapeText(value); break;
        case 'LOCATION': cur.location = unescapeText(value); break;
        case 'DTSTART':
          cur.start = parseDate(value, params);
          if (/VALUE=DATE(?!-)/i.test(params)) cur.allDay = true;
          break;
        case 'DTEND': cur.end = parseDate(value, params); break;
        default: break;
      }
    }
    return events;
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function fmtUTC(d) {
    return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' +
      pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z';
  }

  function fold(line) {
    if (line.length <= 74) return line;
    var out = line.slice(0, 74), rest = line.slice(74);
    while (rest.length) { out += '\r\n ' + rest.slice(0, 73); rest = rest.slice(73); }
    return out;
  }

  /** Build an ICS file for elected windows. */
  function build(events, calName) {
    var out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Kairos//Electional//EN',
      'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'X-WR-CALNAME:' + escapeText(calName || 'Kairos')];
    events.forEach(function (e, idx) {
      out.push('BEGIN:VEVENT');
      out.push('UID:' + (e.uid || ('kairos-' + Date.now() + '-' + idx + '@kairos.local')));
      out.push('DTSTAMP:' + fmtUTC(new Date()));
      out.push('DTSTART:' + fmtUTC(e.start));
      out.push('DTEND:' + fmtUTC(e.end || new Date(e.start.getTime() + 3600000)));
      out.push(fold('SUMMARY:' + escapeText(e.summary || 'Elected time')));
      if (e.description) out.push(fold('DESCRIPTION:' + escapeText(e.description)));
      if (e.location) out.push(fold('LOCATION:' + escapeText(e.location)));
      out.push('END:VEVENT');
    });
    out.push('END:VCALENDAR');
    return out.join('\r\n') + '\r\n';
  }

  /**
   * Guess which intent an imported event is about, from its title. Deliberately
   * conservative: a wrong guess produces a wrong grade, so anything unmatched
   * is handed back for the user to classify.
   */
  /* Ordered most specific first: "Sign the lease" is a lease, not a generic
   * contract, and only the ordering can express that. Latin terms are matched
   * on word boundaries; non-Latin terms are matched as substrings, because
   * JavaScript's \b is defined over [A-Za-z0-9_] and silently never fires
   * against Cyrillic. */
  var HINTS = [
    ['sign_lease', ['lease', 'tenancy', 'rental agreement', 'наем', 'закуп', 'кирија']],
    ['job_interview', ['interview', 'intervju', 'hiring', 'screening call', 'интервју']],
    ['ask_raise', ['raise', 'salary review', 'comp review', 'плата', 'зголемување']],
    ['negotiate', ['negotiation', 'negotiate', 'negotiating', 'pregovor', 'deal terms', 'преговор']],
    ['first_date', ['date night', 'first date', 'дејт']],
    ['propose', ['proposal to marry', 'engagement', 'веридба']],
    ['elective_procedure', ['surgery', 'operation', 'procedure', 'операција', 'зафат']],
    ['start_treatment', ['treatment', 'therapy start', 'терапија']],
    ['move_house', ['moving day', 'movers', 'house move', 'селидба']],
    ['big_purchase', ['purchase', 'buy a', 'buying', 'car deal', 'купување']],
    ['start_journey', ['flight', 'departure', 'road trip', 'journey', 'патување', 'лет']],
    ['buy_ticket', ['book flight', 'book tickets', 'booking']],
    ['launch_publish', ['launch', 'go live', 'go-live', 'release', 'publish', 'лансирање']],
    ['begin_study', ['course', 'class', 'training', 'курс', 'обука']],
    ['file_official', ['filing', 'tax return', 'court', 'submission', 'пријава', 'поднесок']],
    ['hard_conversation', ['1:1', 'one-on-one', 'feedback', 'difficult conversation', 'разговор']],
    ['sign_contract', ['contract', 'agreement', 'signing', 'sign the', 'dogovor', 'договор', 'потпис']]
  ];

  var LATIN = /^[\x20-\x7E]+$/;

  function termMatches(term, s) {
    if (LATIN.test(term)) {
      var esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp('(^|[^A-Za-z0-9])' + esc + '($|[^A-Za-z0-9])', 'i').test(s);
    }
    return s.toLowerCase().indexOf(term.toLowerCase()) >= 0;
  }

  function guessIntent(summary) {
    var s = String(summary || '');
    if (!s.trim()) return null;
    for (var i = 0; i < HINTS.length; i++) {
      var terms = HINTS[i][1];
      for (var j = 0; j < terms.length; j++) {
        if (termMatches(terms[j], s)) return HINTS[i][0];
      }
    }
    return null;
  }

  root.KIcs = {
    parse: parse, build: build, guessIntent: guessIntent,
    escapeText: escapeText, unescapeText: unescapeText, parseDate: parseDate, fmtUTC: fmtUTC
  };
})(typeof self !== 'undefined' ? self : this);
