/* Kairos — the app. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var state = { intent: null, result: null, worker: null, reqId: 0, calendar: [] };
  var DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  /* ================= boot ================= */
  function boot() {
    var db = KDb.load();
    fillPlaces();
    bindTabs();
    bindOnboarding();
    bindAsk();
    bindCalendar();

    if (!db.profile) {
      show('#onboarding');
    } else {
      show('#app');
      renderIntents();
      renderChapter();
      renderLedger();
      renderSettings();
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  }

  function show(sel) {
    $('#onboarding').classList.add('hidden');
    $('#app').classList.add('hidden');
    $(sel).classList.remove('hidden');
  }

  function toast(msg, ms) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.add('hidden'); }, ms || 2600);
  }

  /* ================= onboarding ================= */
  function fillPlaces() {
    var sel = $('#ob-place');
    sel.innerHTML = KPlaces.map(function (p, i) {
      return '<option value="' + i + '">' + p.label + '</option>';
    }).join('') + '<option value="custom">Other (enter coordinates)</option>';
    sel.addEventListener('change', function () {
      var p = KPlaces[+sel.value];
      if (p) { $('#ob-lat').value = p.lat; $('#ob-lon').value = p.lon; }
    });
  }

  function bindOnboarding() {
    $('#ob-go').addEventListener('click', function () {
      var d = $('#ob-date').value, t = $('#ob-time').value || '12:00';
      if (!d) { toast('A date of birth is needed to build a chart.'); return; }
      var sel = $('#ob-place');
      var label = sel.value === 'custom' ? 'Custom' : KPlaces[+sel.value].label;
      KDb.set('profile', {
        name: $('#ob-name').value.trim(),
        birthISO: d + 'T' + t,
        unknownTime: t === '12:00',
        place: { lat: parseFloat($('#ob-lat').value), lon: parseFloat($('#ob-lon').value), label: label }
      });
      show('#app');
      renderIntents(); renderChapter(); renderLedger(); renderSettings();
    });
  }

  function profile() { return KDb.load().profile; }
  function place() { return profile().place; }
  function birth() { return new Date(profile().birthISO); }
  function natal() { return KEphem.natal(birth(), place(), KDb.load().settings.houseSystem); }

  /* ================= tabs ================= */
  function bindTabs() {
    $$('.tab').forEach(function (b) {
      b.addEventListener('click', function () {
        $$('.tab').forEach(function (x) { x.classList.remove('active'); });
        $$('.view').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        $('#view-' + b.dataset.view).classList.add('active');
        window.scrollTo(0, 0);
        if (b.dataset.view === 'chapter') renderChapter();
        if (b.dataset.view === 'ledger') renderLedger();
      });
    });
    $('.sheet-close').addEventListener('click', function () { $('#sheet').classList.add('hidden'); });
    $('#sheet').addEventListener('click', function (e) {
      if (e.target.id === 'sheet') $('#sheet').classList.add('hidden');
    });
  }

  /* ================= ask / elect ================= */
  function renderIntents() {
    var host = $('#intent-picker');
    host.innerHTML = KIntents.GROUPS.map(function (g) {
      var items = KIntents.inGroup(g.id).map(function (i) {
        return '<button class="intent" data-id="' + i.id + '">' +
          '<span class="ic">' + i.icon + '</span><span class="lb">' + i.label + '</span></button>';
      }).join('');
      return '<div class="group-title">' + g.icon + ' ' + g.label + '</div><div class="intent-grid">' + items + '</div>';
    }).join('');
    $$('.intent', host).forEach(function (b) {
      b.addEventListener('click', function () { chooseIntent(b.dataset.id); });
    });
  }

  function chooseIntent(id) {
    state.intent = KIntents.get(id);
    var s = KDb.load().settings;
    $('#intent-picker').classList.add('hidden');
    $('#ask-results').classList.add('hidden');
    $('#ask-config').classList.remove('hidden');
    $('#chosen-intent').innerHTML =
      '<span class="ic">' + state.intent.icon + '</span>' +
      '<span><span class="lb">' + state.intent.label + '</span>' +
      '<span class="sub">' + state.intent.note + '</span></span>';
    $('#cfg-horizon').value = String(s.horizonDays);
    $('#cfg-h1').value = s.hours[0];
    $('#cfg-h2').value = s.hours[1];
    renderDayPicker(s.days);
  }

  function renderDayPicker(days) {
    var host = $('#cfg-days');
    host.innerHTML = DAY_LABELS.map(function (d, i) {
      return '<button data-d="' + i + '" class="' + (days.indexOf(i) >= 0 ? 'on' : '') + '">' + d + '</button>';
    }).join('');
    $$('button', host).forEach(function (b) {
      b.addEventListener('click', function () { b.classList.toggle('on'); });
    });
  }

  function selectedDays() {
    return $$('#cfg-days button.on').map(function (b) { return +b.dataset.d; });
  }

  function bindAsk() {
    $('#cfg-back').addEventListener('click', function () {
      $('#ask-config').classList.add('hidden');
      $('#intent-picker').classList.remove('hidden');
    });
    $('#cfg-run').addEventListener('click', runSearch);
  }

  function getWorker() {
    if (state.worker) return state.worker;
    try {
      state.worker = new Worker('js/election/worker.js');
      state.worker.onmessage = onWorkerMessage;
      state.worker.onerror = function () { state.worker = null; };
    } catch (e) {
      state.worker = null;
    }
    return state.worker;
  }

  function runSearch() {
    var s = KDb.load().settings;
    var days = selectedDays();
    if (!days.length) { toast('Pick at least one day of the week.'); return; }
    var h1 = Math.max(0, Math.min(23, +$('#cfg-h1').value));
    var h2 = Math.max(h1 + 1, Math.min(24, +$('#cfg-h2').value));
    var horizon = +$('#cfg-horizon').value;

    KDb.set('settings.days', days);
    KDb.set('settings.hours', [h1, h2]);
    KDb.set('settings.horizonDays', horizon);

    var from = new Date();
    var to = new Date(from.getTime() + horizon * 86400000);

    $('#ask-config').classList.add('hidden');
    $('#ask-results').classList.add('hidden');
    $('#ask-progress').classList.remove('hidden');
    setProgress(0, 'Reading the sky…');

    var opts = {
      intentId: state.intent.id, place: place(),
      from: from.toISOString(), to: to.toISOString(),
      days: days, hours: [h1, h2],
      houseSystem: s.houseSystem, includeOuters: s.includeOuters,
      natalBirth: profile().birthISO
    };

    var w = getWorker();
    if (w) {
      state.reqId++;
      w.postMessage({ type: 'search', id: state.reqId, opts: opts });
    } else {
      // No worker (file:// or an old webview): run inline so the app still works.
      setTimeout(function () {
        try {
          var res = KSearch.search({
            intentId: opts.intentId, place: opts.place,
            from: from, to: to, days: days, hours: [h1, h2],
            houseSystem: s.houseSystem, includeOuters: s.includeOuters,
            natal: natal()
          });
          renderResults(normalise(res));
        } catch (err) { searchFailed(err.message); }
      }, 30);
    }
  }

  function normalise(res) {
    return {
      intent: res.intent, chapter: res.chapter, scanned: res.scanned, median: res.median,
      message: res.message,
      avoid: res.avoid ? { at: res.avoid.at, score: res.avoid.score, reasons: res.avoid.detail.reasons.slice(0, 4) } : null,
      windows: (res.windows || []).map(function (w) {
        return { from: w.from, to: w.to, at: w.at, score: w.score,
          voidOfCourse: w.detail.voidOfCourse, moonSign: w.detail.moonSign, hour: w.detail.hour,
          good: w.detail.good.slice(0, 6), bad: w.detail.bad.slice(0, 5), notes: w.detail.notes };
      })
    };
  }

  function onWorkerMessage(ev) {
    var m = ev.data;
    if (m.type === 'progress') setProgress(m.value);
    else if (m.type === 'result') renderResults(m.result);
    else if (m.type === 'graded') renderGraded(m.events);
    else if (m.type === 'error') searchFailed(m.message);
  }

  function searchFailed(msg) {
    $('#ask-progress').classList.add('hidden');
    $('#ask-config').classList.remove('hidden');
    toast('Search failed: ' + msg, 4000);
  }

  function setProgress(f, text) {
    $('#progress-bar').style.width = Math.round(f * 100) + '%';
    if (text) $('#progress-text').textContent = text;
    else if (f > 0.7) $('#progress-text').textContent = 'Refining to the minute…';
    else $('#progress-text').textContent = 'Scoring every quarter hour…';
  }

  function scoreClass(n) { return n >= 66 ? 's-hi' : n >= 48 ? 's-mid' : 's-lo'; }

  function fmtDay(d) {
    d = new Date(d);
    return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  }
  function fmtTime(d) {
    d = new Date(d);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function reasonList(items, cls) {
    return items.map(function (r) {
      return '<li class="' + cls + '"><span class="pt">' + (r.points > 0 ? '+' : '') + r.points + '</span>' +
        '<span>' + escapeHtml(r.label) + '<span class="src">' + escapeHtml(r.source) + '</span></span></li>';
    }).join('');
  }

  function renderResults(res) {
    state.result = res;
    $('#ask-progress').classList.add('hidden');
    var host = $('#ask-results');
    host.classList.remove('hidden');

    var intent = res.intent;
    var html = '';

    if (intent.caution) {
      html += '<div class="banner caution">⚠️ ' + escapeHtml(KIntents.CAUTIONS[intent.caution]) + '</div>';
    }

    if (!res.windows.length) {
      html += '<div class="card"><h3>Nothing stands out</h3><p class="muted">' +
        escapeHtml(res.message || 'No moment in that range scored well. Widen the days or hours and try again.') +
        '</p></div>';
    } else {
      html += '<div class="banner info">Scanned <b>' + res.scanned + '</b> candidate moments. ' +
        'The typical moment in your window scored <b>' + Math.round(res.median) + '</b>.</div>';

      res.windows.forEach(function (w, i) {
        html += '<div class="win ' + (i === 0 ? 'best' : '') + '">' +
          '<div class="win-head"><div>' +
          '<div class="win-when">' + fmtTime(w.from) + ' – ' + fmtTime(w.to) + '</div>' +
          '<div class="win-date">' + fmtDay(w.from) +
          (w.hour ? ' · hour of ' + w.hour : '') +
          (w.moonSign ? ' · Moon in ' + w.moonSign : '') + '</div>' +
          '</div><div class="score ' + scoreClass(w.score) + '"><b>' + w.score + '</b><small>score</small></div></div>' +
          '<ul class="reasons">' + reasonList(w.good, 'good') + reasonList(w.bad, 'bad') + reasonList(w.notes, 'note') + '</ul>' +
          '<div class="win-actions">' +
          '<button class="primary" data-accept="' + i + '">Take this time</button>' +
          '<button data-ics="' + i + '">Add to calendar</button>' +
          '</div></div>';
      });

      if (res.avoid) {
        html += '<div class="win avoid"><div class="win-head"><div>' +
          '<div class="win-when">Avoid ' + fmtDay(res.avoid.at) + ', ' + fmtTime(res.avoid.at) + '</div>' +
          '<div class="win-date">the worst moment Kairos found in your window</div></div>' +
          '<div class="score s-lo"><b>' + res.avoid.score + '</b><small>score</small></div></div>' +
          '<ul class="reasons">' + reasonList(res.avoid.reasons, 'bad') + '</ul></div>';
      }
    }

    html += '<button class="ghost" id="res-back">Elect something else</button>';
    host.innerHTML = html;

    $$('[data-accept]', host).forEach(function (b) {
      b.addEventListener('click', function () { acceptWindow(+b.dataset.accept); });
    });
    $$('[data-ics]', host).forEach(function (b) {
      b.addEventListener('click', function () { downloadIcs(+b.dataset.ics); });
    });
    $('#res-back').addEventListener('click', function () {
      host.classList.add('hidden');
      $('#intent-picker').classList.remove('hidden');
    });
    window.scrollTo(0, 0);
  }

  function acceptWindow(i) {
    var w = state.result.windows[i];
    KDb.addLedger({
      intentId: state.result.intent.id,
      intentLabel: state.result.intent.label,
      icon: state.result.intent.icon,
      when: new Date(w.at).toISOString(),
      windowFrom: new Date(w.from).toISOString(),
      windowTo: new Date(w.to).toISOString(),
      kairosScore: w.score,
      elected: true,
      rating: null
    });
    toast('Added to your ledger. Kairos will ask how it went.');
    renderLedger();
  }

  function downloadIcs(i) {
    var w = state.result.windows[i], intent = state.result.intent;
    var desc = 'Elected by Kairos (score ' + w.score + ').\n\n' +
      w.good.map(function (r) { return '+ ' + r.label; }).join('\n') + '\n' +
      w.bad.map(function (r) { return '- ' + r.label; }).join('\n');
    var ics = KIcs.build([{
      start: new Date(w.from), end: new Date(w.to),
      summary: intent.icon + ' ' + intent.label + ' (Kairos ' + w.score + ')',
      description: desc
    }], 'Kairos');
    saveFile(ics, 'kairos-' + intent.id + '.ics', 'text/calendar');
    // Taking a time and putting it in the calendar are the same decision.
    acceptWindow(i);
  }

  function saveFile(text, name, mime) {
    var blob = new Blob([text], { type: mime || 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  /* ================= chapter ================= */
  function renderChapter() {
    if (!profile()) return;
    var host = $('#chapter-body');
    var n = natal();
    var now = new Date();
    var ch = KTimelords.chapter(n, now);
    var sky = KEphem.sky(now, place(), { houseSystem: KDb.load().settings.houseSystem });
    var hour = KHours.planetaryHour(now, place());
    var voc = KAspects.moonVoid(now, place(), 3, null, { includeOuters: KDb.load().settings.includeOuters });

    var p = ch.profection;
    var html = '<div class="chap-hero">' +
      '<div class="lord">Lord of the year · ' + p.lord + '</div>' +
      '<h3>' + KScore.ordinal(p.house) + '-house year in ' + p.sign + '</h3>' +
      '<p>' + escapeHtml(KTimelords.HOUSE_TOPICS[p.house - 1]) + '.<br>' +
      'This chapter runs to ' + fmtDay(p.to) + ' ' + p.to.getFullYear() + '.</p></div>';

    html += '<div class="card"><h3>Where you are</h3>' +
      kv('Profected month', KScore.ordinal(p.month.house) + ' house · ' + p.month.sign + ' · ' + p.month.lord);
    if (ch.firdaria) {
      html += kv('Firdaria', ch.firdaria.lord + (ch.firdaria.sub ? ' / ' + ch.firdaria.sub.lord : '') +
        ' <span class="pill">' + ch.firdaria.from.getFullYear() + '–' + ch.firdaria.to.getFullYear() + '</span>');
    }
    if (ch.releasing) {
      var r = ch.releasing;
      html += kv('Releasing (Spirit)', r.l1.sign + (r.l2 ? ' / ' + r.l2.sign : '') +
        (r.peak ? '<span class="pill peak">peak period</span>' : ''));
      html += kv('Major period', fmtDay(r.l1.from) + ' ' + r.l1.from.getFullYear() + ' → ' +
        fmtDay(r.l1.to) + ' ' + r.l1.to.getFullYear());
      if (r.l1.loosing) html += kv('', '<span class="pill">loosing of the bond ahead</span>');
    }
    html += '</div>';

    html += '<div class="card"><h3>The sky right now</h3>' +
      kv('Ascendant', fmtDeg(sky.asc)) +
      kv('Sect', sky.isDay ? 'day chart' : 'night chart') +
      kv('Planetary hour', hour ? hour.ruler + ' <span class="pill">' + fmtTime(hour.start) + '–' + fmtTime(hour.end) + '</span>' : '—') +
      kv('Moon', fmtDeg(sky.bodies.Moon.lon) + (voc.isVoid ? ' <span class="pill">void until ' + fmtTime(voc.until) + '</span>' : '')) +
      '<div class="sky-row">' + KEphem.CLASSICAL.map(function (b) {
        var x = sky.bodies[b];
        return '<div class="sky-cell"><div class="p">' + b + '</div><div class="s">' +
          x.sign.slice(0, 3) + ' ' + Math.floor(x.deg) + '°</div>' +
          (x.retro ? '<div class="r">℞</div>' : '') + '</div>';
      }).join('') + '</div></div>';

    if (profile().unknownTime) {
      html += '<div class="banner caution">Your birth time is set to 12:00, so the Ascendant, the houses and everything built on them (profections, releasing, the natal overlay) are approximate. Set a real time in Settings when you have it.</div>';
    }

    host.innerHTML = html;
  }

  function kv(k, v) { return '<div class="kv"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>'; }
  function fmtDeg(lon) {
    return Math.floor(KEphem.degInSign(lon)) + '° ' + KEphem.signName(lon);
  }

  /* ================= calendar / grader ================= */
  function bindCalendar() {
    $('#ics-pick').addEventListener('click', function () { $('#ics-file').click(); });
    $('#ics-file').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () { gradeIcs(String(reader.result)); };
      reader.readAsText(f);
    });
  }

  function gradeIcs(text) {
    var events = KIcs.parse(text);
    var now = Date.now();
    var future = events.filter(function (e) { return e.start && e.start.getTime() > now && !e.allDay; });
    if (!future.length) {
      $('#calendar-body').innerHTML = '<div class="card"><h3>Nothing to grade</h3>' +
        '<p class="muted">Found ' + events.length + ' event(s), but none of them are timed events in the future.</p></div>';
      return;
    }
    var classified = future.map(function (e) {
      return { uid: e.uid, summary: e.summary || '(untitled)', start: e.start.toISOString(),
        intentId: KIcs.guessIntent(e.summary) };
    });
    var recognised = classified.filter(function (e) { return e.intentId; });
    state.calendar = classified;

    if (!recognised.length) {
      $('#calendar-body').innerHTML = '<div class="card"><h3>Nothing recognised</h3>' +
        '<p class="muted">Kairos found ' + future.length + ' upcoming event(s) but could not tell what kind of undertaking any of them is. It will not guess: a wrong guess produces a wrong grade. Rename an event to mention what it is (for example "contract", "interview", "lease") and import again.</p></div>';
      return;
    }

    var s = KDb.load().settings;
    var w = getWorker();
    var payload = { events: recognised, place: place(), houseSystem: s.houseSystem,
      includeOuters: s.includeOuters, natalBirth: profile().birthISO };
    $('#calendar-body').innerHTML = '<div class="card center"><div class="spinner"></div><p>Grading ' + recognised.length + ' event(s)…</p></div>';
    if (w) {
      state.reqId++;
      w.postMessage({ type: 'grade', id: state.reqId, opts: payload });
    } else {
      var out = recognised.map(function (e) {
        return { uid: e.uid, summary: e.summary, start: e.start, intentId: e.intentId,
          detail: KSearch.grade(new Date(e.start), { intentId: e.intentId, place: place(),
            natal: natal(), houseSystem: s.houseSystem, includeOuters: s.includeOuters }) };
      });
      renderGraded(out);
    }
  }

  function renderGraded(events) {
    events.sort(function (a, b) { return a.detail.score - b.detail.score; });
    var unknown = state.calendar.filter(function (e) { return !e.intentId; }).length;
    var html = '';
    if (unknown) {
      html += '<div class="banner info">' + unknown + ' other upcoming event(s) were left ungraded because Kairos could not tell what kind of undertaking they are.</div>';
    }
    events.forEach(function (e) {
      var intent = KIntents.get(e.intentId);
      var d = e.detail;
      html += '<div class="win ' + (d.score < 45 ? 'avoid' : '') + '">' +
        '<div class="win-head"><div>' +
        '<div class="win-when">' + escapeHtml(e.summary) + '</div>' +
        '<div class="win-date">' + fmtDay(e.start) + ' ' + fmtTime(e.start) + ' · read as ' + intent.icon + ' ' + intent.label + '</div>' +
        '</div><div class="score ' + scoreClass(d.score) + '"><b>' + d.score + '</b><small>score</small></div></div>' +
        '<ul class="reasons">' + reasonList(d.bad.slice(0, 4), 'bad') + reasonList(d.good.slice(0, 3), 'good') + '</ul>' +
        (d.score < 55 ? '<div class="win-actions"><button class="primary" data-refix="' + e.intentId + '">Find a better time</button></div>' : '') +
        '</div>';
    });
    $('#calendar-body').innerHTML = html;
    $$('[data-refix]', $('#calendar-body')).forEach(function (b) {
      b.addEventListener('click', function () {
        $$('.tab').forEach(function (x) { x.classList.remove('active'); });
        $$('.view').forEach(function (x) { x.classList.remove('active'); });
        $('.tab[data-view="ask"]').classList.add('active');
        $('#view-ask').classList.add('active');
        $('#ask-results').classList.add('hidden');
        chooseIntent(b.dataset.refix);
        window.scrollTo(0, 0);
      });
    });
  }

  /* ================= ledger ================= */
  function renderLedger() {
    if (!profile()) return;
    var db = KDb.load();
    var entries = db.ledger.slice().sort(function (a, b) { return new Date(b.when) - new Date(a.when); });
    var host = $('#ledger-body');

    if (!entries.length) {
      host.innerHTML = '<div class="card"><h3>Nothing recorded yet</h3><p class="muted">' +
        'Every time you take an elected moment, it lands here. Once the moment has passed, Kairos asks you one question — how did it go? — and starts measuring whether its own advice is worth anything to you.</p>' +
        '<p class="muted">You can also log events you scheduled <em>without</em> Kairos. Those are the control group, and without them the comparison means nothing.</p>' +
        '<button class="primary" id="add-control">Log an event I chose myself</button></div>';
      $('#add-control').addEventListener('click', addControl);
      return;
    }

    var rated = entries.filter(function (e) { return e.rating != null; });
    var elected = rated.filter(function (e) { return e.elected; }).map(function (e) { return e.rating; });
    var control = rated.filter(function (e) { return !e.elected; }).map(function (e) { return e.rating; });
    var cmp = KStats.compare(elected, control);
    var cal = KStats.calibration(rated.map(function (e) { return [e.kairosScore, e.rating]; }));

    var html = '<div class="stat ' + cmp.status + '"><h4>Does electing help you?</h4>' +
      '<div class="verdict">' + cmp.verdict + '</div>';
    if (cmp.status === 'insufficient') {
      html += '<div class="num">' + escapeHtml(cmp.detail) + '<br>Rated so far: ' +
        cmp.elected.n + ' elected, ' + cmp.control.n + ' self-chosen.</div>';
    } else {
      html += '<div class="num">elected ' + cmp.elected.mean + ' (n=' + cmp.elected.n + ') vs ' +
        'self-chosen ' + cmp.control.mean + ' (n=' + cmp.control.n + ')<br>' +
        'difference ' + (cmp.diff > 0 ? '+' : '') + cmp.diff +
        ' · 95% CI [' + cmp.ci[0] + ', ' + cmp.ci[1] + ']</div>';
    }
    html += '</div>';

    html += '<div class="stat ' + cal.status + '"><h4>Does the score track your outcomes?</h4>' +
      '<div class="verdict">' + cal.verdict + '</div>' +
      (cal.status === 'insufficient'
        ? '<div class="num">' + cal.need + ' more rated event(s) needed.</div>'
        : '<div class="num">Spearman ρ = ' + cal.rho + ' · 95% CI [' + cal.ci[0] + ', ' + cal.ci[1] + '] · n=' + cal.n + '</div>') +
      '</div>';

    var pending = KDb.pendingOutcomes();
    if (pending.length) {
      html += '<div class="card"><h3>How did these go?</h3>' +
        pending.map(entryRow).join('') + '</div>';
    }

    html += '<div class="card"><h3>All entries</h3>' + entries.map(entryRow).join('') +
      '<button class="primary" id="add-control" style="margin-top:14px">Log an event I chose myself</button></div>';

    host.innerHTML = html;
    bindRatings(host);
    var ac = $('#add-control', host);
    if (ac) ac.addEventListener('click', addControl);
  }

  function entryRow(e) {
    var stars = [1, 2, 3, 4, 5].map(function (n) {
      return '<button data-rate="' + e.id + '" data-n="' + n + '" class="' + (e.rating === n ? 'on' : '') + '">' + n + '</button>';
    }).join('');
    return '<div class="entry"><span class="ic">' + (e.icon || '•') + '</span>' +
      '<span class="mid"><span class="t">' + escapeHtml(e.intentLabel || e.intentId) + '</span>' +
      '<span class="d">' + fmtDay(e.when) + ' ' + fmtTime(e.when) +
      (e.elected ? ' · elected, score ' + e.kairosScore : ' · self-chosen') + '</span></span>' +
      '<span class="rate">' + stars + '</span></div>';
  }

  function bindRatings(host) {
    $$('[data-rate]', host).forEach(function (b) {
      b.addEventListener('click', function () {
        KDb.updateLedger(b.dataset.rate, { rating: +b.dataset.n });
        renderLedger();
      });
    });
  }

  function addControl() {
    var opts = KIntents.INTENTS.map(function (i) {
      return '<option value="' + i.id + '">' + i.icon + ' ' + i.label + '</option>';
    }).join('');
    sheet('<h3>Log an event you chose yourself</h3>' +
      '<p class="muted">This is the control group. Without events you picked without Kairos, the comparison has nothing to compare against.</p>' +
      '<label class="field"><span>What was it?</span><select id="ctl-intent">' + opts + '</select></label>' +
      '<label class="field"><span>When?</span><input id="ctl-when" type="datetime-local"></label>' +
      '<button class="primary big" id="ctl-save">Add to ledger</button>');
    $('#ctl-when').value = new Date(Date.now() - 86400000).toISOString().slice(0, 16);
    $('#ctl-save').addEventListener('click', function () {
      var id = $('#ctl-intent').value, when = $('#ctl-when').value;
      if (!when) { toast('Pick a date and time.'); return; }
      var intent = KIntents.get(id);
      var score = null;
      try {
        score = KSearch.grade(new Date(when), { intentId: id, place: place(), natal: natal(),
          houseSystem: KDb.load().settings.houseSystem }).score;
      } catch (e) { /* scoring a control is a bonus, not a requirement */ }
      KDb.addLedger({ intentId: id, intentLabel: intent.label, icon: intent.icon,
        when: new Date(when).toISOString(), kairosScore: score, elected: false, rating: null });
      $('#sheet').classList.add('hidden');
      renderLedger();
      toast('Logged. Rate it whenever you like.');
    });
  }

  function sheet(html) {
    $('#sheet-body').innerHTML = html;
    $('#sheet').classList.remove('hidden');
  }

  /* ================= settings ================= */
  function renderSettings() {
    var db = KDb.load(), p = db.profile;
    var host = $('#settings-body');
    host.innerHTML =
      '<div class="card"><h3>Your chart</h3>' +
      '<label class="field"><span>Birth date &amp; time</span><input id="set-birth" type="datetime-local" value="' + p.birthISO + '"></label>' +
      '<div class="field row"><label class="half"><span>Latitude</span><input id="set-lat" type="number" step="0.0001" value="' + p.place.lat + '"></label>' +
      '<label class="half"><span>Longitude</span><input id="set-lon" type="number" step="0.0001" value="' + p.place.lon + '"></label></div>' +
      '<button class="primary" id="set-save">Save</button></div>' +

      '<div class="card"><h3>Technique</h3>' +
      '<label class="field"><span>Houses</span><select id="set-houses">' +
      '<option value="whole"' + (db.settings.houseSystem === 'whole' ? ' selected' : '') + '>Whole sign (traditional)</option>' +
      '<option value="placidus"' + (db.settings.houseSystem === 'placidus' ? ' selected' : '') + '>Placidus</option>' +
      '</select><small class="hint">Every technique in Kairos — profections, releasing, sect, the rule packs — is Hellenistic, and Hellenistic astrology is whole-sign. Placidus is offered for a familiar-looking wheel.</small></label>' +
      '<label class="field"><span>Void-of-course Moon</span><select id="set-outers">' +
      '<option value="0"' + (!db.settings.includeOuters ? ' selected' : '') + '>Traditional — seven planets</option>' +
      '<option value="1"' + (db.settings.includeOuters ? ' selected' : '') + '>Modern — include Uranus, Neptune, Pluto</option>' +
      '</select><small class="hint">This changes real answers. On 13 Aug 2026 the traditional reading gives a 43-hour void and the modern one 19, because the Moon squares Uranus in between.</small></label>' +
      '</div>' +

      '<div class="card"><h3>Your data</h3>' +
      '<p class="muted">Everything is stored on this device. There is no account and no server.</p>' +
      '<button class="primary" id="set-export">Export a backup</button>' +
      '<button class="ghost" id="set-import">Import a backup</button>' +
      '<input type="file" id="set-file" accept="application/json" hidden>' +
      '<button class="ghost" id="set-reset" style="color:var(--bad)">Erase everything</button></div>' +

      '<div class="card"><h3>About</h3><p class="muted">Kairos elects times using traditional (Hellenistic and medieval) technique. Positions come from astronomy-engine, accurate to about one arcminute. Every point in a score names the rule and the source it came from.</p>' +
      '<p class="muted">Kairos is not medical, legal or financial advice.</p></div>';

    $('#set-save').addEventListener('click', function () {
      KDb.set('profile.birthISO', $('#set-birth').value);
      KDb.set('profile.unknownTime', false);
      KDb.set('profile.place', { lat: parseFloat($('#set-lat').value), lon: parseFloat($('#set-lon').value), label: p.place.label });
      toast('Saved.'); renderChapter();
    });
    $('#set-houses').addEventListener('change', function (e) { KDb.set('settings.houseSystem', e.target.value); renderChapter(); });
    $('#set-outers').addEventListener('change', function (e) { KDb.set('settings.includeOuters', e.target.value === '1'); renderChapter(); });
    $('#set-export').addEventListener('click', function () {
      saveFile(KDb.exportJson(), 'kairos-backup.json', 'application/json');
    });
    $('#set-import').addEventListener('click', function () { $('#set-file').click(); });
    $('#set-file').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        try { KDb.importJson(String(r.result)); toast('Backup restored.'); location.reload(); }
        catch (err) { toast('That file is not a Kairos backup.'); }
      };
      r.readAsText(f);
    });
    $('#set-reset').addEventListener('click', function () {
      if (confirm('Erase your chart, your settings and your entire ledger? This cannot be undone.')) {
        KDb.reset(); location.reload();
      }
    });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
