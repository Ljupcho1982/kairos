/* Loads the browser-global engine scripts into a Node context for testing. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WWW = path.join(__dirname, '..', 'www');
const Astronomy = require('./astronomy.node.js');

// db.js talks to localStorage; give it a real one so storage is testable too.
const store = new Map();
const localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
  clear: () => store.clear()
};

const sandbox = {
  Astronomy, console, Math, Date, JSON, Number, String, Array, Object,
  isNaN, parseFloat, parseInt, localStorage, Float64Array, RegExp, Error
};
sandbox.self = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

function load(rel) {
  const code = fs.readFileSync(path.join(WWW, rel), 'utf8');
  vm.runInContext(code, sandbox, { filename: rel });
}

[
  'js/astro/ephem.js',
  'js/astro/dignity.js',
  'js/astro/aspects.js',
  'js/astro/hours.js',
  'js/astro/timelords.js',
  'js/election/intents.js',
  'js/election/score.js',
  'js/election/search.js',
  'js/core/stats.js',
  'js/core/ics.js',
  'js/core/db.js',
  'js/core/places.js'
].forEach((f) => { if (fs.existsSync(path.join(WWW, f))) load(f); });

sandbox.__store = store;
module.exports = sandbox;
