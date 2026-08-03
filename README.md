# Kairos — the astrology app that answers **when**, not *what* ⏳✨

**One line:** Every astrology app on earth describes your day. Kairos **picks your moment** — you tell it what you're about to do ("sign the lease", "ask for the raise", "first date", "launch the app"), and it searches the real sky minute-by-minute across your available window and hands you the three best times, the reasons, the risks — and then **grades itself afterwards on whether it actually helped.**

Ancient name for the idea: *kairós* (καιρός) — the opportune moment — as opposed to *chronos*, mere clock time. The branch of astrology that does this is **electional** (Greek *katarché*), it's ~2,200 years old, it's the most practical thing astrology ever produced, and **no consumer mobile app owns it.**

---

## The gap (researched, August 2026)

The category is enormous and it is all doing the *same one thing*:

| App | What it actually sells |
|---|---|
| Co-Star | short poetic daily push notifications + social compatibility |
| The Pattern | psychological personality narrative, jargon hidden |
| CHANI | human-written daily content + transit alerts |
| Sanctuary | per-minute live chat with human astrologers |
| Nebula / AstroTalk | aggressive trial funnels, generic horoscopes |

Every one of them is **descriptive and one-way**: *here is what today means for you*. None of them tell you **what to do with your calendar**, and none of them can ever be wrong — which is exactly why their business model degrades into subscription traps. In review mining, cancel-flow complaints dominate the 1-star tier across Co-Star, The Pattern and Nebula.

Electional tools *do* exist — astro.com's "Best Time", Astro-Seek, Augurine, Upstellar, Vox Stella, Alphee's Father Time — but they are **desktop/web calculators for people who already know the vocabulary.** They don't live on your phone, they don't touch your calendar, they don't work offline, and they never follow up.

The traditional time-lord techniques (annual profections, firdaria, zodiacal releasing) are in the same state: real, deterministic, beloved by the serious-astrology audience, and available only as bare web calculators (Astro Engine, Cosmos Daily, AstroApp).

**So the hole in the market is exact:** the decision layer. The *when*. Nobody shipped it as a phone app, and nobody at all has shipped the follow-up.

---

## Why this is genuinely new (four things nobody has together)

1. **It outputs a decision, not a description.** The unit of the product is a *time*, with a "why", ready to drop into your calendar.
2. **It runs two ways on your calendar.** It doesn't only propose times — it **grades the meetings you already scheduled** and offers to move the bad ones. That is the first honestly useful thing astrology can do with a phone's data.
3. **It keeps score on itself.** Every election you accept becomes a tracked event that asks "how did it go?" afterwards. Kairos then shows you *your own* hit rate, per intent, with honest null results. An astrology app that can be wrong — and says so — is a new object in this category.
4. **It's built on traditional technique, with citations.** Every point in a score traces to a named rule from a named source (Dorotheus, Valens, Bonatti, Lilly). No black-box "AI cosmic energy score." This is what the serious astrology audience has been asking for and generic AI apps cannot deliver.

Plus the business differentiator that writes itself out of the review mining: **no account, no cloud, no auto-renewing subscription.** One-time unlock. Works on a plane.

---

## The five mechanics

### 1. The Ask
You pick an intent from a curated taxonomy (~40 entries), not a free-text prompt:

> 💼 job interview · negotiate salary · sign a contract · start a business · launch/publish · ask for a favour
> 🏠 sign a lease · move house · make a large purchase · sell something
> ❤️ first date · propose · difficult conversation · reconcile
> ⚕️ elective procedure · start a treatment · begin a diet/training plan
> ✈️ start a journey · buy a ticket · begin a course of study

Each intent carries a **rule pack**: which house rules the matter, which planet signifies it, which afflictions are fatal vs. cosmetic. *Ask for a raise* and *sign a lease* are graded by different rules — as they always were in the tradition. (Generic apps blanket-apply "Mercury retrograde = bad." Kairos applies Mercury retrograde **only where the tradition actually applies it**: contracts, purchases, travel, communication. That fidelity is the credibility hook.)

### 2. The Search
You give it constraints — *"next 3 weeks, weekdays, 09:00–18:00, Skopje"* — and it does a real search over the real sky:

* coarse pass on a 15-minute grid (~2,000 candidates for 3 weeks of workdays),
* score every candidate against the intent's rule pack,
* refine the top ~20 down to 1-minute resolution,
* return the **top 3 windows** with start/end (a window, not a fake-precise instant).

Output looks like this, never like a horoscope:

> **Tue 18 Aug, 10:24 – 11:47** · score 82
> ✅ Moon increasing in light, in Taurus (exalted), applying to trine Venus — the ruler of your matter
> ✅ Jupiter angular on the 10th
> ⚠️ Ascendant ruler in the 12th — keep it discreet, don't announce it publicly
> ❌ Avoid Thu 20 Aug entirely: Moon void-of-course all afternoon

The negatives are always shown. A score with no visible cost is a score nobody should trust.

### 3. The Grader (calendar-native, two-way)
Import your calendar (`.ics` file, or Google Calendar later). Kairos runs every upcoming event through the matching rule pack and flags the ones that are badly timed *and can still be moved*:

> **"Rent negotiation — Thu 14:00"** · score 31
> Moon void-of-course from 13:12; Mercury stations retrograde that morning.
> **Better within your stated availability: Tue 10:40–12:05 (score 79).** → *Propose new time*

This is the feature that makes the app open on a Monday morning instead of a full moon. It is also the feature no competitor has, because none of them ever tried to be useful about *scheduling*.

### 4. The Chapter (the time-lord layer)
Micro-timing without macro-context is noise. Kairos computes, entirely on-device:

* **Annual profections** — the house and Lord of the Year activated on your birthday,
* **Firdaria** — the Persian planetary periods and sub-periods,
* **Zodiacal releasing** from the Lot of Spirit — major/minor life chapters, peak periods, "loosing of the bond" turns.

Rendered as a single readable timeline: *"You are in a 7th-house profection year (Lord: Venus). Partnership and contract topics are live for you until 4 March. That's the season Kairos will bias toward."* The Chapter also **re-weights the Search** — elections aligned with the currently activated topic score higher.

This is the layer that turns a utility into something you keep.

### 5. The Ledger (the honesty engine — the real invention)
Every accepted election becomes a tracked row. Two weeks later Kairos asks one question: **"How did it go?" (1–5)**. It also records events you scheduled *without* it, as a control group.

Then it does statistics properly and shows you the truth:

> **Your ledger — 11 months, 47 events**
> Contracts & purchases (n=12): elected 3.9 avg vs. self-chosen 3.1 · +0.8 [95% CI 0.1–1.5] — *weak positive*
> Meetings & negotiations (n=14): **no measurable difference.** Kairos is not helping you here.
> Dates & personal (n=9): not enough data yet (need 12).

Rules of the Ledger, enforced in code:
* nothing is shown below a minimum-n gate,
* effect size + confidence interval, never a bare "accuracy %",
* paired/bootstrap comparison against the user's own non-elected baseline,
* null results are displayed in the same size type as positive ones.

Why this is the strategic core and not a gimmick: it converts the category's fatal weakness (unfalsifiability → subscription traps → 1-star cancel rage) into the product's trust asset. Whatever you believe about astrology, *an app that measures whether its own advice helped you* is a thing worth having on your phone. And if the honest answer for a given user is "this does nothing for you," saying it out loud is the only version of this product worth building.

---

## Architecture (buildable on this laptop, same stack as the rest of `idea/`)

```
PWA (offline-first) ─┬─ ephemeris worker  (WASM/JS, no network)
                     ├─ election engine   (Web Worker, coarse→fine search)
                     ├─ timelord engine   (profections / firdaria / ZR)
                     ├─ ledger + stats    (bootstrap CI, min-n gates)
                     └─ IndexedDB (everything local) · ICS in/out
              ↓ Capacitor
          Android APK (+ iOS later)
```

**Ephemeris — and one licensing trap worth knowing up front.** *(This was the decision taken; the shipped app runs on astronomy-engine.)*
Swiss Ephemeris (`@swisseph/browser`, `astro-sweph`, `sweph`) is the professional standard — arc-second accuracy, nodes, lots, every house system, WASM-ready, works offline with embedded data. **But it is dual-licensed AGPL / paid commercial.** Shipping a closed, paid app on it requires buying the commercial licence.

So: build the shippable app on **`astronomy-engine`** (MIT, ~116 KB minified, zero data files, ±1 arcminute, VSOP87/NOVAS-validated, Sun→Pluto + Moon + rise/set/phase). ±1 arcminute is *far* beyond what electional rules need — every rule here keys on sign, house, aspect within orbs of 3–8°, and phase. The two things astronomy-engine doesn't hand you directly are computed in ~200 lines each:
* **house cusps** — obliquity + local sidereal time → Placidus/whole-sign, textbook formulas,
* **lunar nodes** — osculating node from the Moon's geocentric position/velocity vectors (which the library does give), or the mean-node polynomial.

Keep a Swiss Ephemeris adapter behind the same interface for an optional AGPL open-source build and for a future pro tier.

**Search cost.** 3 weeks × workdays × 09:00–18:00 on a 15-min grid ≈ 1,700 candidates; each score is a few dozen angle comparisons over ~12 bodies. That's tens of milliseconds of real work in a worker — instant on an i5. The 1-minute refinement pass runs only on the top 20.

**Everything else:** IndexedDB for state, `Intl` + a bundled tzdb slice for timezone/DST correctness (a one-hour DST bug silently ruins every election, so this gets its own test suite), offline city list + optional GPS for coordinates, JSON export/import for backup, ICS for calendar in and out.

**Languages:** the same 25 (24 EU + Macedonian) as My Diary / Expira, reusing that i18n harness.

---

## Guardrails (non-negotiable, in the product)

* **Medical, legal and financial intents get a permanent banner**: *never delay or alter real care, filings or treatment for a chart.* Kairos will still compute an elective-procedure window — that's a legitimate historical use — but it never competes with a doctor's date, and it refuses to elect anything framed as emergency care.
* **No prediction of death, illness, pregnancy outcomes, or another named person's behaviour.** Intents are about *your own* actions.
* **No dark patterns.** One-time price, no auto-renew, cancel-anything-instantly, full data export. This is a positioning weapon, not just ethics — it's the top complaint in the entire category.

---

## Money & wedge

* **Free:** the Chapter (profections + firdaria + ZR), today's sky, 3 elections/month.
* **One-time €9.99 unlock:** unlimited elections, calendar Grader, the Ledger with export.
* **Pro (later, €19.99):** Swiss-Ephemeris-grade build, multiple charts (elect for your business, your child), horary module, printable election report with citations.

**Cold start:** launch into the *traditional/Hellenistic* astrology community — the Astrology Podcast / Valens-reading crowd. They are large, they are the ones who actually practise electional and time-lord technique, they are actively hostile to generic AI horoscope apps, and they have never been served a good phone app. They will review it, argue about the rule packs, and that argument *is* the marketing. Mass-market expansion comes later through the Grader ("the app that fixes your calendar"), which needs no vocabulary at all.

---

## Status — **built and shipping as an Android app**

All four phases are implemented. `Kairos-debug.apk` (≈6 MB) installs and runs offline.

| Phase | Scope | Status |
|---|---|---|
| **1 — Engine** | astronomy-engine wrapper, tropical longitudes of date, Placidus + whole-sign houses, true node, Lots, dignities, sect, aspects, planetary hours, void-of-course | ✅ |
| **2 — Election** | 22 intents with traditional rule packs, coarse→fine search in a Web Worker, scored windows with sourced reasons | ✅ |
| **3 — Chapter & Grader** | profections, firdaria, zodiacal releasing; ICS import, event grading, "find a better time" | ✅ |
| **4 — Ledger & ship** | outcome ratings, bootstrap CIs with minimum-n gates, PWA + service worker, Capacitor APK | ✅ |

**167 tests, all passing** (`npm test`). Rebuild the APK with `.\build-apk.ps1`.

### How it was validated

The chart engine is not checked against itself. It is checked against facts astronomy-engine can prove independently:

* the tropical Sun is at 0°/90°/180°/270° at the four seasons, to 0.005°;
* the computed **Ascendant**, converted back to horizontal coordinates, sits on the geometric horizon (|altitude| < 0.02°) and in the eastern half, at three latitudes including the southern hemisphere;
* the computed **Midheaven**'s right ascension equals the RAMC;
* the Moon's ecliptic latitude is ~0 when it reaches the computed **true node**, and the true node stays within 2° of the mean node and moves backwards;
* **sect** agrees with the Sun's actual altitude above the horizon;
* Placidus cusps are ordered, opposite cusps are exactly 180° apart, and the system degenerates to whole sign inside the polar circle rather than producing nonsense.

**Void-of-course** — the strongest veto in the whole app — is checked against a published third-party table (MoonTracks, August 2026): 12 rows of ingress times match within 3 minutes, and the void start times match within 3 minutes.

That exercise turned up something worth stating plainly. Kairos and the published table disagree on exactly one row, 13 Aug 2026, because MoonTracks counts the Moon's square to **Uranus** — a body no traditional author had. Traditionally that void runs 43 hours; on the modern reading, 19. Kairos defaults to the traditional seven, exposes the choice in Settings, and documents the consequence there rather than picking silently. It also refutes the widely repeated claim that the Moon is void ~13% of the time: for August 2026 both the published table and Kairos give ~30%.

### Architecture as built

```
www/
  vendor/astronomy.browser.min.js   MIT, 116 KB, no data files, no network
  js/astro/ephem.js       longitudes of date, houses, node, Lots, sect, natal
  js/astro/dignity.js     domicile/exaltation/triplicity/bounds/faces, sect,
                          combustion, angularity — every table cited
  js/astro/aspects.js     aspects, application, void-of-course + fast tracks
  js/astro/hours.js       planetary days and unequal hours, Chaldean order
  js/astro/timelords.js   profections, firdaria, zodiacal releasing
  js/election/intents.js  22 intents, each with its own rule-pack weights
  js/election/score.js    the scorer: every point names its rule and source
  js/election/search.js   coarse 15-min sweep → 1-min refinement → windows
  js/election/worker.js   the search runs off the main thread
  js/core/{db,stats,ics,places}.js
```

The one performance trick that makes it viable on a phone: the void-of-course
test is called thousands of times per search, so the Moon and the planets are
sampled once onto interpolated tracks (30-minute and 6-hour grids) that
reproduce the exact ephemeris to four decimal places. A three-week search over
weekday working hours scans ~540 candidate moments and refines the best twelve
to the minute, in about two seconds.

---

## The one-sentence pitch

> Every other astrology app tells you what today means. **Kairos tells you when to act — and then checks whether it was right.**

*Working title.* Alternates if `Kairos` is taken in the stores: **Auspice**, **Elect**, **The Good Hour**, or Macedonian **Добар Час**.

---

### Sources
- [Best Astrology Apps 2026 comparison — Soular Map](https://soularmap.app/blog/best-astrology-app-2026-comparison)
- [5 Astrology Apps Ranked: Co-Star, Sanctuary, Pattern, Nebula — Unstar](https://unstar.app/blog/co-star-sanctuary-pattern-nebula-stellium-astrology-apps-ranked-2026)
- [Horoscope & Astrology Apps Market Size 2026–2032 — 360iResearch](https://www.360iresearch.com/library/intelligence/horoscope-astrology-apps)
- [Electional Astrology Calculator — Augurine](https://www.augurine.com/tools/electional-astrology) · [Vox Stella Election](https://voxstella.app/election) · [Astro.com "The Best Time"](https://www.astro.com/cgi/elec.cgi)
- [Annual Profections, Lots, and Zodiacal Releasing — astro.com / TMA](https://www.astro.com/astrology/tma_article190314_e.htm) · [Chronocrator calculator — Cosmos Daily](https://cosmosdaily.co/chronocrator-calculator)
- [Astronomy Engine (MIT) — GitHub](https://github.com/cosinekitty/astronomy) · [npm](https://www.npmjs.com/package/astronomy-engine)
- [Swiss Ephemeris WASM — @swisseph/browser](https://www.npmjs.com/package/@swisseph/browser) · [astro-sweph](https://github.com/astroahava/astro-sweph)
