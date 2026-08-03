/* Kairos — local storage. Nothing leaves the device; there is no account and
 * no server to have one with. Export/import is a plain JSON file the user owns.
 */
(function (root) {
  'use strict';
  var KEY = 'kairos.v1';
  var state = null;

  function blank() {
    return {
      version: 1,
      profile: null,          // { name, birthISO, place:{lat,lon,label}, unknownTime }
      settings: {
        houseSystem: 'whole',
        includeOuters: false,
        lang: 'en',
        days: [1, 2, 3, 4, 5],
        hours: [9, 18],
        horizonDays: 21
      },
      ledger: [],             // elections accepted + control events, with outcomes
      calendar: [],           // last imported ICS events, graded
      unlocked: false
    };
  }

  function load() {
    if (state) return state;
    try {
      var raw = root.localStorage.getItem(KEY);
      state = raw ? JSON.parse(raw) : blank();
    } catch (e) {
      state = blank();
    }
    if (!state.settings) state.settings = blank().settings;
    if (!state.ledger) state.ledger = [];
    return state;
  }

  function save() {
    try { root.localStorage.setItem(KEY, JSON.stringify(load())); } catch (e) { /* quota */ }
    return state;
  }

  function set(path, value) {
    var s = load(), parts = path.split('.'), o = s;
    for (var i = 0; i < parts.length - 1; i++) {
      if (o[parts[i]] == null) o[parts[i]] = {};
      o = o[parts[i]];
    }
    o[parts[parts.length - 1]] = value;
    return save();
  }

  function addLedger(entry) {
    var s = load();
    entry.id = entry.id || ('e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    entry.createdAt = new Date().toISOString();
    s.ledger.push(entry);
    save();
    return entry;
  }

  function updateLedger(id, patch) {
    var s = load();
    for (var i = 0; i < s.ledger.length; i++) {
      if (s.ledger[i].id === id) {
        for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) s.ledger[i][k] = patch[k];
        save();
        return s.ledger[i];
      }
    }
    return null;
  }

  function removeLedger(id) {
    var s = load();
    s.ledger = s.ledger.filter(function (e) { return e.id !== id; });
    return save();
  }

  /** Entries whose time has passed and that still have no rating. */
  function pendingOutcomes(now) {
    now = now || new Date();
    return load().ledger.filter(function (e) {
      return e.rating == null && new Date(e.when) < now;
    });
  }

  function exportJson() {
    return JSON.stringify(load(), null, 2);
  }

  function importJson(text) {
    var data = JSON.parse(text);
    if (!data || typeof data !== 'object') throw new Error('not a Kairos backup');
    if (!data.version) throw new Error('missing version');
    state = data;
    if (!state.settings) state.settings = blank().settings;
    if (!state.ledger) state.ledger = [];
    return save();
  }

  function reset() { state = blank(); return save(); }

  root.KDb = {
    load: load, save: save, set: set, blank: blank,
    addLedger: addLedger, updateLedger: updateLedger, removeLedger: removeLedger,
    pendingOutcomes: pendingOutcomes,
    exportJson: exportJson, importJson: importJson, reset: reset
  };
})(typeof self !== 'undefined' ? self : this);
